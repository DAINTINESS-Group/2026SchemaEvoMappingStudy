import path from "node:path";
import fs from "node:fs";
import { getChromeDriver } from "./selenium.mjs";
import { By, Key } from "selenium-webdriver";

globalThis.DOWNLOAD_LOCATION = path.resolve("C:\\Users\\bzafiris\\Downloads");
globalThis.CORPUS_LOCATION = path.resolve(
  "..\\..\\corpus\\pdf"
);

const ACM_TIMEOUT = 10000;
const IEEE_TIMEOUT = 10000;
const PDF_TIMEOUT = 2000;
const DOWNLOAD_TIMEOUT = 15000;
const PAGE_TIMEOUT = 5000;


async function downloadPdf(driver, paperInfo) {
  if (!paperInfo.documentURI) return;

  if (
    paperInfo.documentURI.endsWith(".pdf") ||
    paperInfo.documentURI === paperInfo.eeUri
  ) {
    await downloadPdfURI(driver, paperInfo.documentURI);
    // } else if (paperInfo.documentURI.includes("ieeexplore.ieee.org")) {
    //   await downloadIEEEPdf(driver, paperInfo);
  } else if (paperInfo.documentURI.includes("dl.acm.org")) {
    await downloadACMPdf(driver, paperInfo.documentURI);
  } else if (paperInfo.documentURI.includes("arxiv.org")) {
    await downloadArxivPdf(driver, paperInfo.documentURI);
  } else if (paperInfo.documentURI.includes("link.springer.com")) {
    await downloadSpringerPdf(driver, paperInfo.documentURI);
  }
}

function corpusItemDownloaded(dblpKey, suffix=".pdf") {
  const destPath = `${globalThis.CORPUS_LOCATION}${path.sep}${dblpKey}${suffix}`;
  if (fs.existsSync(destPath)) {
    //console.log(`File for ${dblpKey} already downloaded`);
    return true;
  }
  return false;
}

function getDownloadedFile(suffix= ".pdf") {
  let downloadDirContents = fs.readdirSync(globalThis.DOWNLOAD_LOCATION);

  const downloadedPdfList = downloadDirContents.filter((entry) =>
    entry.endsWith(suffix)
  );

  if (downloadedPdfList.length !== 1) {
    return undefined;
  }

  return downloadedPdfList[0];
}

function copyDownloadedPdfToCorpus(dblpKey) {
  const downloadedFile = getDownloadedFile();

  if (!downloadedFile) return;

  let sourcePath = `${globalThis.DOWNLOAD_LOCATION}${path.sep}${downloadedFile}`;

  const destPath = `${globalThis.CORPUS_LOCATION}${path.sep}${dblpKey}.pdf`;

  console.log(`Moving ${sourcePath} -> ${destPath}`);

  if (fs.existsSync(destPath)) {
    console.log(`File for ${dblpKey} already downloaded`);
  } else {
    fs.copyFileSync(sourcePath, destPath, fs.constants.COPYFILE_EXCL);
  }
  console.log("Removing " + sourcePath);
  fs.rmSync(sourcePath);
}

function copyDownloadedFileToLocation(dblpKey, fileSuffix=".bib") {
  const downloadedFile = getDownloadedFile(fileSuffix);

  if (!downloadedFile) return;

  let sourcePath = `${globalThis.DOWNLOAD_LOCATION}${path.sep}${downloadedFile}`;

  const destPath = `${globalThis.CORPUS_LOCATION}${path.sep}${dblpKey}${fileSuffix}`;

  console.log(`Moving ${sourcePath} -> ${destPath}`);

  if (fs.existsSync(destPath)) {
    console.log(`File for ${dblpKey} already downloaded`);
  } else {
    fs.copyFileSync(sourcePath, destPath, fs.constants.COPYFILE_EXCL);
  }
  console.log("Removing " + sourcePath);
  fs.rmSync(sourcePath);
}

async function downloadDocument(driver, paperInfo, csvOutFile) {
  function writeLine(info) {
    const row = [
      info.key,
      info.eeUri,
      info.documentURI,
      info.title,
      info.authors,
      info.year,
      info.venue,
    ].join("|");
    fs.writeFileSync(csvOutFile, row + "\n");
  }

  await updateDocumentURI(driver, paperInfo);

  await driver.sleep(DOWNLOAD_TIMEOUT);

  const downloadedFile = getDownloadedFile();

  if (downloadedFile) {
    writeLine(paperInfo);
    return;
  }

  await downloadPdf(driver, paperInfo);

  writeLine(paperInfo);
}

async function updateDocumentURI(driver, paperInfo) {
  const url = await fetchDocumentURL(driver, paperInfo.eeUri);
  driver.sleep(2000);
  console.log(`Resolved ${paperInfo.key} -> ${url}`);
  paperInfo.documentURI = url;
}

