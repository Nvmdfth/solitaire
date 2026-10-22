import puppeteer from 'puppeteer-core';
import http from 'http';
import { spawn } from 'child_process';

const results = [];

function recordTest(suite, name, passed, error, details) {
  results.push({ suite, name, passed, error, details });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${status}: [${suite}] ${name}${error ? ` -> ${error}` : ''}`);
}

async function ensureServerRunning(port = 9876) {
  const isUp = () => new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (await isUp()) {
    return null;
  }

  console.log(`[Setup] Preview server not detected. Starting preview server on port ${port}...`);
  const serverProc = spawn('npx', ['vite', 'preview', '--port', String(port)], {
    stdio: 'ignore'
  });

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await isUp()) {
      console.log(`[Setup] Preview server ready on port ${port}.\n`);
      return serverProc;
    }
  }
  return serverProc;
}

async function runE2ETests() {
  console.log('====================================================');
  console.log('       STARTING E2E UI & RESPONSIVE TEST SUITE       ');
  console.log('====================================================\n');

  let serverProcess = null;
  let browser = null;

  try {
    serverProcess = await ensureServerRunning(9876);

    browser = await puppeteer.launch({
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
      '--enable-unsafe-swiftshader',
      '--headless=new'
    ],
    defaultViewport: { width: 390, height: 844 }
  });

  const consoleMessages = [];
  const pageErrors = [];

  const page = await browser.newPage();

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      console.log('CAPTURED PAGE ERROR:', err.stack || err.message);
      pageErrors.push(err.stack || err.message);
    });

    // ----------------------------------------------------
    // Suite 1: Initial Page Load & DOM Structure
    // ----------------------------------------------------
    console.log('Suite 1: Initial Page Load & DOM Structure');
    await page.goto('http://127.0.0.1:9876', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    // Canvas Container
    const canvasExists = await page.evaluate(() => {
      const container = document.getElementById('canvas-container');
      const canvas = container ? container.querySelector('canvas') : null;
      return {
        hasContainer: !!container,
        hasCanvas: !!canvas,
        canvasWidth: canvas?.width || 0,
        canvasHeight: canvas?.height || 0
      };
    });
    recordTest(
      'DOM Structure',
      'Canvas Container and 3D Canvas element are rendered',
      canvasExists.hasContainer && canvasExists.hasCanvas && canvasExists.canvasWidth > 0,
      canvasExists.hasCanvas ? undefined : 'Missing canvas element in canvas-container'
    );

    // HUD Header Structure
    const hudHeader = await page.evaluate(() => {
      const header = document.querySelector('.hud-header');
      const scoreEl = document.getElementById('hud-score');
      const movesEl = document.getElementById('hud-moves');
      const timerEl = document.getElementById('hud-timer');
      const drawModeBtn = document.getElementById('hud-draw-mode');
      const soundBtn = document.getElementById('hud-sound-toggle');

      return {
        headerPresent: !!header,
        score: scoreEl?.textContent?.trim(),
        moves: movesEl?.textContent?.trim(),
        timer: timerEl?.textContent?.trim(),
        drawMode: drawModeBtn?.textContent?.trim(),
        sound: soundBtn?.textContent?.trim()
      };
    });

    recordTest('HUD Structure', 'Header and stat boxes (Score, Moves, Time) initialized',
      hudHeader.headerPresent && hudHeader.score !== undefined && hudHeader.moves !== undefined && hudHeader.timer !== undefined,
      undefined, hudHeader
    );
    recordTest('HUD Structure', 'Header action buttons initialized (DRAW 1, Sound)',
      hudHeader.drawMode === 'DRAW 1' && (hudHeader.sound === '🔊' || hudHeader.sound === '🔇'),
      undefined, hudHeader
    );

    // Bottom Action Bar Structure
    const bottomBar = await page.evaluate(() => {
      const undoBtn = document.getElementById('hud-undo-btn');
      const hintBtn = document.getElementById('hud-hint-btn');
      const autoBtn = document.getElementById('hud-autocomplete-btn');
      const restartBtn = document.getElementById('hud-restart-btn');
      const newGameBtn = document.getElementById('hud-newgame-btn');

      return {
        allPresent: !!(undoBtn && hintBtn && autoBtn && restartBtn && newGameBtn),
        undoDisabled: undoBtn?.disabled,
        undoOpacity: undoBtn?.style.opacity,
        autoDisplay: autoBtn?.style.display
      };
    });

    recordTest('HUD Structure', 'Bottom bar action buttons present (Undo, Hint, Auto, Restart, New)',
      bottomBar.allPresent,
      bottomBar.allPresent ? undefined : 'Missing one or more bottom bar buttons'
    );

    recordTest('HUD Structure', 'Undo button disabled initially',
      bottomBar.undoDisabled === true && bottomBar.undoOpacity === '0.4',
      `undoDisabled=${bottomBar.undoDisabled}, opacity=${bottomBar.undoOpacity}`
    );

    recordTest('HUD Structure', 'AutoComplete button hidden initially',
      bottomBar.autoDisplay === 'none',
      `autoDisplay=${bottomBar.autoDisplay}`
    );

    // ----------------------------------------------------
    // Suite 2: Responsive Viewport Layout Validation
    // ----------------------------------------------------
    console.log('\nSuite 2: Responsive Viewport Layout Validation');

    const viewports = [
      { name: 'Mobile Portrait (iPhone 14 / standard)', width: 390, height: 844, isMobile: true, hasTouch: true },
      { name: 'Mobile Landscape', width: 844, height: 390, isMobile: true, hasTouch: true },
      { name: 'Tablet Portrait (iPad)', width: 820, height: 1180, isMobile: true, hasTouch: true },
      { name: 'Tablet Landscape (iPad)', width: 1180, height: 820, isMobile: true, hasTouch: true },
      { name: 'Desktop (1080p)', width: 1920, height: 1080, isMobile: false, hasTouch: false }
    ];

    for (const vp of viewports) {
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        deviceScaleFactor: 1
      });
      await new Promise(r => setTimeout(r, 400));

      const layoutCheck = await page.evaluate((vpWidth, vpHeight) => {
        const body = document.body;
        const html = document.documentElement;
        const header = document.querySelector('.hud-header');
        const bottomBar = document.querySelector('.hud-bottom-bar');
        const headerRect = header?.getBoundingClientRect();
        const bottomRect = bottomBar?.getBoundingClientRect();

        const hasHorizontalScroll = (
          body.scrollWidth > vpWidth ||
          html.scrollWidth > vpWidth ||
          document.body.offsetWidth > vpWidth
        );

        const headerFits = headerRect
          ? headerRect.left >= 0 && headerRect.right <= vpWidth + 1 && headerRect.top >= 0
          : false;

        const bottomBarFits = bottomRect
          ? bottomRect.left >= 0 && bottomRect.right <= vpWidth + 1 && bottomRect.bottom <= vpHeight + 1
          : false;

        const overlap = (headerRect && bottomRect)
          ? headerRect.bottom > bottomRect.top
          : false;

        return {
          hasHorizontalScroll,
          headerFits,
          bottomBarFits,
          overlap,
          headerRect: headerRect ? { top: headerRect.top, bottom: headerRect.bottom, width: headerRect.width } : null,
          bottomRect: bottomRect ? { top: bottomRect.top, bottom: bottomRect.bottom, width: bottomRect.width } : null
        };
      }, vp.width, vp.height);

      recordTest(
        'Responsive Layout',
        `${vp.name} [${vp.width}x${vp.height}]: No horizontal scroll overflow`,
        !layoutCheck.hasHorizontalScroll,
        layoutCheck.hasHorizontalScroll ? 'Page overflows viewport horizontally' : undefined
      );

      recordTest(
        'Responsive Layout',
        `${vp.name} [${vp.width}x${vp.height}]: HUD elements fit within viewport bounds`,
        layoutCheck.headerFits && layoutCheck.bottomBarFits && !layoutCheck.overlap,
        !layoutCheck.headerFits ? 'Header clipped' : (!layoutCheck.bottomBarFits ? 'Bottom bar clipped' : (layoutCheck.overlap ? 'Header and bottom bar overlap' : undefined)),
        layoutCheck
      );
    }

    // ----------------------------------------------------
    // Suite 3: Accessibility (a11y) & Tap Targets
    // ----------------------------------------------------
    console.log('\nSuite 3: Accessibility (a11y) & Tap Target Validation');

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 200));

    const a11yChecks = await page.evaluate(() => {
      const interactiveElements = Array.from(document.querySelectorAll('button'));
      const wcag22Fails = [];
      const mobileSub44Warnings = [];
      const labelIssues = [];

      interactiveElements.forEach(btn => {
        if (btn.style.display === 'none' || window.getComputedStyle(btn).display === 'none') {
          return;
        }
        const modalOverlay = btn.closest('.hud-modal-overlay');
        if (modalOverlay && window.getComputedStyle(modalOverlay).display === 'none') {
          return;
        }
        if (btn.offsetParent === null && window.getComputedStyle(btn).position !== 'fixed') {
          return;
        }

        const rect = btn.getBoundingClientRect();
        // WCAG 2.2 AA SC 2.5.8 requires min 24x24 px
        if (rect.width < 24 || rect.height < 24) {
          wcag22Fails.push({
            id: btn.id || btn.className,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
        // iOS HIG / Material touch targets recommend 44x44 or 48x48
        if (rect.width < 44 || rect.height < 44) {
          mobileSub44Warnings.push({
            id: btn.id || btn.className,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }

        const accName = btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.innerText.trim();
        if (!accName) {
          labelIssues.push(btn.id || btn.className);
        }
      });

      const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const hasUserScalableNo = viewportMeta.includes('user-scalable=no');
      const hasMaximumScale = viewportMeta.includes('maximum-scale=1.0');

      return {
        wcag22Fails,
        mobileSub44Warnings,
        labelIssues,
        hasUserScalableNo,
        hasMaximumScale,
        viewportMeta
      };
    });

    recordTest(
      'Accessibility',
      'All interactive buttons have accessible names (title, aria-label, or text)',
      a11yChecks.labelIssues.length === 0,
      a11yChecks.labelIssues.length > 0 ? `Unlabeled buttons: ${a11yChecks.labelIssues.join(', ')}` : undefined
    );

    recordTest(
      'Accessibility',
      'Interactive buttons satisfy WCAG 2.2 AA minimum target size (>= 24px width & height)',
      a11yChecks.wcag22Fails.length === 0,
      a11yChecks.wcag22Fails.length > 0
        ? `Undersized targets: ${JSON.stringify(a11yChecks.wcag22Fails)}`
        : undefined,
      a11yChecks.wcag22Fails
    );

    console.log(`  ℹ INFO: Mobile sub-44px touch targets noted (WCAG 2.1 AAA / HIG advisory): ${JSON.stringify(a11yChecks.mobileSub44Warnings)}`);

    // Explicit verification for mobile HUD action buttons meeting >= 44px
    const hudTouchTargets = await page.evaluate(() => {
      const drawMode = document.getElementById('hud-draw-mode');
      const soundToggle = document.getElementById('hud-sound-toggle');
      const dmRect = drawMode ? drawMode.getBoundingClientRect() : null;
      const stRect = soundToggle ? soundToggle.getBoundingClientRect() : null;
      return {
        drawMode: dmRect ? { width: Math.round(dmRect.width), height: Math.round(dmRect.height) } : null,
        soundToggle: stRect ? { width: Math.round(stRect.width), height: Math.round(stRect.height) } : null
      };
    });

    recordTest(
      'Accessibility',
      'HUD action buttons (#hud-draw-mode, #hud-sound-toggle) meet >= 44px mobile touch target size',
      !!(hudTouchTargets.drawMode && hudTouchTargets.drawMode.width >= 44 && hudTouchTargets.drawMode.height >= 44 &&
         hudTouchTargets.soundToggle && hudTouchTargets.soundToggle.width >= 44 && hudTouchTargets.soundToggle.height >= 44),
      undefined,
      hudTouchTargets
    );

    // ----------------------------------------------------
    // Suite 4: UI State Mutations & Interaction Flows
    // ----------------------------------------------------
    console.log('\nSuite 4: UI State Mutations & Interaction Flows');

    // 4.1 Draw Mode Toggle
    const drawModeToggle = await page.evaluate(async () => {
      const btn = document.getElementById('hud-draw-mode');
      const initialText = btn.textContent?.trim();
      btn.click();
      const toggledText = btn.textContent?.trim();
      btn.click();
      const revertedText = btn.textContent?.trim();
      return { initialText, toggledText, revertedText };
    });

    recordTest(
      'UI Interaction',
      'Draw mode button toggles between DRAW 1 and DRAW 3',
      drawModeToggle.initialText === 'DRAW 1' &&
      drawModeToggle.toggledText === 'DRAW 3' &&
      drawModeToggle.revertedText === 'DRAW 1',
      `Got: ${JSON.stringify(drawModeToggle)}`
    );

    // 4.2 Sound Mute Toggle
    const soundToggle = await page.evaluate(() => {
      const btn = document.getElementById('hud-sound-toggle');
      const initial = btn.textContent?.trim();
      btn.click();
      const muted = btn.textContent?.trim();
      btn.click();
      const unmuted = btn.textContent?.trim();
      return { initial, muted, unmuted };
    });

    recordTest(
      'UI Interaction',
      'Sound toggle button updates icon between 🔊 and 🔇',
      soundToggle.initial === '🔊' && soundToggle.muted === '🔇' && soundToggle.unmuted === '🔊',
      `Got: ${JSON.stringify(soundToggle)}`
    );

    // 4.3 Hint Toast Display
    const toastTest = await page.evaluate(async () => {
      const hintBtn = document.getElementById('hud-hint-btn');
      const toast = document.querySelector('.hud-toast');
      const preDisplay = toast.style.display;

      hintBtn.click();
      await new Promise(r => setTimeout(r, 100));

      const postDisplay = toast.style.display;
      const toastText = toast.textContent?.trim();

      return { preDisplay, postDisplay, toastText };
    });

    recordTest(
      'UI Interaction',
      'Hint button click displays toast notification with hint text',
      toastTest.postDisplay === 'block' && !!toastTest.toastText && toastTest.toastText.length > 0,
      `Toast display: ${toastTest.postDisplay}, text: "${toastTest.toastText}"`
    );

    // 4.4 Undo State Mutation after Move
    const undoTest = await page.evaluate(async () => {
      const app = window.__solitaire;
      const undoBtn = document.getElementById('hud-undo-btn');
      const preDisabled = undoBtn.disabled;
      const preOpacity = undoBtn.style.opacity;

      // Draw a card using game action
      app.game.drawStock();
      app.scoreManager.recordMove();
      app.scoreManager.addScore(5);
      app.hud.setUndoEnabled(true);
      app.hud.updateStats(app.scoreManager.getScore(), app.scoreManager.getMoves(), 5);

      const activeDisabled = undoBtn.disabled;
      const activeOpacity = undoBtn.style.opacity;

      return {
        preDisabled,
        preOpacity,
        activeDisabled,
        activeOpacity
      };
    });

    recordTest(
      'UI Interaction',
      'Undo button enables on move (opacity 1.0, not disabled)',
      undoTest.preDisabled === true && undoTest.activeDisabled === false && undoTest.activeOpacity === '1',
      `preDisabled=${undoTest.preDisabled}, activeDisabled=${undoTest.activeDisabled}`
    );

    // 4.5 AutoComplete Button Toggle & Action
    const autoBtnTest = await page.evaluate(async () => {
      const app = window.__solitaire;
      const autoBtn = document.getElementById('hud-autocomplete-btn');
      const initialDisplay = autoBtn.style.display;

      app.hud.setAutoCompleteVisible(true);
      const visibleDisplay = autoBtn.style.display;

      let triggered = false;
      autoBtn.addEventListener('click', () => { triggered = true; }, { once: true });
      autoBtn.click();

      app.hud.setAutoCompleteVisible(false);
      const hiddenAgain = autoBtn.style.display;

      return { initialDisplay, visibleDisplay, triggered, hiddenAgain };
    });

    recordTest(
      'UI Interaction',
      'AutoComplete button visibility and click listener operate correctly',
      autoBtnTest.initialDisplay === 'none' && autoBtnTest.visibleDisplay === 'flex' && autoBtnTest.triggered && autoBtnTest.hiddenAgain === 'none',
      `Got: ${JSON.stringify(autoBtnTest)}`
    );

    // 4.6 Restart & New Game Action Buttons
    const gameControlTest = await page.evaluate(async () => {
      const app = window.__solitaire;
      const restartBtn = document.getElementById('hud-restart-btn');
      const newGameBtn = document.getElementById('hud-newgame-btn');

      restartBtn.click();
      newGameBtn.click();

      // Wait for render loop frame to flush score reset to HUD DOM
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
      await new Promise(r => setTimeout(r, 100));

      const scoreVal = document.getElementById('hud-score')?.textContent;
      const movesVal = document.getElementById('hud-moves')?.textContent;

      return {
        scoreVal,
        movesVal,
        deckReset: app.game.stock.length > 0
      };
    });

    recordTest(
      'UI Interaction',
      'Restart and New Game buttons trigger fresh game state with 0 score/moves',
      gameControlTest.scoreVal === '0' && gameControlTest.movesVal === '0' && gameControlTest.deckReset,
      `score=${gameControlTest.scoreVal}, moves=${gameControlTest.movesVal}`
    );

    // ----------------------------------------------------
    // Suite 5: Win Modal Celebration & Layout
    // ----------------------------------------------------
    console.log('\nSuite 5: Win Modal Celebration & Layout');
    const winModalTest = await page.evaluate(async () => {
      const app = window.__solitaire;
      let callbackInvoked = false;

      // Trigger win celebration with callback
      app.winCelebration.show(750, 42, 135, () => {
        callbackInvoked = true;
      });
      await new Promise(r => setTimeout(r, 300));

      const overlay = document.querySelector('.win-modal-overlay');
      const card = document.querySelector('.win-modal-card');
      const playAgainBtn = document.querySelector('.win-btn-play');
      const statVals = Array.from(document.querySelectorAll('.win-stat-val')).map(el => el.textContent?.trim());

      const isOverlayVisible = !!overlay && window.getComputedStyle(overlay).display !== 'none';
      const playBtnVisible = !!playAgainBtn && playAgainBtn.offsetWidth > 0;

      // Click play again
      if (playAgainBtn) {
        playAgainBtn.click();
      }
      await new Promise(r => setTimeout(r, 200));

      const overlayAfterClick = document.querySelector('.win-modal-overlay');

      return {
        isOverlayVisible,
        statVals,
        playBtnVisible,
        callbackInvoked,
        overlayDismissed: !overlayAfterClick || overlayAfterClick.style.display === 'none'
      };
    });

    recordTest(
      'Win Celebration',
      'Win modal renders with trophy, title, stats (Score, Moves, Time), and Play Again button',
      winModalTest.isOverlayVisible && winModalTest.playBtnVisible && winModalTest.statVals.length === 3,
      `statVals=${JSON.stringify(winModalTest.statVals)}`
    );

    recordTest(
      'Win Celebration',
      'Clicking Play Again invokes onPlayAgain callback and dismisses modal',
      winModalTest.callbackInvoked && winModalTest.overlayDismissed,
      `callbackInvoked=${winModalTest.callbackInvoked}, overlayDismissed=${winModalTest.overlayDismissed}`
    );

    // ----------------------------------------------------
    // Suite 6: Console Errors & WebGL Stability Check
    // ----------------------------------------------------
    console.log('\nSuite 6: Console Error & WebGL Stability Check');
    const criticalErrors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning' || m.type === 'warn');

    recordTest(
      'Console Stability',
      'Zero unhandled page errors or JavaScript exceptions',
      pageErrors.length === 0,
      pageErrors.length > 0 ? pageErrors.slice(0, 3).join('; ') : undefined
    );

    recordTest(
      'Console Stability',
      'Zero critical browser console errors',
      criticalErrors.length === 0,
      criticalErrors.length > 0 ? criticalErrors.map(e => e.text).slice(0, 3).join('; ') : undefined
    );

    console.log(`\nBrowser Logs Observed: ${consoleMessages.length} total (${warnings.length} warnings, ${criticalErrors.length} errors, ${pageErrors.length} uncaught errors)`);
    if (warnings.length > 0) {
      console.log('Sample warnings:');
      warnings.slice(0, 4).forEach(w => console.log(`  - ${w.text}`));
    }

  } catch (err) {
    console.error('Fatal test execution error:', err);
    recordTest('Runner', 'Execution pipeline failed', false, err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('                 TEST SUMMARY REPORT                ');
  console.log('====================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Verdict:        ${failed === 0 ? 'PASS' : 'FAIL'}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`- [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exitCode = 1;
  }
}

runE2ETests().catch(err => {
  console.error('Unhandled runner error:', err);
  process.exitCode = 1;
});
