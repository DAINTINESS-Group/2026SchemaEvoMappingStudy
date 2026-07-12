import { getChromeDriver } from "./selenium.mjs";
import path from "node:path";
import fs from "node:fs";
import {
  updateDocumentURLs,
  corpusItemDownloaded,
  copyDownloadedPdfToCorpus,
  downloadDocument,
  copyDownloadedFileToLocation
} from "./download.mjs";
import { exit } from "node:process";
import { PaperInfo } from "./paper-info.mjs";
import readline from "node:readline";
import MarkDownReport from "./markdown.mjs";
import { getContentAsObjectList, DBLPInfo } from "./dblp-parser.mjs";

const args = process.argv.slice(2);

const keyEEUrisFile = args[1];
const action = args[0];

if (!keyEEUrisFile) {
  console.log("Key/URIs file not available, aborting...");
  exit();
}

const csvOutFile = fs.openSync("./keys-eeUris-docUris.csv", "w");

let driver = null;

if (action === "update-URIs") {
  const paperInfoList = loadKeyURIsFile(keyEEUrisFile);
  driver = await getChromeDriver();
  await updateDocumentURLs(driver, paperInfoList, csvOutFile);

} else if (action === "latex-bib"){

  const paperInfoList = loadKeyURIsFile(keyEEUrisFile);
  let latexContent = paperInfoList.map(paperInfo => `\\cite{DBLP:${paperInfo.dblpKey}}`).join("\n")

  const doc = `
\\documentclass{article}

\\title{Corpus bibliography}

\\begin{document}
\\maketitle

\\section{Corpus references}

${latexContent}

\\bibliographystyle{alpha}
\\bibliography{corpus}
\\end{document}

  `

  const latexBib = fs.openSync('./corpus.tex', "w")
  fs.writeFileSync(latexBib, doc)
  fs.close(latexBib)

} else if (action === "bibtex") {
  // applies only to DBLP data
  const paperInfoList = loadKeyURIsFile(keyEEUrisFile);
  driver = await getChromeDriver();
  globalThis.CORPUS_LOCATION = globalThis.CORPUS_LOCATION + path.sep + "bib"
  
  for (let paperInfo of paperInfoList) {
    if (corpusItemDownloaded(paperInfo.key, ".bib")) continue;
    let bibtexURL = `https://dblp.org/rec/${paperInfo.dblpKey}.bib?param=1`
    await driver.get(bibtexURL);
    await driver.sleep(5000);
    copyDownloadedFileToLocation(paperInfo.key, ".bib");
  }

} else if (action === "download") {
  const paperInfoList = loadKeyURIsFile(keyEEUrisFile);
  driver = await getChromeDriver();
  for (let paperInfo of paperInfoList) {
    if (corpusItemDownloaded(paperInfo.key)) continue;
    await downloadDocument(driver, paperInfo, csvOutFile);
    copyDownloadedPdfToCorpus(paperInfo.key);
  }
} else if (action === "corpus-md") {

  // const list = paperInfoList.filter(
  //   (p) => p.documentURI && corpusItemDownloaded(p.key)
  // );
const paperInfoList = loadKeyURIsFile(keyEEUrisFile);
  const report = new MarkDownReport(paperInfoList)
  report.title = "Schema Evolution SMS - Corpus"
  report.tableHeadings = ['Id', 'DBLP key', 'Title', 'Authors', 'Download URL']
  report.write('../../../corpus.md')

} else if (action === "manual") {
  const paperInfoList = loadKeyURIsFile(keyEEUrisFile);
  const list = paperInfoList.filter(
    (p) => p.documentURI && !corpusItemDownloaded(p.key)
  );

  console.log(`Remaining ${list.length} articles`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (list.length == 0) {
    console.log("Finished processing");
  }
  let paperInfo = list.pop();
  console.log(`Processing ${paperInfo.key}: ${paperInfo.documentURI} - ${paperInfo.title}`);

  rl.on("line", (ans) => {
    if (!paperInfo) {
      rl.close();
      console.log('Processing finished')
      return
    }

    copyDownloadedPdfToCorpus(paperInfo.key);

    paperInfo = list.pop();
    if (paperInfo) {
      console.log(`Processing ${paperInfo.key}: ${paperInfo.documentURI} - ${paperInfo.title}`);
    }

  });
} else if (action === "dblp-csv"){
  
  const dblpResultsDir = args[1]
  const dblpInfoList = getContentAsObjectList(path.resolve(dblpResultsDir, "json"), true)
  console.log(`Extracting to CSV`)
  
  const csvRows = dblpInfoList.map(info => info.toCSV()).join("\n")
  const csvContent = DBLPInfo.CSVHeader + "\n" + csvRows
  const csvOutFile = fs.writeFileSync(path.resolve("./dblp-results-2011-2025.csv"), csvContent);
}


function loadKeyURIsFile(filePath) {
  const content = fs.readFileSync(filePath, { encoding: "utf8", flag: "r" });
  const rows = content.split("\n");
  rows.shift();

  const paperInfoList = rows
    .map((row) => {
      const items = row.split("|");
      if (items.length >= 3) {
        return new PaperInfo(
          items[0].trim(),
          items[1].trim(),
          items[2].trim(),
          items[3].trim(),
          items[4].trim(),
          items[5].trim(),
          items[6]?.trim() // docURI
        );
      }
      return undefined;
    })
    .filter((item) => item !== undefined);

  console.log(`Extracted ${paperInfoList.length} entries`);
  return paperInfoList;
}

function readInput(prompt, actionHandler) {
  console.log(`Processing: ${prompt}`);

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("line", (ans) => {
      resolve(actionHandler(ans));
    });

    rl.on("close", () => {
      rl.close();
      reject();
    });
  });
}
