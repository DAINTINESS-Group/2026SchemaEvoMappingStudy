import * as path from 'node:path';
import * as fs from 'node:fs';

class Query {
    constructor(terms, separator = " ") {
        const parts = terms.split(separator);
        this.term1 = parts[0].trim().toLowerCase();
        this.term2 = parts[1].trim().toLowerCase();
    }

    matches(termsList) {
        if (termsList.length != 2) return false

        const otherTerms = termsList.map(t => t.trim().toLowerCase());

        return otherTerms.includes(this.term1) && otherTerms.includes(this.term2)

    }

    toString() {
        return this.term1 + " " + this.term2
    }
}


function getContentAsObjectList(jsonDirectory, deduplicate = false) {

    const uniqueKeys = new Set();

    const objectList = loadJSON(jsonDirectory)

    const dblpHitList = objectList
        .flatMap(object => object.result.hits.hit)
        .filter(hit => hit != undefined)

    const timeFilteredHitList = dblpHitList
        .filter(hit => hit.info.year >= 2011 && hit.info.year <= 2025)

    const dedupedHitList = timeFilteredHitList
        .filter(hit => {

            if (!deduplicate) return true

            if (uniqueKeys.has(hit.info.key)) {
                return false;
            }
            uniqueKeys.add(hit.info.key)
            return true;
        })
        .map(hit => new DBLPInfo(hit));

    console.log(`Total DBLP results ${dblpHitList.length}`)

    console.log(`Time filtered DBLP results ${timeFilteredHitList.length}`)

    if (deduplicate) {
        console.log(`Deduplicated DBLP results ${dedupedHitList.length}`)
    }

    return dedupedHitList
}

function loadJSON(jsonDirectory) {
    const objectList = []
    const files = fs.readdirSync(jsonDirectory)
        .filter(file => file.endsWith(".json"))

    files.forEach(file => {

        const fullPath = path.join(jsonDirectory, file);
        if (!fullPath.endsWith(".json")) {
            return;
        }

        const content = fs.readFileSync(fullPath, "utf-8")
        const object = JSON.parse(content)
        objectList.push(object)

    });
    return objectList
}

class DBLPResult {
    constructor(query, jsonDir) {

        this.filePath = this.loadFile(query, jsonDir)
        this.results = this.loadResults()
        this.doiMap = new Map()
        this.results
            .filter(r => r.doi !== undefined)
            .forEach(r => this.doiMap.set(r.doi, r))

    }

    size() {
        return this.results.length
    }

    loadFile(query, jsonDir) {
        const files = fs.readdirSync(jsonDir)
        const file = files.find(file => {
            if (!file.endsWith(".json")) return false;

            const fileParts = file.split("_")
            const queryParts = fileParts[1].split(" ")
            return query.matches(queryParts)
        });

        if (!file) return null;
        return path.resolve(jsonDir, file);
    }


    loadResults() {
        if (!this.filePath) {
            return
        }

        const content = fs.readFileSync(this.filePath, "utf-8")
        const resultObject = JSON.parse(content)

        const dblpInfoList = resultObject.result.hits.hit
            .filter(hit => hit != undefined && hit.info.year >= 2010 && hit.info.year <= 2025)
            .map(hit => new DBLPInfo(hit));

        return dblpInfoList

    }

    updateBibItems(bibliography) {
        this.results.forEach(entry => {
            entry.updateBibItem(bibliography.getBibItem(entry.dblpKey))
            this.doiMap.set(entry.doi, entry)
        })
    }

    contains(doi) {
        return this.doiMap.has(doi)
    }
}

class DBLPInfo {

    constructor(hit) {
        this.title = hit.info.title
        this.ee = hit.info.ee
        this.doi = hit.info.doi ? hit.info.doi.toLowerCase() : undefined
        this.dblpKey = hit.info.key
        this.key = normalizeKey(hit.info.key)
        this.venue = hit.info.venue
        this.year = hit.info.year
        this.authors = this.extractAuthors(hit.info.authors?.author)
        this.type = hit.info.type
    }

    extractAuthors(authorProperty) {
        if (!authorProperty) {
            return ""
        }
        if (authorProperty.length) {
            return authorProperty.map(a => a.text).join(", ")
        } else {
            return authorProperty.text
        }
    }

    updateBibItem(bibItem) {
        if (!bibItem) return

        this.bibItem = bibItem
        if (bibItem.doi) {
            this.doi = bibItem.doi.toLowerCase()
            this.doi = this.doi.replace("\\", "")
        }

    }

    toString() {
        return `"${this.doi}", "${this.title}", "${this.venue}", "${this.year}", "${this.authors}", "${this.dblpKey}", "${this.type}"`
    }

    toCSV(){
        return `"${[this.authors, this.title, this.year, this.venue, this.doi, this.type, this.dblpKey].join(`","`)}"`
    }


}

DBLPInfo.CSVHeader = `"${['Authors', 'Title', 'Year', 'Venue', 'DOI', 'DocumentType', 'Key'].join(`","`)}"`

function normalizeKey(originalKey) {
    return originalKey.replace(/\//g, "_")
}

export { Query, DBLPResult, getContentAsObjectList, DBLPInfo }