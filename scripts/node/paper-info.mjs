export class PaperInfo {
    constructor(key, eeUri, title, authors, year, venue, documentURI) {
        this.dblpKey = key
        this.key = this.normalizeKey(key)
        this.eeUri = eeUri
        this.title = title
        this.authors = authors
        this.year = year
        this.venue = venue
        if (documentURI) this.documentURI = documentURI
    }

    normalizeKey(originalKey) {
        return originalKey.replace(/\//g, "_")
    }
}
