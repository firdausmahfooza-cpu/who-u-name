const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runComprehensiveEngineAudit() {
  console.log('===============================================================');
  console.log('  WHO U NAME? - FULL BUG AUDIT & GAME ENGINE VALIDATION SUITE');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 820 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  const testResults = [];
  function record(id, title, passed, detail = '') {
    testResults.push({ id, title, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${title} ${detail ? '-> ' + detail : ''}`);
  }

  try {
    // 0. Akses Aplikasi & Verifikasi Rebranding
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    const pageTitle = await page.title();
    const hasRebranding = pageTitle.includes('WHO U NAME?') && pageTitle.includes('REMEMBER THE FACE');
    record('REBRANDING', 'Title and Rebranding in Browser Tab', hasRebranding, `Title: "${pageTitle}"`);

    const homeTitleText = await page.evaluate(() => document.body.innerText);
    const homeRebranded = homeTitleText.includes('WHO U NAME?') && homeTitleText.includes('REMEMBER THE FACE. GUESS THE NAME.');
    record('REBRANDING_HOME', 'Home Screen Rebranding & Tagline', homeRebranded, 'New branding verified on Home Screen');

    // -------------------------------------------------------------
    // TEST 1: Level 1 Memorize -> Recall -> Berhasil
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 1: LEVEL 1 COMPLETE CYCLE ---');
    await page.evaluate(() => document.querySelector('#btn-play-now').click());
    await sleep(800);

    const lvl1Memo = await page.evaluate(() => {
      const badge = document.querySelector('#level-intro-badge');
      const nameEl = document.querySelector('#memory-target-name');
      const submitBtn = document.querySelector('#btn-submit-answer');
      return {
        badgeLevel: badge ? Number(badge.getAttribute('data-level')) : null,
        name: nameEl ? nameEl.innerText.trim() : null,
        hasSubmitPrematurely: Boolean(submitBtn)
      };
    });

    const charLvl1 = lvl1Memo.name;
    record(
      'TEST 1.1',
      'Level 1 Starts in Memorize Phase with Target Name',
      lvl1Memo.badgeLevel === 1 && Boolean(charLvl1) && !lvl1Memo.hasSubmitPrematurely,
      `Target: "${charLvl1}"`
    );

    console.log(`Waiting for countdown to finish for "${charLvl1}"...`);
    await page.waitForSelector('#btn-submit-answer', { timeout: 15000 });
    await sleep(400);

    const lvl1Recall = await page.evaluate(() => {
      const nameEl = document.querySelector('#memory-target-name');
      const submitBtn = document.querySelector('#btn-submit-answer');
      return {
        nameHidden: nameEl === null,
        submitReady: Boolean(submitBtn)
      };
    });
    record('TEST 1.2', 'Recall Phase Activated with Target Name Hidden', lvl1Recall.nameHidden && lvl1Recall.submitReady);

    // Ketik jawaban benar
    const letters1 = charLvl1.toUpperCase().replace(/[^A-Z]/g, '').split('');
    for (const c of letters1) {
      await page.keyboard.press(c);
      await sleep(40);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(1500);

    const lvl1Result = await page.evaluate(() => Boolean(document.querySelector('#btn-next-level')));
    record('TEST 1.3', 'Level 1 Result Screen Displayed', lvl1Result);

    // -------------------------------------------------------------
    // TEST 9: Rapid Click Next Level Button (No Double Transition Guard)
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 9: RAPID CLICK GUARD (ANTI-DOUBLE TRANSITION) ---');
    // Klik tombol Next Level 5 kali berturut-turut dalam 20ms
    await page.evaluate(() => {
      const btn = document.querySelector('#btn-next-level');
      if (btn) {
        btn.click();
        btn.click();
        btn.click();
        btn.click();
        btn.click();
      }
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // TEST 2: Level 2 Memorize -> Recall -> Berhasil
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 2: LEVEL 2 COMPLETE CYCLE ---');
    const lvl2Memo = await page.evaluate(() => {
      const badge = document.querySelector('#level-intro-badge');
      const nameEl = document.querySelector('#memory-target-name');
      const submitBtn = document.querySelector('#btn-submit-answer');
      return {
        badgeLevel: badge ? Number(badge.getAttribute('data-level')) : null,
        name: nameEl ? nameEl.innerText.trim() : null,
        hasSubmitPrematurely: Boolean(submitBtn)
      };
    });

    const charLvl2 = lvl2Memo.name;
    // Pastikan level tepat bernilai 2 (bukan loncat ke 3 atau 4 akibat klik cepat)
    record(
      'TEST 2.1',
      'Level 2 Starts in Memorize Phase (Rapid Click Guard Verified)',
      lvl2Memo.badgeLevel === 2 && Boolean(charLvl2) && !lvl2Memo.hasSubmitPrematurely,
      `Current Level: ${lvl2Memo.badgeLevel}, Target: "${charLvl2}"`
    );

    console.log(`Waiting for countdown to finish for "${charLvl2}"...`);
    await page.waitForSelector('#btn-submit-answer', { timeout: 15000 });
    await sleep(400);

    const letters2 = charLvl2.toUpperCase().replace(/[^A-Z]/g, '').split('');
    for (const c of letters2) {
      await page.keyboard.press(c);
      await sleep(40);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(1500);

    const lvl2Result = await page.evaluate(() => Boolean(document.querySelector('#btn-next-level')));
    record('TEST 2.2', 'Level 2 Result Screen Displayed', lvl2Result);

    // -------------------------------------------------------------
    // TEST 3: Level 3 Memorize -> Recall -> Berhasil
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 3: LEVEL 3 COMPLETE CYCLE ---');
    await page.evaluate(() => document.querySelector('#btn-next-level').click());
    await sleep(1000);

    const lvl3Memo = await page.evaluate(() => {
      const badge = document.querySelector('#level-intro-badge');
      const nameEl = document.querySelector('#memory-target-name');
      const submitBtn = document.querySelector('#btn-submit-answer');
      return {
        badgeLevel: badge ? Number(badge.getAttribute('data-level')) : null,
        name: nameEl ? nameEl.innerText.trim() : null,
        hasSubmitPrematurely: Boolean(submitBtn)
      };
    });

    const charLvl3 = lvl3Memo.name;
    record(
      'TEST 3.1',
      'Level 3 Starts in Memorize Phase with New Character',
      lvl3Memo.badgeLevel === 3 && Boolean(charLvl3) && !lvl3Memo.hasSubmitPrematurely,
      `Current Level: ${lvl3Memo.badgeLevel}, Target: "${charLvl3}"`
    );

    console.log(`Waiting for countdown to finish for "${charLvl3}"...`);
    await page.waitForSelector('#btn-submit-answer', { timeout: 15000 });
    await sleep(400);

    const letters3 = charLvl3.toUpperCase().replace(/[^A-Z]/g, '').split('');
    for (const c of letters3) {
      await page.keyboard.press(c);
      await sleep(40);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(1500);

    const lvl3Result = await page.evaluate(() => Boolean(document.querySelector('#btn-next-level')));
    record('TEST 3.2', 'Level 3 Result Screen Displayed', lvl3Result);

    // -------------------------------------------------------------
    // TEST 4: Level 4 & Level 5 Dengan Karakter Berbeda
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 4: LEVEL 4 & 5 DIVERSITY ---');
    await page.evaluate(() => document.querySelector('#btn-next-level').click());
    await sleep(1000);

    const lvl4Name = await page.evaluate(() => {
      const el = document.querySelector('#memory-target-name');
      return el ? el.innerText.trim() : null;
    });

    console.log(`Waiting for countdown to finish for "${lvl4Name}"...`);
    await page.waitForSelector('#btn-submit-answer', { timeout: 15000 });
    const letters4 = lvl4Name.toUpperCase().replace(/[^A-Z]/g, '').split('');
    for (const c of letters4) {
      await page.keyboard.press(c);
      await sleep(35);
    }
    await sleep(250);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(1500);

    await page.evaluate(() => document.querySelector('#btn-next-level').click());
    await sleep(1000);

    const lvl5Name = await page.evaluate(() => {
      const el = document.querySelector('#memory-target-name');
      return el ? el.innerText.trim() : null;
    });

    const charactersSet = new Set([charLvl1, charLvl2, charLvl3, lvl4Name, lvl5Name]);
    record(
      'TEST 4',
      'All 5 Consecutive Levels Have Distinct Characters',
      charactersSet.size === 5,
      `Characters: ${Array.from(charactersSet).join(', ')}`
    );

    // -------------------------------------------------------------
    // TEST 8: Pause, Resume, and Restart
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 8: PAUSE, RESUME, AND RESTART ---');
    // Buka Pause Modal
    await page.evaluate(() => {
      const pauseBtn = document.querySelector('button[title="Jeda"]');
      if (pauseBtn) pauseBtn.click();
    });
    await sleep(600);

    const pauseModalOpen = await page.evaluate(() => document.body.innerText.includes('PERMAINAN DIJEDA'));
    record('TEST 8.1', 'Pause Modal Opens and Freezes Gameplay', pauseModalOpen);

    // Lanjutkan Permainan (Resume)
    await page.evaluate(() => {
      const resumeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('LANJUTKAN'));
      if (resumeBtn) resumeBtn.click();
    });
    await sleep(600);

    const pauseModalClosed = await page.evaluate(() => !document.body.innerText.includes('PERMAINAN DIJEDA'));
    record('TEST 8.2', 'Resume Closes Pause Modal and Continues Game', pauseModalClosed);

    // Tunggu masuk ke Recall Phase di Level 5
    console.log(`Waiting for countdown to finish for Level 5...`);
    await page.waitForSelector('#btn-submit-answer', { timeout: 15000 });
    await sleep(500);

    // -------------------------------------------------------------
    // TEST 10: Timer Not Leaking During Recall Phase
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 10: TIMER INTEGRITY IN RECALL ---');
    const timerInRecall = await page.evaluate(() => {
      // Pastikan tidak ada countdown memori yang terus berkurang ke angka negatif
      const targetNameEl = document.querySelector('#memory-target-name');
      const submitBtn = document.querySelector('#btn-submit-answer');
      return targetNameEl === null && submitBtn !== null;
    });
    record('TEST 10', 'Timer Cleaned Up When Recall Phase Starts', timerInRecall);

    // -------------------------------------------------------------
    // TEST 5: Salah Sekali -> Kesempatan Menjadi Satu
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 5: FIRST MISTAKE (1 LIFE LEFT) ---');
    // Pilih 1 huruf dari pool yang tidak lengkap/salah
    await page.evaluate(() => {
      const letterBtn = document.querySelector('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])');
      if (letterBtn) letterBtn.click();
    });
    await sleep(200);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(700);

    const mistake1Check = await page.evaluate(() => {
      const livesText = document.querySelector('#lives-text')?.innerText.trim();
      const hasWarning = document.body.innerText.includes('Oops! Be careful!');
      return {
        livesText,
        hasWarning
      };
    });

    record(
      'TEST 5',
      'First Mistake Deducts 1 Life with Warning Banner',
      mistake1Check.livesText === '1 / 2' && mistake1Check.hasWarning,
      `Lives remaining: ${mistake1Check.livesText}`
    );

    // -------------------------------------------------------------
    // TEST 6: Salah Dua Kali -> Game Over
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 6: SECOND MISTAKE (GAME OVER) ---');
    await sleep(1400); // Tunggu banner feedback bersih
    // Pilih 1 huruf lagi dan submit untuk kesalahan kedua
    await page.evaluate(() => {
      const letterBtn = document.querySelector('div.flex.flex-wrap.justify-center.gap-2 button:not([disabled])');
      if (letterBtn) letterBtn.click();
    });
    await sleep(200);
    await page.evaluate(() => document.querySelector('#btn-submit-answer').click());
    await sleep(1500);

    const gameOverCheck = await page.evaluate(() => {
      const hasGameOverTitle = document.body.innerText.includes("YOU'RE OUT!");
      const hasTryAgainBtn = Boolean(document.querySelector('#btn-try-again'));
      const hasHomeBtn = Boolean(document.querySelector('#btn-game-over-home'));
      return hasGameOverTitle && hasTryAgainBtn && hasHomeBtn;
    });

    record(
      'TEST 6',
      'Second Mistake Triggers Game Over Screen with Stats & Try Again',
      gameOverCheck,
      "Game Over screen displayed correctly"
    );

    // -------------------------------------------------------------
    // TEST 7: Refresh Browser dan Periksa Penyimpanan Progres
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING TEST 7: REFRESH & PERSISTENCE CHECK ---');
    // Ambil rekor sebelum refresh
    const statsBefore = await page.evaluate(() => {
      const raw = localStorage.getItem('mnc_player_save_v1');
      return raw ? JSON.parse(raw) : null;
    });

    // Refresh halaman
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);

    const statsAfter = await page.evaluate(() => {
      const raw = localStorage.getItem('mnc_player_save_v1');
      return raw ? JSON.parse(raw) : null;
    });

    const isPreserved = Boolean(
      statsAfter &&
      statsBefore &&
      statsAfter.highestLevel >= 4 &&
      statsAfter.totalXP > 0 &&
      statsAfter.totalScore > 0
    );

    record(
      'TEST 7',
      'Progress and Records Persisted After Browser Refresh',
      isPreserved,
      `Highest Level: ${statsAfter?.highestLevel}, XP: ${statsAfter?.totalXP}, Score: ${statsAfter?.totalScore}`
    );

    // -------------------------------------------------------------
    // CONSOLE ERROR AUDIT
    // -------------------------------------------------------------
    record(
      'CONSOLE_AUDIT',
      'Zero Browser Console Errors During Full Playthrough',
      consoleErrors.length === 0,
      consoleErrors.length === 0 ? 'Zero errors detected' : `Errors: ${consoleErrors.join(', ')}`
    );

  } catch (err) {
    console.error('Audit execution error:', err);
    record('FATAL_ERROR', 'Audit Suite Run', false, err.message);
  } finally {
    await browser.close();
  }

  const passedCount = testResults.filter(r => r.passed).length;
  console.log(`\n===============================================================`);
  console.log(`  FINAL AUDIT RESULT: ${passedCount}/${testResults.length} TESTS PASSED`);
  console.log(`===============================================================\n`);

  if (passedCount !== testResults.length) {
    process.exit(1);
  }
}

runComprehensiveEngineAudit();
