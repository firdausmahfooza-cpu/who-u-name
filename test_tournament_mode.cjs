const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    const native = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => native(callback, delay === 1000 ? 50 : delay, ...args);
  });
  const record = (label, pass, detail = '') => console.log('[' + (pass ? 'PASS' : 'FAIL') + '] ' + label + (detail ? ' — ' + detail : ''));
  let failed = false;
  const check = (label, pass, detail) => { record(label, pass, detail); if (!pass) failed = true; };
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-tournament');
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('MULAI PERMAINAN'))?.click());
    await page.waitForSelector('#tournament-recall', { timeout: 6000 });
    check('Tournament launches its dedicated face recall screen', true);

    for (let round = 0; round < 2; round++) {
      const count = round === 0 ? 15 : 10;
      for (let i = 0; i < count; i++) {
        await page.waitForSelector('#tournament-recall', { timeout: 8000 });
        const id = await page.$eval('#tournament-recall', (element) => element.dataset.tournamentCharacterId);
        await page.click('button[data-option-id="' + id + '"]');
        await sleep(20);
      }
      if (round === 0) await page.waitForSelector('#tournament-recall', { timeout: 8000 });
    }
    await page.waitForFunction(() => document.body.innerText.includes('TOURNAMENT SELESAI'), { timeout: 8000 });
    const outcome = await page.evaluate(() => ({ text: document.body.innerText, save: JSON.parse(localStorage.getItem('mnc_player_save_v1')) }));
    check('All 25 tournament recall questions score against the matching names', outcome.text.includes('60') && outcome.text.includes('100%') && outcome.save.totalScore === 60 && outcome.save.accuracy === 100, 'score=' + outcome.save.totalScore + ', accuracy=' + outcome.save.accuracy);
    check('Tournament updates games played and saved history', outcome.save.gamesPlayed === 1 && outcome.save.history?.[0]?.mode === 'TOURNAMENT');
    check('Tournament has no uncaught browser errors', errors.length === 0, errors.join('; '));
  } catch (error) {
    check('Tournament test execution', false, error.message);
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
