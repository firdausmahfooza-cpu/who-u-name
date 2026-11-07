const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('=== TEST SUITE: DYNAMIC CHARACTER ROTATION & ANIME PORTRAITS ===\n');

  const testResults = [];
  function record(title, passed, detail = '') {
    testResults.push({ title, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${title} ${detail ? '-> ' + detail : ''}`);
  }

  // -------------------------------------------------------------
  // 1. PENGUJIAN DATABASE KARAKTER (100 KARAKTER INTERNASIONAL)
  // -------------------------------------------------------------
  console.log('--- 1. DATABASE & CULTURAL INTEGRITY CHECK ---');
  
  // Baca langsung file characters.js
  const charFileContent = fs.readFileSync(path.join(__dirname, 'src/data/characters.js'), 'utf-8');

  // Cek apakah ada nama Indonesia yang tersisa
  const hasIndonesia = charFileContent.includes('"Indonesia"') || charFileContent.includes("countryCode: \"ID\"");
  record('1.1 Zero Indonesian Names in Database', !hasIndonesia, 'All Indonesian characters removed');

  const { CHARACTERS, COUNTRIES, getDynamicCharacters, getSmartRecallOptions, getLevelConfig } = await import('./src/data/characters.js');

  record('1.2 Total 100 Characters Target', CHARACTERS.length === 100, `Found ${CHARACTERS.length} unique characters`);

  const countryCounts = {};
  for (const c of CHARACTERS) {
    countryCounts[c.country] = (countryCounts[c.country] || 0) + 1;
  }

  const expectedDistribution = (
    countryCounts['Korea'] === 20 &&
    countryCounts['Jepang'] === 20 &&
    countryCounts['Latin America'] === 20 &&
    countryCounts['Amerika'] === 20 &&
    countryCounts['Inggris'] === 20
  );

  record(
    '1.3 Exactly 20 Characters per 5 International Regions',
    expectedDistribution,
    `KR: ${countryCounts['Korea']}, JP: ${countryCounts['Jepang']}, LA: ${countryCounts['Latin America']}, US: ${countryCounts['Amerika']}, UK: ${countryCounts['Inggris']}`
  );

  // Cek integritas atribut setiap karakter (ID, Name, Style, Bio, Flag, Theme)
  const allAttributesValid = CHARACTERS.every(c => (
    c.id &&
    c.name && c.name.trim().length > 3 &&
    c.country &&
    c.flag &&
    c.bio &&
    c.themeColor &&
    c.style &&
    c.style.faceShape &&
    c.style.skin &&
    c.style.eyeShape &&
    c.style.eyeColor &&
    c.style.hairStyle &&
    c.style.hair &&
    c.style.costume &&
    c.style.costumeColor
  ));
  record('1.4 All 100 Characters Have Complete Anime Portrait Styles', allAttributesValid, 'All face shapes, skin tones, eyes, hairs, and outfits configured');

  // -------------------------------------------------------------
  // 2. NO-REPEAT SYSTEM (3 LEVEL TERAKHIR) & 10 SESI SIMULASI
  // -------------------------------------------------------------
  console.log('\n--- 2. NO REPEAT (3 LEVELS) & 10 GAME SESSIONS SIMULATION ---');

  let totalSessionViolations = 0;
  let sessionUniqueCharactersAcross10 = new Set();

  for (let session = 1; session <= 10; session++) {
    const sessionSeenIds = new Set();
    const recentHistory = [];
    let sessionViolations = 0;

    for (let lvl = 1; lvl <= 15; lvl++) {
      const config = getLevelConfig(lvl);
      const chars = getDynamicCharacters({
        count: config.characterCount,
        currentLevel: lvl,
        mode: 'NORMAL',
        recentHistory,
        sessionSeenIds
      });

      // Cek apakah karakter yang dipilih ada di 3 level terakhir
      const last3 = recentHistory.slice(-3).flat();
      for (const char of chars) {
        if (last3.includes(char.id)) {
          sessionViolations++;
        }
        sessionSeenIds.add(char.id);
        sessionUniqueCharactersAcross10.add(char.id);
      }

      recentHistory.push(chars.map(c => c.id));
    }

    if (sessionViolations > 0) totalSessionViolations++;
  }

  record(
    '2.1 No Repeat in 3 Consecutive Levels Across 10 Sessions',
    totalSessionViolations === 0,
    `Violations: ${totalSessionViolations} (Zero repeats within 3 levels)`
  );

  record(
    '2.2 Dynamic Diversity Across Sessions',
    sessionUniqueCharactersAcross10.size >= 80,
    `Unique characters utilized: ${sessionUniqueCharactersAcross10.size} / 100`
  );

  // -------------------------------------------------------------
  // 3. DYNAMIC NAME SHUFFLE & SMART DISTRACTORS (RECALL PHASE)
  // -------------------------------------------------------------
  console.log('\n--- 3. DYNAMIC NAME SHUFFLE & DISTRACTOR TEST ---');

  const testTarget = CHARACTERS.find(c => c.name === "Kim Min-jun");
  const positionCounts = [0, 0, 0, 0];
  let alwaysUniqueOptions = true;

  for (let i = 0; i < 40; i++) {
    const options = getSmartRecallOptions(testTarget, [testTarget], 4);
    if (new Set(options).size !== 4) alwaysUniqueOptions = false;
    const correctIdx = options.indexOf(testTarget.name);
    if (correctIdx >= 0 && correctIdx < 4) {
      positionCounts[correctIdx]++;
    }
  }

  const allPositionsHit = positionCounts.every(count => count > 0);
  record(
    '3.1 Correct Answer Position is Dynamically Shuffled (0..3)',
    allPositionsHit,
    `Slot distribution over 40 trials: [Slot 0: ${positionCounts[0]}, Slot 1: ${positionCounts[1]}, Slot 2: ${positionCounts[2]}, Slot 3: ${positionCounts[3]}]`
  );

  record(
    '3.2 Always Exactly 4 Unique Name Options Without Duplicates',
    alwaysUniqueOptions,
    'All distractor names properly deduplicated'
  );

  // -------------------------------------------------------------
  // 4. PUPPETEER E2E TEST: BROWSER GAMEPLAY & ANIME PORTRAIT DISPLAY
  // -------------------------------------------------------------
  console.log('\n--- 4. PUPPETEER E2E BROWSER TEST (HEADLESS CHROME) ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 800 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    // 4.1 Cek Home Screen & Masuk Game
    const homeRendered = await page.evaluate(() => Boolean(document.querySelector('#btn-play-now')));
    record('4.1 Home Screen Loaded with Clean UI', homeRendered, 'Ready for memory training');

    // Klik tombol Main
    await page.evaluate(() => document.querySelector('#btn-play-now').click());
    await sleep(1000);

    // 4.2 Cek Fase 1: Memorize Phase menampilkan Anime Character Portrait
    const memorizeData = await page.evaluate(() => {
      const nameEl = document.querySelector('#memory-target-name');
      const svgPortrait = document.querySelector('svg');
      const countryBadge = document.querySelector('span');
      return {
        hasName: Boolean(nameEl && nameEl.innerText.trim().length > 0),
        name: nameEl ? nameEl.innerText.trim() : '',
        hasSvg: Boolean(svgPortrait)
      };
    });

    record(
      '4.2 Memorize Phase: Anime Portrait & Name Displayed',
      memorizeData.hasName && memorizeData.hasSvg,
      `Target Character: "${memorizeData.name}", Clean Anime Portrait Rendered`
    );

    // Tunggu timer countdown selesai dan masuk ke Recall Phase
    console.log(`Waiting for countdown to finish for "${memorizeData.name}"...`);
    await page.waitForSelector('#btn-submit-answer', { timeout: 15000 });
    await sleep(500);

    // 4.3 Cek Fase 2: Recall Phase
    const recallData = await page.evaluate(() => {
      const nameEl = document.querySelector('#memory-target-name');
      const submitBtn = document.querySelector('#btn-submit-answer');
      // Pastikan badge bendera/negara TIDAK muncul di recall phase
      const bodyText = document.body.innerText;
      const flags = ['🇰🇷', '🇯🇵', '🇲🇽', '🇺🇸', '🇬🇧'];
      const hasFlagInRecall = flags.some(f => bodyText.includes(f));

      return {
        nameHidden: nameEl === null,
        hasSubmit: Boolean(submitBtn),
        hasFlagInRecall
      };
    });

    record(
      '4.3 Recall Phase: Name and Country Hidden (Pure Face Memory Training)',
      recallData.nameHidden && recallData.hasSubmit && !recallData.hasFlagInRecall,
      'Mystery mode active, no country clue given'
    );

    // 4.4 Ketik jawaban dan submit
    const cleanLetters = memorizeData.name.toUpperCase().replace(/[^A-Z]/g, '').split('');
    for (const char of cleanLetters) {
      await page.keyboard.press(char);
      await sleep(50);
    }
    await sleep(300);

    await page.evaluate(() => {
      const submitBtn = document.querySelector('#btn-submit-answer');
      if (submitBtn) submitBtn.click();
    });
    await sleep(1500);

    // 4.5 Cek Hasil Level & Transisi Level 2
    const levelWin = await page.evaluate(() => Boolean(document.querySelector('#btn-next-level')));
    record('4.4 Level Completed & Next Level Button Active', levelWin, 'Answer correctly accepted');

    // Klik Next Level
    await page.evaluate(() => document.querySelector('#btn-next-level').click());
    await sleep(800);

    // 4.6 Cek Level 2 langsung masuk Memorize Phase dengan karakter baru yang berbeda
    const level2Data = await page.evaluate(() => {
      const nameEl = document.querySelector('#memory-target-name');
      const introBadge = document.querySelector('#level-intro-badge');
      return {
        badgeLevel: introBadge ? Number(introBadge.getAttribute('data-level')) : null,
        name: nameEl ? nameEl.innerText.trim() : null
      };
    });

    const isDifferentChar = level2Data.name && level2Data.name !== memorizeData.name;
    record(
      '4.5 Level 2 Transition: Fresh Character in Memorize Phase',
      level2Data.badgeLevel === 2 && isDifferentChar,
      `New Level 2 Character: "${level2Data.name}" (Different from Level 1)`
    );

    record(
      '4.6 Console Error Check',
      consoleErrors.length === 0,
      consoleErrors.length === 0 ? 'Zero console errors' : `Errors: ${consoleErrors.join(', ')}`
    );

  } catch (err) {
    console.error('Puppeteer test error:', err);
    record('E2E Puppeteer Execution', false, err.message);
  } finally {
    await browser.close();
  }

  const passed = testResults.filter(r => r.passed).length;
  console.log(`\n=== FINAL RESULT: ${passed}/${testResults.length} TESTS PASSED ===\n`);
  if (passed !== testResults.length) {
    process.exit(1);
  }
}

runTestSuite();
