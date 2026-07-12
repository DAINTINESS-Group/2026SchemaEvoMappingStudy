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

import getContentAsObjectList from "./dblp-parser.mjs";

const args = process.argv.slice(2);
const dblpJsonDir = args[0];
const bibtexDir = args[1];

const dblpInfoEntries = getContentAsObjectList(dblpJsonDir)

let driver = null;

globalThis.CORPUS_LOCATION = path.resolve(bibtexDir)
globalThis.DOWNLOAD_LOCATION = path.resolve("C:\\Users\\bzafiris\\Downloads");

driver = await getChromeDriver();

for (let paperInfo of dblpInfoEntries) {
  if (corpusItemDownloaded(paperInfo.key, ".bib")) continue;
  let bibtexURL = `https://dblp.org/rec/${paperInfo.dblpKey}.bib?param=1`
  await driver.get(bibtexURL);
  await driver.sleep(5000);
  copyDownloadedFileToLocation(paperInfo.key, ".bib");
}
