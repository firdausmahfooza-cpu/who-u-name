const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLevelTransitionTest() {
  console.log('=== TESTING SEQUENTIAL LEVEL TRANSITIONS (LEVELS 1 -> 5) ===');
  console.log('Testing that every level starts with Memorize Phase and never skips to Recall.');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 800 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
  });

  const testResults = [];
  function logResult(title, success, note = '') {
    testResults.push({ title, success, note });
    console.log(`[${success ? 'PASS' : 'FAIL'}] ${title} ${note ? '-> ' + note : ''}`);
  }

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(1000);

    // Reset localStorage to start fresh at Level 1
    await page.evaluate(() => {
      localStorage.clear();
      window.location.reload();
    });
    await sleep(1500);

    // Click "Mulai Main" / Play button on Home screen
    await page.evaluate(() => {
      const btn = document.querySelector('#btn-play-now');
      if (btn) btn.click();
    });
    await sleep(1000);

    // Loop through 5 consecutive levels
    for (let targetLevel = 1; targetLevel <= 5; targetLevel++) {
      console.log(`\n--- [TESTING LEVEL ${targetLevel}] ---`);

      // 1. VERIFY LEVEL INTRO & MEMORIZE PHASE IS ACTIVE
      const memorizePhaseActive = await page.evaluate((lvl) => {
        const badgeEl = document.querySelector('#level-intro-badge');
        const badgeLevel = badgeEl ? badgeEl.getAttribute('data-level') : null;
        const nameEl = document.querySelector('#memory-target-name');
        const name = nameEl ? nameEl.innerText.trim() : null;
        const submitBtn = document.querySelector('#btn-submit-answer');
        const livesEl = document.querySelector('#lives-text');
        const livesText = livesEl ? livesEl.innerText.trim() : '';

        return {
          hasBadge: Boolean(badgeEl),
          badgeLevel: Number(badgeLevel),
          name,
          hasSubmitBtn: Boolean(submitBtn),
          livesText
        };
      }, targetLevel);

      const isMemorizeValid = 
        memorizePhaseActive.hasBadge &&
        memorizePhaseActive.badgeLevel === targetLevel &&
        Boolean(memorizePhaseActive.name) &&
        !memorizePhaseActive.hasSubmitBtn;

      logResult(
        `Lvl ${targetLevel}: Memorize Phase Active`,
        isMemorizeValid,
        `Badge Lvl: ${memorizePhaseActive.badgeLevel}, Target: "${memorizePhaseActive.name}", Lives: ${memorizePhaseActive.livesText}`
      );

      const targetCharacterName = memorizePhaseActive.name;
      if (!targetCharacterName) {
        throw new Error(`Level ${targetLevel} did NOT show character name in Memorize Phase!`);
      }

      // 2. WAIT FOR MEMORIZE TIMER TO COUNTDOWN TO 0 AND ENTER RECALL PHASE
      console.log(`Waiting for countdown to finish for "${targetCharacterName}"...`);
      await page.waitForSelector('#btn-submit-answer', { timeout: 16000 });
      await sleep(500);

      // Verify Memorize Target Name is now HIDDEN in Recall Phase
      const nameHiddenInRecall = await page.evaluate(() => {
        const nameEl = document.querySelector('#memory-target-name');
        return nameEl === null;
      });

      logResult(
        `Lvl ${targetLevel}: Transition to Recall Phase`,
        nameHiddenInRecall,
        'Target name hidden, scrambled letters ready'
      );

      // 3. ANSWER RECALL PHASE CORRECTLY
      const cleanLetters = targetCharacterName.toUpperCase().replace(/[^A-Z]/g, '').split('');
      
      // Type each letter using keyboard
      for (const char of cleanLetters) {
        await page.keyboard.press(char);
        await sleep(60);
      }
      await sleep(400);

      // Click Submit Button
      await page.evaluate(() => {
        const submitBtn = document.querySelector('#btn-submit-answer');
        if (submitBtn) submitBtn.click();
      });
      await sleep(1500);

      // 4. VERIFY LEVEL COMPLETED SCREEN
      const resultScreenActive = await page.evaluate(() => {
        const nextBtn = document.querySelector('#btn-next-level');
        const isCompleted = document.body.innerText.includes('LUAR BIASA!') || document.body.innerText.includes('Level Selesai!');
        return Boolean(nextBtn) && isCompleted;
      });

      logResult(
        `Lvl ${targetLevel}: Level Completed Screen`,
        resultScreenActive,
        'Results displayed with Next Level button'
      );

      // If we're not at the last test level, click "Next Level"
      if (targetLevel < 5) {
        console.log(`Clicking Next Level to proceed to Level ${targetLevel + 1}...`);
        await page.evaluate(() => {
          const nextBtn = document.querySelector('#btn-next-level');
          if (nextBtn) nextBtn.click();
        });

        // Small delay to allow react re-render
        await sleep(600);

        // 5. CRITICAL CHECK: Does Level N+1 IMMEDIATELY show Memorize Phase (NOT Recall)?
        const immediatePhaseCheck = await page.evaluate((nextLvl) => {
          const badgeEl = document.querySelector('#level-intro-badge');
          const badgeLevel = badgeEl ? Number(badgeEl.getAttribute('data-level')) : null;
          const nameEl = document.querySelector('#memory-target-name');
          const submitBtn = document.querySelector('#btn-submit-answer');
          return {
            hasBadge: Boolean(badgeEl),
            badgeLevel,
            hasName: Boolean(nameEl && nameEl.innerText.trim().length > 0),
            hasSubmitPrematurely: Boolean(submitBtn)
          };
        }, targetLevel + 1);

        const isImmediateMemorize = 
          immediatePhaseCheck.hasBadge &&
          immediatePhaseCheck.badgeLevel === (targetLevel + 1) &&
          immediatePhaseCheck.hasName &&
          !immediatePhaseCheck.hasSubmitPrematurely;

        logResult(
          `Lvl ${targetLevel + 1}: Immediate Memorize Phase on Level Transition`,
          isImmediateMemorize,
          `Badge Lvl: ${immediatePhaseCheck.badgeLevel}, Target Name Exists: ${immediatePhaseCheck.hasName}, Premature Recall: ${immediatePhaseCheck.hasSubmitPrematurely}`
        );
      }
    }

    // Check for any browser console errors
    logResult(
      'Console Error Check',
      consoleErrors.length === 0,
      consoleErrors.length === 0 ? 'No console errors' : `Errors: ${consoleErrors.join(', ')}`
    );

  } catch (err) {
    console.error('Test run error:', err);
    logResult('Test Execution', false, err.message);
  } finally {
    await browser.close();
  }

  const passedCount = testResults.filter(r => r.success).length;
  console.log(`\n=== FINAL RESULT: ${passedCount}/${testResults.length} TESTS PASSED ===\n`);
  if (passedCount !== testResults.length) {
    process.exit(1);
  }
}

runLevelTransitionTest();
