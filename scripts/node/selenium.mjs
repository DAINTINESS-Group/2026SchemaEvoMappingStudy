import { Builder, Browser, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

async function getChromeDriver() {

    const options = new chrome.Options();

    //options.setChromeBinaryPath('./chrome-win64');

    options.setUserPreferences({
        'download.default_directory': './',
        'download.prompt_for_download': false,
        'download.directory_upgrade': true,
        'plugins.always_open_pdf_externally': true
    });

    let driver = await new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(options)
        .build();

    return driver;
}

export {getChromeDriver}