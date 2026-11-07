const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const check = (name, ok, detail = '') => console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' — ' + detail : ''));
  let failed = false;
  const record = (name, ok, detail) => { check(name, ok, detail); if (!ok) failed = true; };
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => {
      localStorage.setItem('mnc_player_save_v1', JSON.stringify({ nickname: 'Saved Player', totalXP: 'broken', currentLevel: 'bad', history: {}, soundEnabled: 'yes' }));
    });
    await page.reload({ waitUntil: 'networkidle0' });
    const normalized = await page.evaluate(() => ({ text: document.body.innerText, save: JSON.parse(localStorage.getItem('mnc_player_save_v1')) }));
    record('Malformed field types fall back while valid progress survives', normalized.text.includes('Saved Player') && normalized.text.includes('0 XP') && normalized.save.nickname === 'Saved Player', 'nickname retained, invalid XP falls back');

    await page.evaluate(() => localStorage.setItem('mnc_player_save_v1', '{broken-json'));
    await page.reload({ waitUntil: 'networkidle0' });
    const preserved = await page.evaluate(() => ({ main: localStorage.getItem('mnc_player_save_v1'), backup: localStorage.getItem('mnc_player_save_v1_corrupt_backup') }));
    record('Unparseable save is preserved in a backup key', preserved.main === '{broken-json' && preserved.backup === '{broken-json');

    await page.click('#btn-nav-achievements');
    await sleep(250);
    record('Achievements navigation opens its screen', await page.evaluate(() => document.body.innerText.toLowerCase().includes('achievements & badges')));
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => /kembali|back/i.test(b.innerText))?.click());
    await sleep(250);

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-play-now');
    await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
    await page.click('#btn-hint');
    await sleep(200);
    const hintText = await page.$eval('#btn-hint', (el) => el.innerText);
    record('Hint applies without a missing audio method error', hintText.includes('Hint (1)') && errors.length === 0, hintText + (errors.length ? '; ' + errors.join('; ') : ''));

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-hardcore');
    await page.waitForSelector('button');
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('MULAI PERMAINAN'))?.click());
    await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
    const initialLives = await page.$eval('#lives-text', (el) => el.innerText.trim());
    const pool = await page.$('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])');
    await pool.click();
    await page.click('#btn-submit-answer');
    await page.waitForSelector('#btn-try-again', { timeout: 5000 });
    const hardcoreGameOver = await page.evaluate(() => document.body.innerText.includes('1 Kali Melakukan Kesalahan'));
    record('Hardcore ends on first wrong answer with one life', initialLives === '1 / 1' && hardcoreGameOver, initialLives);

    record('No uncaught browser errors', errors.length === 0, errors.join('; '));
  } catch (error) {
    record('Regression test execution', false, error.message);
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
