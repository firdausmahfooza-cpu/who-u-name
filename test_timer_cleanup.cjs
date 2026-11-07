const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTimerCleanupRegression() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 800 });

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0', timeout: 20000 });
    await page.click('#btn-play-now');
    await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });

    const submitWrongAnswer = async () => {
      await page.waitForFunction(() => {
        const pool = document.querySelector('div.flex.flex-wrap.justify-center.gap-2');
        return pool && pool.querySelectorAll('button:not([disabled])').length > 0;
      }, { timeout: 5000 });
      await page.evaluate(() => {
        const pool = document.querySelector('div.flex.flex-wrap.justify-center.gap-2');
        pool.querySelector('button:not([disabled])').click();
      });
      await page.click('#btn-submit-answer');
    };

    await submitWrongAnswer();
    await page.waitForFunction(() => document.querySelector('#lives-text')?.innerText.includes('1 / 2'), { timeout: 3000 });
    await sleep(1300);
    await submitWrongAnswer();
    await page.waitForFunction(() => document.querySelector('#lives-text')?.innerText.includes('0 / 2'), { timeout: 3000 });

    await page.click('button[title="Jeda"]');
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((button) => button.innerText.trim() === 'KEMBALI KE MENU')?.click());
    await sleep(1500);

    const stayedHome = await page.evaluate(() =>
      Boolean(document.querySelector('#btn-play-now')) && !document.querySelector('#btn-game-over-home')
    );
    console.log('[' + (stayedHome ? 'PASS' : 'FAIL') + '] Leaving during pending Game Over callback stays on Home');
    if (!stayedHome) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTimerCleanupRegression().catch((error) => {
  console.error('[FAIL] Timer cleanup regression:', error);
  process.exitCode = 1;
});
