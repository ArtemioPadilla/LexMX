// Smoke: /plantillas — pick a template, fill a field, verify the preview updates and the Word export downloads a .docx.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION|404|huggingface/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4321/LexMX/plantillas', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('[data-testid="template-preview"]', { timeout: 30000 });
const templates = await page.locator('ul li button').count();
await page.locator('ul li button').nth(1).click();
const firstInput = page.locator('input[id^="t-"]').first();
await firstInput.fill('Juan Pérez Prueba');
await page.waitForTimeout(300);
const previewHasValue = (await page.locator('[data-testid="template-preview"]').innerText()).includes('Juan Pérez Prueba');
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByRole('button', { name: /Word/ }).click(),
]);
const path = await download.path();
const { statSync, readFileSync } = await import('node:fs');
const bytes = readFileSync(path);
await page.screenshot({ path: process.argv[2] ?? '/tmp/templates.png' });
console.log(JSON.stringify({ templates, previewHasValue, download: { name: download.suggestedFilename(), size: statSync(path).size, zip: bytes.subarray(0, 2).toString() === 'PK' }, errors: errors.slice(0, 5) }, null, 1));
await browser.close();
