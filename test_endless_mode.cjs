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
    window.setInterval = (callback, delay, ...args) => native(callback, delay === 1000 ? 60 : delay, ...args);
  });
  const record = (label, pass, detail = '') => console.log('[' + (pass ? 'PASS' : 'FAIL') + '] ' + label + (detail ? ' — ' + detail : ''));
  let failed = false;
  const check = (label, pass, detail) => { record(label, pass, detail); if (!pass) failed = true; };
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-endless');
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('MULAI PERMAINAN'))?.click());
    await page.waitForSelector('#memory-target-name', { timeout: 5000 });
    const name = await page.$eval('#memory-target-name', (el) => el.innerText.trim());
    await page.waitForSelector('#btn-submit-answer', { timeout: 5000 });
    const firstLetterButton = await page.$('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])');
    await firstLetterButton.click();
    await page.click('#btn-submit-answer');
    await page.waitForFunction(() => document.querySelector('#lives-text')?.innerText.includes('1 / 2'), { timeout: 3000 });
    check('Endless keeps its two-heart system after one mistake', true);
    await page.waitForFunction(() => !document.querySelector('#recall-feedback-banner'), { timeout: 3000 });
    await page.click('#btn-reset-letters');
    for (const letter of name.toUpperCase().replace(/[^A-Z]/g, '')) await page.keyboard.press(letter);
    await page.click('#btn-submit-answer');
    await page.waitForSelector('#level-intro-badge[data-level="2"]', { timeout: 5000 }).catch(async (error) => { console.log('DEBUG_STATE', await page.evaluate(() => ({ text: document.body.innerText.slice(-1200), slots: document.querySelectorAll('button:disabled').length, lives: document.querySelector('#lives-text')?.innerText, stored: localStorage.getItem('mnc_player_save_v1') })), errors); throw error; });
    const state = await page.evaluate(() => ({ lives: document.querySelector('#lives-text')?.innerText.trim(), hasResult: Boolean(document.querySelector('#btn-next-level')), save: JSON.parse(localStorage.getItem('mnc_player_save_v1')) }));
    check('Endless advances automatically and carries remaining heart', state.lives === '1 / 2' && !state.hasResult, 'lives=' + state.lives);
    check('Endless awards promised 750 points and 200 XP for the character', state.save.totalScore === 750 && state.save.totalXP >= 200, 'score=' + state.save.totalScore + ', XP=' + state.save.totalXP);
    check('Endless best score and Games Played are saved once', state.save.endlessBestScore === 750 && state.save.gamesPlayed === 1);
    check('No uncaught browser errors', errors.length === 0, errors.join('; '));
  } catch (error) {
    check('Endless regression execution', false, error.message);
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
