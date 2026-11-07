const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 1000));
  console.log('Clicking #btn-play-now...');
  await page.click('#btn-play-now');
  await new Promise(r => setTimeout(r, 1500));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('TEXT AFTER CLICK:', text);

  const el = await page.$('#memory-target-name');
  console.log('Element found:', Boolean(el));

  await browser.close();
})();
