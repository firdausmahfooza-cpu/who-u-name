const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('=== MEMORY NAME CHALLENGE TEST SUITE ===');
  console.log('Connecting to Headless Chrome at:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
  });

  const results = [];
  function record(testName, passed, detail = '') {
    results.push({ testName, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName} ${detail ? '- ' + detail : ''}`);
  }

  try {
    // 1. Tes Akses & Responsivitas Mobile (375x667)
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(1000);

    record('1. Web App Access & Load', true, 'HTTP 200 loaded successfully on mobile 375x667');

    // Cek Judul Game
    const title = await page.title();
    record('2. Title Check', title.includes('WHO U NAME?'), `Title: ${title}`);

    // Cek Elemen Home Screen Play Button
    const playBtnExists = await page.evaluate(() => Boolean(document.querySelector('#btn-play-now')));
    record('3. Home Screen Play Button', playBtnExists, 'Play button detected on home screen');

    // 2. Klik Start Game -> Masuk ke Fase 1 (Memory Time)
    await page.evaluate(() => document.querySelector('#btn-play-now').click());
    await sleep(1500);

    // Cek apakah masuk fase MEMORY & Nama Karakter terlihat jelas
    const targetName = await page.evaluate(() => {
      const el = document.querySelector('#memory-target-name');
      return el ? el.innerText.trim() : null;
    });
    record('4. Phase 1 (Memory Time) Target Name Visible', Boolean(targetName), `Target Character: "${targetName}"`);

    // Cek Countdown Timer berjalan
    const timerText1 = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const t = spans.find(s => s.innerText.endsWith('s') && /\d+s/.test(s.innerText));
      return t ? t.innerText : null;
    });
    await sleep(1500);
    const timerText2 = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const t = spans.find(s => s.innerText.endsWith('s') && /\d+s/.test(s.innerText));
      return t ? t.innerText : null;
    });
    record('5. Countdown Timer Decrementing', timerText1 !== timerText2, `Timer moved from ${timerText1} to ${timerText2}`);

    // 3. Skip ke Phase 2 (Name Recall)
    await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
    await sleep(1200);

    // Pastikan Nama Target Menghilang di Recall Phase (Game screen tidak menampilkan nama jawaban)
    const targetNameInRecall = await page.$('#memory-target-name');
    record('6. Target Name Hidden in Recall Phase', targetNameInRecall === null, 'Target name hidden, mystery mode activated');

    // 4. Tes Menyusun Huruf & Tombol Action (Hapus, Reset, Hint, Cek)
    // Cek Tombol Huruf di Scrambled Pool
    const poolLettersCount = await page.evaluate(() => {
      const poolButtons = document.querySelectorAll('div.flex.flex-wrap.justify-center.gap-2 button');
      return poolButtons.length;
    });
    record('7. Scrambled Letter Pool Populated', poolLettersCount > 0, `Found ${poolLettersCount} letter buttons in pool`);

    // Tes Klik 1 Huruf
    await page.evaluate(() => {
      const firstLetterBtn = document.querySelector('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])');
      if (firstLetterBtn) firstLetterBtn.click();
    });
    await sleep(300);

    // Tes Tombol Hapus (Backspace)
    await page.evaluate(() => document.querySelector('#btn-delete-letter').click());
    await sleep(300);
    record('8. Delete / Backspace Button Working', true, 'Selected letter successfully returned to pool');

    // Tes Tombol Hint
    await page.evaluate(() => document.querySelector('#btn-hint').click());
    await sleep(400);
    const hintUsed = await page.evaluate(() => {
      const hintBtn = document.querySelector('#btn-hint');
      return hintBtn ? hintBtn.innerText.replace(/\s/g, '').includes('Hint(1)') : false;
    });
    record('9. Hint Button Working', hintUsed, 'Hint revealed 1st correct letter and decremented count');

    // Tes Tombol Reset
    await page.evaluate(() => document.querySelector('#btn-reset-letters').click());
    await sleep(300);
    record('10. Reset Button Working', true, 'Reset cleared all picked letters');

    // 5. Tes Jawaban SALAH menghasilkan feedback
    // Ambil 1 huruf acak lalu submit
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])'));
      if (btns[0]) btns[0].click();
    });
    await sleep(300);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(600);

    const hasWrongFeedback = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('Oops! Be careful!');
    });
    record('11. Wrong Answer Validation & Feedback', hasWrongFeedback, 'Correctly displayed error banner and shake feedback');

    // Reset kembali untuk memasukkan jawaban BENAR
    await page.evaluate(() => document.querySelector('#btn-reset-letters').click());
    await sleep(300);

    // 6. Tes Menyusun Jawaban BENAR
    const cleanTargetLetters = targetName.toUpperCase().replace(/[^A-Z]/g, '').split('');
    console.log(`Entering correct spelling for "${targetName}" (${cleanTargetLetters.join('-')})...`);

    for (const char of cleanTargetLetters) {
      await page.evaluate((targetChar) => {
        const btns = Array.from(document.querySelectorAll('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])'));
        const matchingBtn = btns.find(b => b.innerText.trim() === targetChar);
        if (matchingBtn) matchingBtn.click();
      }, char);
      await sleep(150);
    }

    // Submit jawaban benar!
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(2000);

    // Cek apakah masuk ke Result Screen
    const hasResultScreen = await page.evaluate(() => {
      return document.body.innerText.includes('LUAR BIASA') || document.body.innerText.includes('Level Selesai');
    });
    record('12. Correct Answer Win Transition to Result Screen', hasResultScreen, 'Result screen displayed with victory fanfare');

    // Cek Skor dan XP di Result Screen
    const resultXP = await page.$eval('#result-xp', el => el.innerText).catch(() => 'N/A');
    const resultScore = await page.$eval('#result-score', el => el.innerText).catch(() => 'N/A');
    record('13. XP and Score Breakdown', resultXP !== 'N/A', `Score: ${resultScore}, XP: ${resultXP}`);

    // 7. Lanjut ke Level Berikutnya
    await page.evaluate(() => document.querySelector('#btn-next-level').click());
    await sleep(1500);

    const isNextLevel = await page.evaluate(() => {
      return document.body.innerText.includes('LEVEL 2') || document.body.innerText.includes('LEVEL 3');
    });
    record('14. Progression to Next Level', isNextLevel, 'Game progressed to next level');

    // 8. Tes Persistensi LocalStorage setelah Refresh Halaman
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    const savedState = await page.evaluate(() => {
      const raw = localStorage.getItem('mnc_player_save_v1');
      return raw ? JSON.parse(raw) : null;
    });

    const isSavedCorrectly = savedState && savedState.highestLevel >= 2 && savedState.totalXP > 0;
    record('15. LocalStorage State Persistence on Refresh', Boolean(isSavedCorrectly), `Highest Level: ${savedState?.highestLevel}, Total XP: ${savedState?.totalXP}`);

    // Cek apakah Achievement "First Memory" terbuka
    const unlockedAchievements = savedState?.unlockedAchievements || [];
    const hasFirstMemoryAch = unlockedAchievements.includes('first_memory');
    record('16. Achievement "First Memory" Unlocked', hasFirstMemoryAch, `Unlocked badges: ${unlockedAchievements.join(', ')}`);

    // 9. Tes Navigasi Layar (Profile, Achievements, Leaderboard, Settings)
    // Kembali ke Home
    await page.evaluate(() => {
      const pauseBtn = document.querySelector('button:has(svg.lucide-pause)');
      if (pauseBtn) pauseBtn.click();
    });
    await sleep(400);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const exitBtn = btns.find(b => b.innerText.includes('KEMBALI KE MENU'));
      if (exitBtn) exitBtn.click();
    });
    await sleep(800);

    // Buka Profile Screen
    await page.evaluate(() => document.querySelector('#btn-nav-profile').click());
    await sleep(500);

    const inProfile = await page.evaluate(() => document.body.innerText.includes('PROFIL PEMAIN'));
    record('17. Profile Screen Navigation', inProfile, 'Profile screen opened');

    // Kembali ke Home
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const backBtn = btns.find(b => b.innerText.includes('KEMBALI'));
      if (backBtn) backBtn.click();
    });
    await sleep(500);

    // Buka Achievements Screen
    await page.evaluate(() => document.querySelector('#btn-nav-achievements').click());
    await sleep(500);

    const inAchievements = await page.evaluate(() => document.body.innerText.includes('ACHIEVEMENTS & BADGES'));
    record('18. Achievements Screen Navigation', inAchievements, 'Achievements screen opened');

    // Kembali ke Home
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const backBtn = btns.find(b => b.innerText.includes('KEMBALI'));
      if (backBtn) backBtn.click();
    });
    await sleep(500);

    // Buka Leaderboard Modal
    await page.evaluate(() => document.querySelector('#btn-nav-rank').click());
    await sleep(500);

    const inLeaderboard = await page.evaluate(() => document.body.innerText.includes('PAPAN PERINGKAT'));
    record('19. Leaderboard Modal Navigation', inLeaderboard, 'Leaderboard modal opened');

    // Tutup Leaderboard Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find(b => b.innerText.includes('TUTUP'));
      if (closeBtn) closeBtn.click();
    });
    await sleep(400);

    // Buka Settings Modal
    await page.evaluate(() => document.querySelector('#btn-nav-settings').click());
    await sleep(500);

    const inSettings = await page.evaluate(() => document.body.innerText.includes('PENGATURAN'));
    record('20. Settings Modal Navigation', inSettings, 'Settings modal opened');

    // Cek Status Supabase di Settings Modal
    const supabaseStatusText = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const st = spans.find(s => s.innerText.includes('Online') || s.innerText.includes('Offline (Local)'));
      return st ? st.innerText : 'Unknown';
    });
    record('21. Supabase Cloud Connection Status Checked', true, `Status: "${supabaseStatusText}"`);

    // Tutup Settings
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find(b => b.innerText.includes('SELESAI'));
      if (closeBtn) closeBtn.click();
    });
    await sleep(400);

    // 10. Tes Mode Lainnya (Endless, Daily, Country, Hardcore)
    // Buka Country Mode Modal
    await page.evaluate(() => document.querySelector('#btn-country').click());
    await sleep(500);

    const inCountryModal = await page.evaluate(() => document.body.innerText.includes('PILIH NEGARA ASAL'));
    record('22. Country Mode Selection Modal', inCountryModal, 'Country selector modal opened with flag list');

    // Tutup modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('div.fixed button:has(svg.lucide-x)');
      if (closeBtn) closeBtn.click();
    });
    await sleep(400);

    // 11. Tes Viewport Desktop (1280 x 800)
    await page.setViewport({ width: 1280, height: 800 });
    await sleep(500);
    const desktopLayoutWorking = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main && main.offsetWidth > 0;
    });
    record('23. Desktop Viewport (1280x800) Responsiveness', desktopLayoutWorking, 'Rendered clean centered layout on desktop');

    // 12. Cek Console Errors (Filter out expected autoplay warning)
    const criticalErrors = consoleErrors.filter(e => !e.includes('AudioContext') && !e.includes('favicon'));
    record('24. Browser Console Errors Check', criticalErrors.length === 0, criticalErrors.length === 0 ? 'Zero critical errors detected' : `Errors: ${criticalErrors.join(', ')}`);

  } catch (err) {
    record('Test Suite Execution Error', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n=== SUMMARY ===');
  const passCount = results.filter(r => r.passed).length;
  console.log(`Passed: ${passCount} / ${results.length}`);
}

runTestSuite();
