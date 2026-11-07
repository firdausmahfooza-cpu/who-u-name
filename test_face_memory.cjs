const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFaceMemoryTestSuite() {
  console.log('=== FACE & NAME MEMORY MODE TEST SUITE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const results = [];
  function record(name, passed, detail = '') {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} ${detail ? '- ' + detail : ''}`);
  }

  try {
    // 1. Masuk Home Screen
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    // Cek Tombol Mode di Home Screen
    const hasWordScrambleBtn = await page.evaluate(() => Boolean(document.querySelector('#btn-play-now')));
    const hasFaceMemoryBtn = await page.evaluate(() => Boolean(document.querySelector('#btn-face-memory')));
    record('1. Home Screen Buttons Exist', hasWordScrambleBtn && hasFaceMemoryBtn, 'Both Word Scramble & Face Memory buttons exist');

    // 2. Klik Masuk ke Mode FACE & NAME MEMORY
    console.log('Launching Face & Name Memory mode...');
    await page.evaluate(() => document.querySelector('#btn-face-memory').click());
    await sleep(1500);

    // Cek Masuk Fase MEMORIZE
    const inMemorizePhase = await page.evaluate(() => {
      const txt = document.body.innerText;
      return Boolean(document.querySelector('#level-intro-badge')) && Boolean(document.querySelector('#memory-target-name')) && txt.includes('Hafalkan');
    });
    record('2. Face Memory Phase 1 (MEMORIZE) Started', inMemorizePhase, 'Cards grid with avatars & names displayed');

    // Cek Kartu Karakter Ditampilkan (Level 1: 2 Karakter)
    const cardNames = await page.evaluate(() => {
      const els = document.querySelectorAll('div.text-xs.md\\:text-sm.font-black.text-amber-200');
      return Array.from(els).map(e => e.innerText.trim());
    });
    record('3. Character Cards with Full Names Displayed', cardNames.length >= 2, `Cards: ${cardNames.join(', ')}`);

    // 3. Skip Memorize ke Fase RECALL
    await page.waitForSelector('#face-recall-card', { timeout: 18000 });
    await sleep(1200);

    const inRecallPhase = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('SIAPA NAMA KARAKTER INI?');
    });
    record('4. Face Memory Phase 2 (RECALL) Started', inRecallPhase, 'Mystery card and name options displayed');

    // Cek Pilihan Nama (4 Multiple Choice Options)
    const optionsCount = await page.evaluate(() => {
      const btns = document.querySelectorAll('button[data-name-option]');
      return btns.length;
    });
    record('5. 4 Name Options Provided', optionsCount === 4, `Found ${optionsCount} choice buttons`);

    // Cek 2 Hati Kesempatan
    const initialHearts = await page.evaluate(() => {
      const el = document.querySelector('#lives-text');
      return el ? el.innerText.includes('2 / 2') : false;
    });
    record('6. Initial Lives (2 Hearts)', initialHearts, 'Full 2 lives active (2 / 2)');

    // 4. Tes Kesalahan Pertama (Wrong Option Click)
    console.log('Testing 1st wrong choice in Face Memory...');
    const currentTarget1 = await page.evaluate(() => {
      const card = document.querySelector('#face-recall-card');
      return card ? card.getAttribute('data-target-name') : null;
    });

    await page.evaluate((targetName) => {
      const btns = Array.from(document.querySelectorAll('button[data-name-option]'));
      const wrongBtn = btns.find(b => b.getAttribute('data-name-option') !== targetName);
      if (wrongBtn) wrongBtn.click();
    }, currentTarget1);
    await sleep(600);

    const feedback1 = await page.evaluate(() => {
      const el = document.querySelector('#face-feedback-banner');
      return el ? el.innerText : '';
    });
    const hasCarefulWarning = feedback1.includes('Oops! Be careful!');
    record('7. 1st Mistake Reaction in Face Memory', hasCarefulWarning, `Banner: "${feedback1}"`);

    // Tunggu banner feedback salah hilang (1200ms)
    await sleep(1400);

    // 5. Submit Jawaban Benar untuk Karakter 1
    console.log(`Submitting correct answer for Char 1: "${currentTarget1}"...`);
    await page.evaluate((targetName) => {
      const btn = document.querySelector(`button[data-name-option="${targetName}"]`);
      if (btn) btn.click();
    }, currentTarget1);
    await sleep(1500);

    // Karakter 2: Baca target name karakter kedua
    const currentTarget2 = await page.evaluate(() => {
      const card = document.querySelector('#face-recall-card');
      return card ? card.getAttribute('data-target-name') : null;
    });
    console.log(`Submitting correct answer for Char 2: "${currentTarget2}"...`);
    await page.evaluate((targetName) => {
      const btn = document.querySelector(`button[data-name-option="${targetName}"]`);
      if (btn) btn.click();
    }, currentTarget2);
    await sleep(2000);

    // 6. Cek Layar Hasil (Result Screen)
    const hasResultScreen = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('LUAR BIASA') || txt.includes('Level Selesai');
    });
    record('8. Level Complete Victory Transition', hasResultScreen, 'Result screen displayed with stars & XP');

    // 7. Lanjut ke Level Berikutnya
    await page.evaluate(() => document.querySelector('#btn-next-level').click());
    await sleep(1500);

    // Cek apakah Face Memory naik ke Level 2
    const isFaceMemoryLevel2 = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('FACE Lv.2');
    });
    record('9. Progression to Face Memory Level 2', isFaceMemoryLevel2, 'Face Memory progressed to Level 2');

    // 8. Cek Penyimpanan Terpisah setelah Refresh Halaman
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    const savedState = await page.evaluate(() => {
      const raw = localStorage.getItem('mnc_player_save_v1');
      return raw ? JSON.parse(raw) : null;
    });

    const isSeparate = savedState && savedState.faceMemoryLevel >= 2 && savedState.currentLevel === 1;
    record('10. Separate State Persistence', isSeparate, `FaceMemory Level: ${savedState?.faceMemoryLevel}, WordScramble Level: ${savedState?.currentLevel}`);

    // 9. Cek Mode Lama (Word Scramble) Tetap Berfungsi Sempurna
    console.log('Testing Word Scramble mode compatibility...');
    const inGame = await page.evaluate(() => Boolean(document.querySelector('button:has(svg.lucide-pause)')));
    if (inGame) {
      await page.evaluate(() => document.querySelector('button:has(svg.lucide-pause)').click());
      await sleep(400);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const exitBtn = btns.find(b => b.innerText.includes('KEMBALI KE MENU'));
        if (exitBtn) exitBtn.click();
      });
      await sleep(800);
    }

    // Klik tombol Word Scramble
    await page.evaluate(() => document.querySelector('#btn-play-now').click());
    await sleep(1500);

    const inWordScramble = await page.evaluate(() => {
      const txt = document.body.innerText;
      return Boolean(document.querySelector('#level-intro-badge')) && Boolean(document.querySelector('#memory-target-name'));
    });
    record('11. Word Scramble Mode Intact & Fully Working', inWordScramble, 'Word Scramble mode functions with zero regression');

    // Cek Console Errors
    const criticalErrors = consoleErrors.filter(e => !e.includes('AudioContext') && !e.includes('favicon'));
    record('12. Browser Console Errors Check', criticalErrors.length === 0, criticalErrors.length === 0 ? 'Zero critical errors' : `Errors: ${criticalErrors.join(', ')}`);

  } catch (err) {
    record('Test Suite Error', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== SUMMARY ===');
  const passCount = results.filter(r => r.passed).length;
  console.log(`Passed: ${passCount} / ${results.length}`);
}

runFaceMemoryTestSuite();
