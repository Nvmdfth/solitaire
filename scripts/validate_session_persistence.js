import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function validateSessionPersistence() {
  console.log('=== Starting Puppeteer Session Persistence Validation ===\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
      '--in-process-gpu',
      '--no-zygote',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--headless=new'
    ],
    defaultViewport: { width: 1080, height: 1920 }
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('[Browser Error]:', err));

    // 1. Initial Load
    console.log('1. Navigating to http://localhost:9876 ...');
    await page.goto('http://localhost:9876', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    // Inspect initial game state
    const initialState = await page.evaluate(() => {
      const app = window.__solitaire;
      return {
        stockCount: app.game.stock.length,
        wasteCount: app.game.waste.length,
        tableau0: app.game.tableau[0].map(c => `${c.id} (${c.isFaceUp ? 'UP' : 'DOWN'})`),
        tableau1: app.game.tableau[1].map(c => `${c.id} (${c.isFaceUp ? 'UP' : 'DOWN'})`),
        tableau6: app.game.tableau[6].map(c => `${c.id} (${c.isFaceUp ? 'UP' : 'DOWN'})`),
        score: app.scoreManager.getScore(),
        moves: app.scoreManager.getMoves(),
        cookie: document.cookie
      };
    });

    console.log('\n--- Initial Game State ---');
    console.log('Stock Count:', initialState.stockCount);
    console.log('Waste Count:', initialState.wasteCount);
    console.log('Tableau 0:', initialState.tableau0);
    console.log('Tableau 1:', initialState.tableau1);
    console.log('Tableau 6 (top):', initialState.tableau6[initialState.tableau6.length - 1]);
    console.log('Score / Moves:', `${initialState.score} / ${initialState.moves}`);
    console.log('Initial Cookie Present:', initialState.cookie.includes('solitaire_session'));

    // 2. Perform actions: Draw 3 cards from stock
    console.log('\n2. Simulating User Moves (Drawing 3 cards from Stock)...');
    await page.evaluate(() => {
      const app = window.__solitaire;
      app.game.drawStock();
      app.game.drawStock();
      app.game.drawStock();
      app.scoreManager.recordMove();
      app.scoreManager.recordMove();
      app.scoreManager.recordMove();
      app.scoreManager.addScore(15);
      app.saveCurrentSession();
    });

    await new Promise(r => setTimeout(r, 500));

    // Inspect state before reload
    const preReloadState = await page.evaluate(() => {
      const app = window.__solitaire;
      return {
        stockCount: app.game.stock.length,
        wasteCount: app.game.waste.length,
        topWasteCard: app.game.waste[app.game.waste.length - 1]?.id,
        tableau0: app.game.tableau[0].map(c => c.id),
        tableau1: app.game.tableau[1].map(c => c.id),
        score: app.scoreManager.getScore(),
        moves: app.scoreManager.getMoves(),
        cookieLength: document.cookie.length,
        cookieValue: document.cookie
      };
    });

    console.log('\n--- State After Moves (Pre-Reload) ---');
    console.log('Stock Count:', preReloadState.stockCount);
    console.log('Waste Count:', preReloadState.wasteCount);
    console.log('Top Waste Card:', preReloadState.topWasteCard);
    console.log('Score / Moves:', `${preReloadState.score} / ${preReloadState.moves}`);
    console.log('Cookie Size (bytes):', preReloadState.cookieLength);
    console.log('Cookie String:', preReloadState.cookieValue);

    // Save screenshot before reload
    await page.screenshot({ path: 'scripts/screenshot_before_reload.png' });
    console.log('Saved screenshot: scripts/screenshot_before_reload.png');

    // 3. Reload the page
    console.log('\n3. Reloading Page (Simulating browser refresh / F5)...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    // 4. Inspect state after reload
    const postReloadState = await page.evaluate(() => {
      const app = window.__solitaire;
      return {
        stockCount: app.game.stock.length,
        wasteCount: app.game.waste.length,
        topWasteCard: app.game.waste[app.game.waste.length - 1]?.id,
        tableau0: app.game.tableau[0].map(c => c.id),
        tableau1: app.game.tableau[1].map(c => c.id),
        tableau6: app.game.tableau[6].map(c => c.id),
        score: app.scoreManager.getScore(),
        moves: app.scoreManager.getMoves(),
        cookie: document.cookie,
        cardMeshesCount: app.cardMap.size
      };
    });

    console.log('\n--- State After Reload ---');
    console.log('Stock Count:', postReloadState.stockCount);
    console.log('Waste Count:', postReloadState.wasteCount);
    console.log('Top Waste Card:', postReloadState.topWasteCard);
    console.log('Tableau 0:', postReloadState.tableau0);
    console.log('Tableau 1:', postReloadState.tableau1);
    console.log('Score / Moves:', `${postReloadState.score} / ${postReloadState.moves}`);
    console.log('3D Card Meshes in Scene:', postReloadState.cardMeshesCount);

    // Save screenshot after reload
    await page.screenshot({ path: 'scripts/screenshot_after_reload.png' });
    console.log('Saved screenshot: scripts/screenshot_after_reload.png');

    // 5. Verification Assertions
    console.log('\n=== Verification Results ===');
    const stockMatches = postReloadState.stockCount === preReloadState.stockCount;
    const wasteMatches = postReloadState.wasteCount === preReloadState.wasteCount;
    const topWasteMatches = postReloadState.topWasteCard === preReloadState.topWasteCard;
    const tableauMatches = JSON.stringify(postReloadState.tableau0) === JSON.stringify(preReloadState.tableau0)
      && JSON.stringify(postReloadState.tableau1) === JSON.stringify(preReloadState.tableau1);
    const scoreMatches = postReloadState.score === preReloadState.score;
    const movesMatch = postReloadState.moves === preReloadState.moves;
    const meshesMatch = postReloadState.cardMeshesCount === 52;

    console.log(`- Stock Pile Count Matches (${preReloadState.stockCount}):`, stockMatches ? 'PASS' : 'FAIL');
    console.log(`- Waste Pile Count Matches (${preReloadState.wasteCount}):`, wasteMatches ? 'PASS' : 'FAIL');
    console.log(`- Top Waste Card Matches (${preReloadState.topWasteCard}):`, topWasteMatches ? 'PASS' : 'FAIL');
    console.log('- Tableau Columns Match Exactly:', tableauMatches ? 'PASS' : 'FAIL');
    console.log(`- Score Preserved (${preReloadState.score}):`, scoreMatches ? 'PASS' : 'FAIL');
    console.log(`- Moves Preserved (${preReloadState.moves}):`, movesMatch ? 'PASS' : 'FAIL');
    console.log('- Total 3D Cards Rendered (52):', meshesMatch ? 'PASS' : 'FAIL');

    if (stockMatches && wasteMatches && topWasteMatches && tableauMatches && scoreMatches && movesMatch && meshesMatch) {
      console.log('\n>>> OVERALL RESULT: SUCCESS! Session persistence across browser reload is working flawlessly! <<<');
    } else {
      console.error('\n>>> OVERALL RESULT: FAILED! One or more state checks failed. <<<');
      process.exitCode = 1;
    }

  } finally {
    await browser.close();
  }
}

validateSessionPersistence().catch(err => {
  console.error('Test execution failed:', err);
  process.exitCode = 1;
});
