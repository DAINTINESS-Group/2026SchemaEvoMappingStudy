import fs from "node:fs";
import { corpusItemDownloaded } from "./download.mjs";

export default class MarkDownReport {


    constructor(paperList){
        this.paperList = paperList
        
    }

    set title(txt){
        this._title = txt
    }

    set tableHeadings(headingsList){
        this._headings = headingsList
    }

    reportContent(){
        let id = 1
        let content = 
`

<div style="width:100em">


# ${this._title}

The following table contains the papers of the systematic mapping study's corpus.
Click on paper title to view the PDF document.

| ${mdTableHeadings(this._headings, [3, 10, 30, 20, 5])} |
| ${this._headings.map(h => h.length).map(l => "-".repeat(l)).join(" | ") } |
${this.paperList
    .map(p => mdTableRow([id++, p.key, corpusLink(p.title, p.key), p.authors, mdLink(p.key, p.documentURI)]))
    .join(" \n")
}

</div>

`
        return content
    }

    write(filePath){
        const mdReport = fs.openSync(filePath, "w")
        fs.writeFileSync(mdReport, this.reportContent())
        fs.close(mdReport)
    }

}

function mdTableHeadings(headings, headingWidths){
    return headings.map( (h, idx) => `<div style="width:${headingWidths[idx]}em">${h}</div> `).join(" | ")
}

function mdLink(key, url){
    let text = corpusItemDownloaded(key) ? 'View' : 'Download'
    return `[${text}](${url})`
}

function corpusLink(title, key){
    if (corpusItemDownloaded(key)){
        return `[${title}](./corpus/${key}.pdf)`
    } else {
        return title
    }
}

function mdTableRow(list){

    let row = `| ${list.join(" | ")} |`;
    return row

}