async function updateDocumentURLs(driver, paperInfoList, csvOutFile) {
  function writeLine(info) {
    const row = [
      info.key,
      info.eeUri,
      info.title,
      info.authors,
      info.year,
      info.venue,
      info.documentURI,
    ].join("|");
    fs.writeFileSync(csvOutFile, row + "\n");
  }

  for (let paperInfo of paperInfoList) {
    if (paperInfo.eeUri.endsWith(".pdf")) {
      paperInfo.documentURI = paperInfo.eeUri;
      writeLine(paperInfo);
      continue;
    }
    const url = await fetchDocumentURL(driver, paperInfo.eeUri);
    driver.sleep(2000);
    console.log(`Resolved ${paperInfo.key} -> ${url}`);

    paperInfo.documentURI = url;

    writeLine(paperInfo);
  }
}

async function downloadPaperList(driver, paperInfoList) {
  for (let paperInfo of paperInfoList) {
    if (paperInfo.eeUri.endsWith(".pdf")) {
      await downloadPdf(driver, paperInfo.eeUri);
      console.log(`Downloaded ${paperInfo.eeUri}`);
    }
  }
}

async function downloadDBLPInfoPdf(driver, info) {
  const eeUrl = info.ee;
  if (eeUrl.endsWith(".pdf")) {
    await downloadPdf(driver, eeUrl);
  }
}


async function fetchDocumentURL(driver, dblpEEUrl) {
  try {
    await driver.get(dblpEEUrl);
    const documentUrl = await driver.getCurrentUrl();
    return documentUrl;
  } catch {
    return "unresolved";
  }
}

async function downloadArxivPdf(driver, documentUrl) {
  // https://arxiv.org/abs/2412.06269 replaced by https://arxiv.org/pdf/2412.06269
  let pdfUrl = documentUrl.replace("/abs/", "/pdf/");
  await driver.get(pdfUrl);
  await driver.sleep(DOWNLOAD_TIMEOUT);
  console.log("Opening " + pdfUrl);
}

async function acceptAllCookies(driver) {
  try {
    const btn = await driver.findElement(By.css(".osano-cm-accept-all"));
    await btn.click();
    await driver.sleep(DOWNLOAD_TIMEOUT);
  } catch {}
}

async function sendTabs(driver, targetElement, max = 30) {
  const actions = driver.actions({ async: true });
  for (let i = 0; i < max; i++) {
    await actions.sendKeys(Key.TAB).perform();
    const currentElement = await driver.switchTo().activeElement();
    // if (targetElement === currentElement){
    //   await actions.sendKeys(Key.ENTER).perform()
    //   break;
    // }
    await driver.sleep(500);
  }
  await actions.sendKeys(Key.ENTER).perform();
  await driver.sleep(PAGE_TIMEOUT);
}

async function downloadIEEEPdf(driver, paperInfo) {
  //  try {
  const documentId = paperInfo.documentURI.split("/")[0];
  await driver.get(paperInfo.eeUri);
  //await driver.get(paperInfo.documentURI)
  await driver.sleep(PAGE_TIMEOUT);
  await acceptAllCookies(driver);
  //const pdfButton = await driver.findElement(By.css(`a[href$=${documentId}]`));
  await driver.get(
    `https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber=${documentId}`
  );
}

async function downloadACMPdf(driver, documentURI) {
  try {
    const pdfURI = documentURI.replace("/doi/", "/doi/pdf/");
    await driver.get(pdfURI);
    await driver.sleep(DOWNLOAD_TIMEOUT);
  } catch {
    console.log(`Downloaded ${documentURI}`);
  }
}

async function downloadSpringerPdf(driver, documentURI) {
  try {
    let pdfURI = documentURI;
    if (pdfURI.includes("/chapter/")) {
      pdfURI = pdfURI.replace("/chapter/", "/content/pdf/");
    } else if (pdfURI.includes("/article/")) {
      pdfURI = pdfURI.replace("/article/", "/content/pdf/");
    }
    pdfURI = pdfURI + ".pdf";
    await driver.get(pdfURI);
    await driver.sleep(DOWNLOAD_TIMEOUT);
  } catch {
    console.log(`Downloaded ${documentURI}`);
  }
}

async function downloadPdfURI(driver, pdfUrl) {
  try {
    await driver.get(pdfUrl);
    await driver.sleep(DOWNLOAD_TIMEOUT);
  } catch {
    console.log(`Downloaded ${pdfUrl}`);
  }
}

export {
  updateDocumentURLs,
  corpusItemDownloaded,
  copyDownloadedPdfToCorpus,
  downloadDocument,
  copyDownloadedFileToLocation
};
