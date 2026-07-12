import * as path from 'node:path';
import * as fs from 'node:fs';

class ScopusInfo{

    constructor(csvLine){
        // "Authors","Author full names",
        // "Author(s) ID","Title","Year","Source title",
        // "Volume","Issue","Art. No.","Page start","Page end",
        // "Cited by","DOI","Link","Document Type",
        // "Publication Stage","Open Access","Source","EID"
        const parts = csvLine.split("\",\"")
        this.authors = parts[0]
        this.title = parts[3]
        this.year = parts[4]
        this.source = parts[5]
        this.citedBy = parts[11]
        this.doi = parts[12]? parts[12].toLowerCase() : undefined
        this.type = parts[14]
    }

    toString(){
        return `"${this.doi}", "${this.title}", "${this.source}", "${this.year}", "${this.type}", "${this.authors}"`
    }

}


class ScopusResult {

    constructor(query, csvDir) {

        this.filePath = this.loadFile(query, csvDir)
        this.results = this.loadResults()
        this.doiMap = new Map()
        this.results
            .filter(r => r.doi !== undefined)
            .forEach(r => this.doiMap.set(r.doi, r))
    }

    contains(doi){
        return this.doiMap.has(doi)
    }

    size() {
        return this.results.length
    }

    loadFile(query, csvDir) {
        const files = fs.readdirSync(csvDir)
        const file = files.find(file => {
            if (!file.endsWith(".csv")) return false;

            const fileParts = file.split("_")
            const queryParts = [fileParts[1], fileParts[2]]
            return query.matches(queryParts)
        });

        if (!file) return null;
        return path.resolve(csvDir, file);
    }


    loadResults() {
        if (!this.filePath) {
            return []
        }

        const content = fs.readFileSync(this.filePath, "utf-8")

        const rows = content.split("\n")
        // discard first row
        rows.shift()

        return rows.map(row => new ScopusInfo(row))
    }
}


export {ScopusResult}