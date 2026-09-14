// Smoke: /casos — create a case through the UI, add a note, verify IndexedDB persistence.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION|404|huggingface/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4321/LexMX/casos', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('[data-testid="case-manager"]', { timeout: 30000 });
await page.click('[data-testid="new-case-button"]');
await page.fill('[data-testid="case-title-input"]', 'Despido injustificado · Pérez');
await page.fill('[data-testid="case-description-input"]', 'Trabajador despedido sin causa el 1 de septiembre.');
await page.selectOption('[data-testid="case-legal-area-select"]', 'labor');
await page.click('[data-testid="case-submit-button"]');
await page.waitForSelector('[data-testid="cases-list"] button', { timeout: 10000 });
await page.locator('[role="tab"]').nth(2).click();
await page.fill('[data-testid="notes-textarea"]', 'Primera nota del expediente.');
await page.locator('[role="tabpanel"] form button[type="submit"]').click();
await page.waitForTimeout(800);
const persisted = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('LexMX_Cases');
  req.onsuccess = () => {
    const db = req.result;
    const all = db.transaction('cases').objectStore('cases').getAll();
    all.onsuccess = () => resolve(all.result.map((c) => ({ title: c.title, area: c.legalArea, notes: c.notes.length, createdAt: typeof c.createdAt })));
  };
  req.onerror = () => resolve({ error: String(req.error) });
}));
await page.screenshot({ path: process.argv[2] ?? '/tmp/cases.png' });
console.log(JSON.stringify({ persisted, errors: errors.slice(0, 5) }, null, 1));
await browser.close();
