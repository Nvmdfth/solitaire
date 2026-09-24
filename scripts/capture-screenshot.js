import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  console.log('Launching Chromium with headless=new and angle swiftshader...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless=new',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--hide-scrollbars'
    ]
  });

  try {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });

    console.log('Navigating to http://127.0.0.1:9876/ ...');
    await page.goto('http://127.0.0.1:9876/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Waiting 2.5s for initial deal to settle...');
    await new Promise(r => setTimeout(r, 2500));

    const mobilePath = path.resolve(__dirname, '../screenshot-mobile-portrait.png');
    console.log('Extracting canvas dataURL after forcing render...');
    const dataUrl = await page.evaluate(() => {
      if (window.__solitaire) {
        window.__solitaire.renderNow();
      }
      const canvas = document.querySelector('canvas');
      return canvas ? canvas.toDataURL('image/png') : null;
    });

    if (dataUrl) {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(mobilePath, base64Data, 'base64');
      console.log(`Successfully wrote canvas screenshot (${base64Data.length} chars) to ${mobilePath}`);
    } else {
      console.error('No canvas element found on page');
    }
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

run();
