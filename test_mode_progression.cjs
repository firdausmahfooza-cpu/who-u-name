const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    const native = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => native(callback, delay === 1000 ? 100 : delay, ...args);
  });
  let failed = false;
  const record = (name, ok, detail = '') => { console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' — ' + detail : '')); if (!ok) failed = true; };
  const readMemorizedNames = async () => page.evaluate(() => {
    const first = document.querySelector('#memory-target-name');
    if (!first) return [];
    const grid = first.closest('.grid');
    return grid ? Array.from(grid.children).map((card) => card.innerText.trim().split('\n')[0]) : [first.innerText.trim()];
  });
  const solveLevel = async (names) => {
    await page.waitForSelector('#btn-submit-answer', { timeout: 5000 });
    for (const name of names) {
      for (const letter of name.toUpperCase().replace(/[^A-Z]/g, '')) await page.keyboard.press(letter);
      await page.click('#btn-submit-answer');
      await sleep(1050);
    }
    await page.waitForSelector('#btn-next-level', { timeout: 4000 });
  };
  const start = async (modeId, countryName) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#' + modeId);
    if (countryName) await page.evaluate((name) => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes(name))?.click(), countryName);
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('MULAI PERMAINAN'))?.click());
    await page.waitForSelector('#memory-target-name', { timeout: 5000 });
    return readMemorizedNames();
  };
  try {
    const dailyFirst = await start('btn-daily');
    record('Daily starts with three characters', dailyFirst.length === 3, dailyFirst.join(', '));
    await solveLevel(dailyFirst);
    await page.click('#btn-next-level');
    await page.waitForSelector('#memory-target-name', { timeout: 4000 });
    const dailyNext = await readMemorizedNames();
    record('Daily keeps its three-character configuration on the next level', dailyNext.length === 3, dailyNext.join(', '));

    const countryFirst = await start('btn-country', 'Jepang');
    record('Country starts with two selected-country characters', countryFirst.length === 2, countryFirst.join(', '));
    await solveLevel(countryFirst);
    await page.click('#btn-next-level');
    await page.waitForSelector('#memory-target-name', { timeout: 4000 });
    const countryNext = await readMemorizedNames();
    const nextScreen = await page.evaluate(() => document.body.innerText);
    record('Country keeps two characters and Japan filter on the next level', countryNext.length === 2 && nextScreen.includes('🇯🇵'), countryNext.join(', '));
  } catch (error) {
    record('Mode progression execution', false, error.message);
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
