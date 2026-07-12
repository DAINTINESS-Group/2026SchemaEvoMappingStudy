import {Query, DBLPResult, getContentAsObjectList} from "./dblp-parser.mjs";
import { Bibliography } from "./bibtex-loader.mjs";
import { ScopusResult } from "./scopus-parser.mjs";
import * as path from 'node:path';
import * as fs from 'node:fs';
import { json } from "node:stream/consumers";

const args = process.argv.slice(2);

const dblpCsv = path.resolve(args[0])
const scopusCsv = path.resolve(args[1])

class BibEntry {
    constructor(csvrow, idx){

        let parts = csvrow.split('\",\"')
        this.authors = parts[idx[0]].replace('"', "")
        this.title = parts[idx[1]]
        this.year = parts[idx[2]]
        this.venue = parts[idx[3]]
        this.doi = parts[idx[4]] ? parts[idx[4]].toLowerCase().trim() : ""
        this.type = parts[idx[5]]
        this.key = parts[idx[6]]? parts[idx[6]].trim().replace('"', "") : ""
    }
}

class BibEntrySet {

    constructor(file, idx){

        this.bibMap = new Map()
        const content = fs.readFileSync(file, "utf-8")
        const rows = content.split("\n")
        // remove headers
        rows.shift()
        this.result = rows.map(row => new BibEntry(row, idx))

        this.result.filter(entry => entry.doi && entry.doi.trim() !== "")
        .forEach(entry => {
            if (this.bibMap.has(entry.doi)) return
            
            this.bibMap.set(entry.doi, entry)
        })
    }

    hasEntry(doi){
        return this.bibMap.has(doi)
    }
}


const dblpEntrySet = new BibEntrySet(dblpCsv, [0, 1, 2, 3, 4, 5, 6])
const scopusEntrySet= new BibEntrySet(scopusCsv, [0, 3, 4, 5, 12, 14, 18])

function diff(entrySet1, entrySet2){    
    const diffItems = entrySet1.result
        .filter(bibEntry => 
            !entrySet2.hasEntry(bibEntry.doi))

    return diffItems
}

function intersection(entrySet1, entrySet2){
    const commonItems = entrySet1.result
        .filter(bibEntry => 
            entrySet2.hasEntry(bibEntry.doi))

    return commonItems
}

const dblpScopusDiff = diff(dblpEntrySet, scopusEntrySet)
console.log(`DBLP-Scopus Total diffs: ${dblpScopusDiff.length}`)

const dblpScopusIntersection = intersection(dblpEntrySet, scopusEntrySet)
console.log(`DBLP-Scopus Intersection: ${dblpScopusIntersection.length}`)

const scopusDblpDiff = diff(scopusEntrySet, dblpEntrySet)
console.log(`Scopus-DBLP Total diffs: ${scopusDblpDiff.length}`)

const scopusDblpIntersection = intersection(scopusEntrySet, dblpEntrySet)
console.log(`Scopus-DBLP Intersection: ${scopusDblpIntersection.length}`)


// diffContent = dblpScopusDiffs.map(item => item.toString()).join("\n")
// fs.writeFileSync(path.resolve('dblp-scopus-diff.csv'), diffContent)



// queries.forEach(query => {
//     let sr = new ScopusResult(query, scopusDir)
//     let dr = new DBLPResult(query, jsonDir)
//     dr.updateBibItems(bibliography)

//     let diffItems = diff(sr, dr)
//     scopusDblpDiffs.push(...diffItems)
//     console.log(`${query}: Scopus(${sr.size()}) - DBLP(${dr.size()}) : ${diffItems.length} items in Scopus and Not in DBLP`)
    

//     diffItems = diff(dr, sr)
//     dblpScopusDiffs.push(...diffItems)
//     console.log(`${query}: DBLP(${dr.size()}) - Scopus(${sr.size()}) : ${diffItems.length} items in DBLP and Not in Scopus`)
    
// })



// console.log(`Scopus-DBLP Total diffs: ${scopusDblpDiffs.length}`)
// let diffContent = scopusDblpDiffs.map(item => item.toString()).join("\n")
// fs.writeFileSync(path.resolve('scopus-dblp-diff.csv'), diffContent)


// console.log(`DBLP-Scopus Total diffs: ${dblpScopusDiffs.length}`)
// diffContent = dblpScopusDiffs.map(item => item.toString()).join("\n")
// fs.writeFileSync(path.resolve('dblp-scopus-diff.csv'), diffContent)


// const entries = getContentAsObjectList(dblpDir)