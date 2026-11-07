const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const results = [];
  const record = (name, pass, detail = '') => { results.push(pass); console.log('[' + (pass ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' — ' + detail : '')); };
  const startMode = async (buttonId, country) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#' + buttonId);
    if (country) await page.evaluate((name) => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes(name))?.click(), country);
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('MULAI PERMAINAN'))?.click());
    await page.waitForSelector('#lives-text', { timeout: 5000 });
    await sleep(1350);
    return page.evaluate(() => ({ text: document.body.innerText, hasMemorize: Boolean(document.querySelector('#memory-target-name')) }));
  };
  try {
    const daily = await startMode('btn-daily');
    record('Daily mode opens the word scramble game', daily.text.includes('DAILY') && daily.hasMemorize);
    const country = await startMode('btn-country', 'Jepang');
    record('Country mode opens after country selection', country.text.includes('COUNTRY') && country.hasMemorize && country.text.includes('🇯🇵'));
    const endless = await startMode('btn-endless');
    record('Endless mode opens the game screen', endless.text.includes('ENDLESS') && endless.hasMemorize);
  } catch (error) {
    record('Mode smoke test execution', false, error.message);
  } finally {
    await browser.close();
  }
  if (results.some((pass) => !pass)) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
