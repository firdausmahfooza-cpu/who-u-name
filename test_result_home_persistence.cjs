const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    const native = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => native(callback, delay === 1000 ? 30 : delay, ...args);
  });
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-play-now');
    const name = await page.$eval('#memory-target-name', (el) => el.innerText.trim());
    await page.waitForSelector('#btn-submit-answer', { timeout: 5000 });
    for (const letter of name.toUpperCase().replace(/[^A-Z]/g, '')) await page.keyboard.press(letter);
    await page.click('#btn-submit-answer');
    await page.waitForSelector('#btn-next-level', { timeout: 3000 });
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('Menu Utama'))?.click());
    await page.waitForSelector('#btn-play-now', { timeout: 3000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mnc_player_save_v1')));
    const passed = saved.totalXP > 0 && saved.totalScore > 0 && saved.currentLevel === 2 && saved.totalCompletedLevels === 1 && saved.gamesPlayed === 1;
    console.log('[' + (passed ? 'PASS' : 'FAIL') + '] Leaving Results via Home commits completed rewards once — XP=' + saved.totalXP + ', score=' + saved.totalScore + ', level=' + saved.currentLevel + ', games=' + saved.gamesPlayed);
    await page.reload({ waitUntil: 'networkidle0' });
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('mnc_player_save_v1')));
    const refreshPass = persisted.totalXP === saved.totalXP && persisted.totalScore === saved.totalScore && persisted.currentLevel === 2;
    console.log('[' + (refreshPass ? 'PASS' : 'FAIL') + '] Result rewards and next level survive refresh');
    if (!passed || !refreshPass) process.exitCode = 1;
  } catch (error) {
    console.log('[FAIL] Result-to-Home persistence test — ' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
