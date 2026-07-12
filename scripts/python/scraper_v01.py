import itertools
import time
from typing import List, Dict, Any

import requests
import pandas as pd
import argparse

# --- Keyword sets -----------------------------------------------------------------

KEYWORDS_1 = ["Schema", "Database"]
KEYWORDS_2 = ["Evolution", "Change", "Maintenance", "Decay", "Migration", "Update", "Adapt", "Modification"]

BASE_API_URL = "https://dblp.org/search/publ/api"

# --- Helpers ----------------------------------------------------------------------


def build_search_terms(kws1: List[str], kws2: List[str]) -> List[Dict[str, str]]:
    """
    Build all combinations of (term_1, term_2) and their query string: 'term_1 AND term_2'.
    """
    combos = []
    for k1, k2 in itertools.product(kws1, kws2):
        query_str = f"{k1} AND {k2}"
        combos.append({"term_1": k1, "term_2": k2, "search_terms": query_str})
    return combos


def query_dblp(query: str, max_results: int = 1000, timeout: int = 20) -> List[Dict[str, Any]]:
    """
    Call the dblp publication search API for a given query string.

    Returns the list of 'hit' objects (each containing an 'info' dict).
    Docs: https://dblp.org/faq/How+to+use+the+dblp+search+API
    """
    params = {
        "q": query,
        "h": max_results,
        "format": "json",
    }
    resp = requests.get(BASE_API_URL, params=params, timeout=timeout)
    resp.raise_for_status()

    data = resp.json()
    hits = data.get("result", {}).get("hits", {}).get("hit", [])
    # For 0 or 1 hit, dblp sometimes returns an object instead of a list
    if isinstance(hits, dict):
        hits = [hits]
    return hits


def normalize_hit(hit: Dict[str, Any], search_terms: str, term_1: str, term_2: str) -> Dict[str, Any]:
    """
    Flatten a single dblp 'hit' into a plain dict suitable for a DataFrame row.
    """
    info = hit.get("info", {})

    # Title
    title = info.get("title")

    # Authors: can be a dict, list, or missing
    authors_obj = info.get("authors", {}).get("author", [])
    if isinstance(authors_obj, dict):
        authors_list = [authors_obj]
    elif isinstance(authors_obj, list):
        authors_list = authors_obj
    else:
        authors_list = []

    # Try to extract just the author names as strings
    def author_to_name(a):
        if isinstance(a, str):
            return a
        if isinstance(a, dict):
            # Commonly the plain text is under "text"; fall back to any value
            return a.get("text") or a.get("name") or next(iter(a.values()), None)
        return str(a)

    author_names = [author_to_name(a) for a in authors_list if author_to_name(a) is not None]

    # Year (can be string, list, missing, or strange)
    raw_year = info.get("year")

    year = None
    if isinstance(raw_year, list):
        # Take the first element that looks like a year-like string
        for y in raw_year:
            if isinstance(y, str) and y.isdigit():
                year = int(y)
                break
            if isinstance(y, (int, float)):
                year = int(y)
                break
    elif isinstance(raw_year, str):
        if raw_year.isdigit():
            year = int(raw_year)
    elif isinstance(raw_year, (int, float)):
        year = int(raw_year)

    # Other useful fields from dblp
    venue = info.get("venue")
    if isinstance(venue, list):  # sometimes it's a list
        venue = venue[0] if venue else None

    return {
        "search_terms": search_terms,
        "term_1": term_1,
        "term_2": term_2,
        "title": title,
        "authors": author_names,
        "year": year,
        "venue": venue,
        "type": info.get("type"),
        "key": info.get("key"),          # dblp internal key
        "url": info.get("url"),          # dblp URL
        "ee": info.get("ee"),            # electronic edition (may be DOI URL)
        "pages": info.get("pages"),
        "volume": info.get("volume"),
        "number": info.get("number"),
        "publisher": info.get("publisher"),
        "isbn": info.get("isbn"),
        "doi": info.get("doi"),          # sometimes present separately
    }


# --- Main logic -------------------------------------------------------------------


def build_dblp_dataframe(
    kws1: List[str],
    kws2: List[str],
    max_results_per_query: int = 1000,
    pause_seconds: float = 0.3,
) -> pd.DataFrame:
    """
    For each combination of keywords, query dblp and build a single DataFrame
    with one row per publication + columns for the search terms.
    """
    combos = build_search_terms(kws1, kws2)
    rows: List[Dict[str, Any]] = []

    for combo in combos:
        query = combo["search_terms"]
        term_1 = combo["term_1"]
        term_2 = combo["term_2"]

        print(f"Querying dblp for: {query!r}")
        hits = query_dblp(query, max_results=max_results_per_query)

        for hit in hits:
            row = normalize_hit(hit, search_terms=query, term_1=term_1, term_2=term_2)
            rows.append(row)

        # be polite to dblp
        time.sleep(pause_seconds)

    df = pd.DataFrame(rows)
    return df

def normalize_title(t):
    if not isinstance(t, str):
        return ""
    # lowercase, strip whitespace, collapse internal whitespace
    return " ".join(t.lower().strip().split())


def filter_by_year_range(df, start_year=None, end_year=None):
    # Guard against missing or non-integer years
    df = df[df["year"].notna()]

    if start_year is not None:
        df = df[df["year"] >= start_year]

    if end_year is not None:
        df = df[df["year"] <= end_year]

    return df


if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Harvest and filter dblp records.")
    parser.add_argument("start_year", type=int,
                        help="Lower bound of year range (e.g. 2021)")
    parser.add_argument("end_year", type=int,
                        help="Upper bound of year range (e.g. 2025)")

    args = parser.parse_args()

    # Initial datafram. Up to 1000 results per query.
    df = build_dblp_dataframe(KEYWORDS_1, KEYWORDS_2, max_results_per_query=1000)
    # Output to csv
    df.to_csv("00_dblp_keyword_queries_results.csv")
    
    # Filter by year range
    df = filter_by_year_range(df, args.start_year, args.end_year)   
    # Output to csv    
    df.to_csv("10_dblp_years_"+str(args.start_year)+"-"+str(args.end_year)+"_results.csv")

    # --- Deduplicate using the dblp 'key' field --------------------------------
    # Treat rows with missing key as always unique (optional but sensible)
    df_with_key = df[df["key"].notna()].copy()
    df_no_key   = df[df["key"].isna()].copy()

    # Boolean mask of the FIRST occurrence of each key
    unique_mask = ~df_with_key.duplicated(subset=["key"], keep="first")

    # Unique rows (by key) = first occurrence of each key + all rows without key
    deduped_df = pd.concat(
        [
            df_with_key[unique_mask],
            df_no_key
        ],
        ignore_index=True
    )

    # Duplicates = all rows with key that are NOT in the unique set
    duplicates_df = df_with_key[~unique_mask].copy()
    # ---------------------------------------------------------------------------
    
    # Sort both datasets by year (descending)
    deduped_df = deduped_df.sort_values(by="year", ascending=False)
    duplicates_df = duplicates_df.sort_values(by="year", ascending=False)
    

    # Export to CSV
    deduped_df.to_csv("20_dblp_unique_publications.csv", index=False)
    duplicates_df.to_csv("30_dblp_duplicate_publications.csv", index=False)

    print(f"Unique papers: {len(deduped_df)}")
    print(f"Duplicate papers: {len(duplicates_df)}")
    
    print(df.head())
    # Example: save to CSV for your systematic mapping study
    df.to_csv("40_dblp_schema_evolution_mapping.csv", index=False)
    print(f"\nSaved {len(df)} rows to 40_dblp_schema_evolution_mapping.csv")

