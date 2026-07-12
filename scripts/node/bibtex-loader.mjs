import bibtexParse from '@orcid/bibtex-parse-js';
import * as path from 'node:path';
import * as fs from 'node:fs';


class BibItem {

    constructor(object) {
        this.bibObject = object
        this.doi = object.entryTags.doi
    }

}

class Bibliography {

    constructor(bibtexDir) {
        this.loadBibtexCatalog(bibtexDir)
    }

    loadBibtexCatalog(bibtexDir) {

        const files = fs.readdirSync(bibtexDir)
        const bibtexContent = files
            .filter(file => file.endsWith(".bib"))
            .map(file => {
                const filePath = path.resolve(bibtexDir, file)
                const content = fs.readFileSync(filePath, "utf-8")
                return content
            }).join("\n")


        var bibtexObjects = bibtexParse.toJSON(bibtexContent);
        this.catalog = new Map()

        bibtexObjects.
        forEach(object => {
            this.catalog.set(object.citationKey, new BibItem(object))
        })
    }

    getBibItem(bibKey) {
        return this.catalog.get("DBLP:" + bibKey)
    }

    values(){
        return Array.from(this.catalog.values())
    }
}

export { Bibliography }
