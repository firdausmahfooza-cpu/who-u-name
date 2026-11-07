const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runEliminationTests() {
  console.log('=== ELIMINATION SYSTEM (TWO MISTAKES & YOU\'RE OUT) TEST SUITE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });

  const results = [];
  function record(name, passed, detail = '') {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} ${detail ? '- ' + detail : ''}`);
  }

  try {
    // 1. Masuk Game
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    // Klik Mulai Level 1
    await page.evaluate(() => document.querySelector('#btn-play-now').click());
    await sleep(1500);

    // Simpan target name dari fase memory
    const targetName = await page.evaluate(() => {
      const el = document.querySelector('#memory-target-name');
      return el ? el.innerText.trim() : null;
    });
    record('1. Memory Phase Started', Boolean(targetName), `Target: "${targetName}"`);

    // Skip ke Recall Phase
    await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
    await sleep(1000);

    // 2. Cek Indikator Kesempatan Awal: Harus 2 Hati (2 Kesempatan)
    const livesStatusInitial = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('2 / 2');
    });
    record('2. Initial Hearts State (2 Lives)', livesStatusInitial, `Status: 2 Kesempatan Terpenuhi`);

    // 3. SKENARIO 1: Kesalahan Pertama
    console.log('Submitting 1st wrong answer...');
    // Pilih 1 huruf acak
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])'));
      if (btns[0]) btns[0].click();
    });
    await sleep(300);

    // Submit jawaban salah pertama
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(600);

    // Cek respon kesalahan pertama:
    // - Peringatan "Oops! Be careful!"
    // - Kesempatan berkurang jadi 1 / 2
    // - Permainan TIDAK Game Over (masih berlangsung)
    const feedbackBanner1 = await page.evaluate(() => {
      const el = document.querySelector('#recall-feedback-banner');
      return el ? el.innerText : '';
    });
    const isCarefulAlert = feedbackBanner1.includes('Oops! Be careful!');
    const is1LifeLeft = await page.evaluate(() => document.body.innerText.includes('1 / 2'));
    const isStillPlaying = !(await page.evaluate(() => document.body.innerText.includes("YOU'RE OUT!")));

    record('3. 1st Mistake - "Oops! Be careful!" Warning', isCarefulAlert, `Banner: "${feedbackBanner1}"`);
    record('4. 1st Mistake - Lost 1 Heart (1 / 2 Lives Left)', is1LifeLeft, 'Reduced from 2 to 1 heart');
    record('5. 1st Mistake - Game Continues', isStillPlaying, 'Game does not end on 1st error');

    // 4. SKENARIO 2: Kesalahan Kedua (Gugur / Elimination)
    console.log('Submitting 2nd wrong answer...');
    // Reset dan pilih 1 huruf lain yang salah
    await page.evaluate(() => document.querySelector('#btn-reset-letters').click());
    await sleep(300);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])'));
      if (btns[0]) btns[0].click();
    });
    await sleep(300);

    // Submit jawaban salah kedua
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(800);

    // Cek respon kesalahan kedua:
    // - Banner "YOU'RE OUT!"
    const feedbackBanner2 = await page.evaluate(() => {
      const el = document.querySelector('#recall-feedback-banner');
      return el ? el.innerText : '';
    });
    const isOutAlert = feedbackBanner2.includes("YOU'RE OUT!");
    record('6. 2nd Mistake - "YOU\'RE OUT!" Immediate Alert', isOutAlert, `Banner: "${feedbackBanner2}"`);

    // Tunggu transisi ke Game Over Modal Screen (delay 1300ms)
    await sleep(1500);

    // 5. Cek Game Over Screen Tampil Lengkap
    const hasGameOverScreen = await page.evaluate(() => {
      const txt = document.body.innerText.toUpperCase();
      return txt.includes("YOU'RE OUT") && txt.includes('GAGAL');
    });
    record('7. Dedicated Game Over Screen Displayed', hasGameOverScreen, 'Game Over screen rendered with Elimination header');

    // Cek Karakter yang Gagal Tampil Nama & Avatarnya
    const failedCharNameOnScreen = await page.evaluate(() => {
      return document.body.innerText;
    });
    const failedCharPresent = failedCharNameOnScreen.includes(targetName);
    record('8. Missed Character Shown on Game Over Screen', failedCharPresent, `Displayed "${targetName}"`);

    // Cek Rekor & Statistik di Game Over Screen
    const hasStats = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('Level Dicapai') && txt.includes('Total Skor') && txt.includes('Total XP');
    });
    record('9. Game Over Stats Displayed', hasStats, 'Level, Score, and XP stats visible');

    // 6. Cek Penyimpanan Rekor (Storage persistence despite game over)
    const savedState = await page.evaluate(() => {
      const raw = localStorage.getItem('mnc_player_save_v1');
      return raw ? JSON.parse(raw) : null;
    });
    const recordsPreserved = savedState && savedState.history && savedState.history.length > 0;
    record('10. Game Over Records & History Persisted', Boolean(recordsPreserved), `History count: ${savedState?.history?.length}, Highest Level: ${savedState?.highestLevel}`);

    // 7. SKENARIO 3: Tombol TRY AGAIN -> Reset Kesempatan ke 2 Hati
    console.log('Testing "TRY AGAIN" button...');
    await page.evaluate(() => document.querySelector('#btn-try-again').click());
    await sleep(1500);

    // Skip memory ke recall lagi
    await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
    await sleep(1000);

    // Cek kesempatan setelah Try Again: harus kembali 2 / 2 hati!
    const livesReset = await page.evaluate(() => document.body.innerText.includes('2 / 2'));
    record('11. Reset Lives on Try Again (2 / 2 Hearts)', livesReset, 'Lives successfully restored to 2');

  } catch (err) {
    record('Test Suite Error', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== SUMMARY ===');
  const passCount = results.filter(r => r.passed).length;
  console.log(`Passed: ${passCount} / ${results.length}`);
}

runEliminationTests();
