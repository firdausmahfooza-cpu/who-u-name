const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });

  page.on('console', msg => console.log('LOG:', msg.text()));

  await page.goto(APP_URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Level 1: Klik Play
  console.log('--- STARTING LEVEL 1 ---');
  await page.evaluate(() => document.querySelector('#btn-play-now').click());
  await new Promise(r => setTimeout(r, 1000));

  let bodyText = await page.evaluate(() => document.body.innerText);
  console.log('LEVEL 1 INITIAL PHASE TEXT:\n', bodyText.substring(0, 150));

  const targetName1 = await page.evaluate(() => {
    const el = document.querySelector('#memory-target-name');
    return el ? el.innerText.trim() : null;
  });
  console.log('Level 1 targetName:', targetName1);

  // Skip memory or wait for recall
  await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
  await new Promise(r => setTimeout(r, 500));

  // Ketik jawaban benar
  const cleanTargetLetters = targetName1.toUpperCase().replace(/[^A-Z]/g, '').split('');
  for (const char of cleanTargetLetters) {
    await page.evaluate((targetChar) => {
      const btns = Array.from(document.querySelectorAll('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])'));
      const matchingBtn = btns.find(b => b.innerText.trim() === targetChar);
      if (matchingBtn) matchingBtn.click();
    }, char);
    await new Promise(r => setTimeout(r, 100));
  }
  await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
  await new Promise(r => setTimeout(r, 2000));

  console.log('--- ON RESULT SCREEN ---');
  // Klik Next Level
  console.log('Clicking #btn-next-level...');
  await page.evaluate(() => document.querySelector('#btn-next-level').click());
  await new Promise(r => setTimeout(r, 1000));

  console.log('--- ENTERED LEVEL 2 ---');
  bodyText = await page.evaluate(() => document.body.innerText);
  console.log('LEVEL 2 BODY TEXT (first 300 chars):\n', bodyText.substring(0, 300));

  const hasMemoryTarget = await page.evaluate(() => Boolean(document.querySelector('#memory-target-name')));
  const isRecallPhase = await page.evaluate(() => document.body.innerText.includes('SIAPA NAMAKU?'));
  console.log('Has #memory-target-name in Level 2:', hasMemoryTarget);
  console.log('Is in Recall phase immediately in Level 2:', isRecallPhase);

  await browser.close();
})();
