import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = './artifacts/screenshots';

async function main() {
  const fs = await import('fs');
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  async function waitForApp() {
    await page.waitForTimeout(3000);
  }

  async function capture(name) {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log('Captured:', name);
  }

  // 1. Dashboard - English LTR, Dark theme (default)
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('dashboard-en-dark');

  // 2. Fleet - English LTR, Dark
  await page.goto(`${BASE}/#/fleet`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('fleet-en-dark');

  // 3. Shuttle engineering visualization
  await page.goto(`${BASE}/#/engineering`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('engineering-en-dark');

  // 4. Battery visualization
  await page.goto(`${BASE}/#/batteries`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('batteries-en-dark');

  // 5. Faults
  await page.goto(`${BASE}/#/faults`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('faults-en-dark');

  // 6. Maintenance
  await page.goto(`${BASE}/#/maintenance`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('maintenance-en-dark');

  // 7. Settings
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForApp();
  await capture('settings-en-dark');

  // 8. Arabic RTL - set language before loading
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('operational.language', 'ar');
    location.reload();
  });
  await waitForApp();
  await capture('dashboard-ar-rtl-dark');

  // 9. English LTR, Light theme
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('operational.theme', 'light');
    location.reload();
  });
  await waitForApp();
  await capture('dashboard-en-light');

  // 10. Mobile layout (English, dark)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  await mobilePage.screenshot({ path: `${OUT}/dashboard-mobile-en-dark.png`, fullPage: true });
  console.log('Captured: dashboard-mobile-en-dark');
  await mobilePage.close();

  // 11. Tablet layout (English, dark)
  const tabletPage = await browser.newPage();
  await tabletPage.setViewportSize({ width: 768, height: 1024 });
  await tabletPage.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await tabletPage.waitForTimeout(3000);
  await tabletPage.screenshot({ path: `${OUT}/dashboard-tablet-en-dark.png`, fullPage: true });
  console.log('Captured: dashboard-tablet-en-dark');
  await tabletPage.close();

  await browser.close();
  console.log('All screenshots captured in', OUT);
}

main().catch(console.error);