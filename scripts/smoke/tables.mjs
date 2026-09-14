// Smoke: /tablas — upload a plain-text contract and verify the deterministic extraction fills the review table.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION|404|huggingface|fonts/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4321/LexMX/tablas', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('#tables-docs', { timeout: 20000 });
const contract = [
  'CONTRATO que celebran, por una parte, Inmobiliaria Sol, S.A. de C.V., en lo sucesivo EL ARRENDADOR, y por la otra parte María López Ruiz, en lo sucesivo LA ARRENDATARIA.',
  '', 'En la Ciudad de México, a 15 de marzo de 2026.', '',
  'SEGUNDA.- RENTA. La renta será de $18,500.00 mensuales.', '',
  'TERCERA.- VIGENCIA. Doce meses.', '',
  'CUARTA.- Las partes se someten a los tribunales de la Ciudad de México.',
].join('\n');
await page.setInputFiles('input[type=file]', [{ name: 'contrato.txt', mimeType: 'text/plain', buffer: Buffer.from(contract) }]);
await page.waitForSelector('[data-testid="review-table"]', { timeout: 20000 });
const cells = await page.locator('[data-testid="review-table"] textarea').evaluateAll((els) => els.map((e) => e.value.slice(0, 60)));
await page.screenshot({ path: process.argv[2] ?? '/tmp/tables.png' });
console.log(JSON.stringify({ cells, ok: cells[0]?.includes('María López Ruiz') && cells[1] === '2026-03-15' && cells[2] === '$18,500.00', errors: errors.slice(0, 5) }, null, 1));
await browser.close();
