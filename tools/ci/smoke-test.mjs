// Böngészős füstteszt: fejnélküli Chromiumban betölti az oldalt, és megnézi, hogy tényleg működik-e.
// Futtatás: a repó gyökeréből indított statikus szerverrel (pl. python3 -m http.server 8000), majd
//   BASE_URL=http://localhost:8000/ node tools/ci/smoke-test.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const BASE = process.env.BASE_URL || 'http://localhost:8000/';
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg); };

// Elvárt darabszám közvetlenül az adatfájlokból
const html = readFileSync('index.html', 'utf8');
const ERDO = { sources: [], add(s) { this.sources.push(s); } };
const ctx = vm.createContext({ ERDO });
for (const [, f] of html.matchAll(/<script src="(data\/[^"]+\.js)"><\/script>/g)) vm.runInContext(readFileSync(f, 'utf8'), ctx);
const expected = ERDO.sources.reduce((n, s) => n + s.rows.length, 0);

const browser = await chromium.launch();
async function run(label, viewport) {
  console.log(`\n— ${label} (${viewport.width}×${viewport.height})`);
  const page = await browser.newPage({ viewport });
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  // A háttércsempék és a NÉBIH WMS külső szolgáltatás: kiesésük ne buktassa a tesztet.
  await page.route(/arcgisonline\.com|openstreetmap\.org|opentopomap\.org|nebih\.gov\.hu/, r => r.abort());

  const resp = await page.goto(BASE, { waitUntil: 'load' });
  check(resp && resp.ok(), `index.html betölt (HTTP ${resp && resp.status()})`);
  await page.waitForFunction(() => window.L && document.querySelector('#stats b'), null, { timeout: 15000 }).catch(() => {});

  const appErrors = consoleErrors.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));
  check(!pageErrors.length, `nincs JavaScript-kivétel${pageErrors.length ? ': ' + pageErrors.join(' | ') : ''}`);
  check(!appErrors.length, `nincs konzolhiba${appErrors.length ? ': ' + appErrors.join(' | ') : ''}`);
  check(await page.evaluate(() => !!window.L), 'a Leaflet betöltődött');

  const polys = await page.locator('path.leaflet-interactive').count();
  check(polys === expected, `mind a ${expected} erdőrészlet poligonja kirajzolódott (talált: ${polys})`);
  const stat = await page.locator('#stats b').first().textContent();
  check(Number(stat) === expected, `a fejléc számlálója ${expected} (talált: ${stat})`);
  const items = await page.locator('#list .item').count();
  check(items === expected, `a listában ${expected} sor van (talált: ${items})`);

  // Keresés szűr
  const first = ERDO.sources[0].rows[0][0];
  await page.fill('#q', first);
  const filtered = await page.locator('#list .item').count();
  check(filtered >= 1 && filtered < expected, `a keresés szűr („${first}” → ${filtered} sor)`);
  await page.fill('#q', '');

  // Kattintás a listában → felugró ablak a részlet adataival
  await page.locator('#list .item').first().click();
  await page.waitForSelector('.leaflet-popup-content .pp', { timeout: 5000 }).catch(() => {});
  const popup = await page.locator('.leaflet-popup-content .pp h3').textContent().catch(() => null);
  check(!!popup, `listaelemre kattintva megnyílik a részlet ablaka (${popup})`);

  // Névjegy doboz látszik, a Források ablak minden forrást felsorol
  const about = await page.locator('#about').boundingBox();
  check(about && about.y >= 0 && about.y + about.height <= viewport.height + 1, 'a névjegy doboz a képernyőn belül van');
  await page.click('#srcBtn');
  const srcItems = await page.locator('#srcDlg[open] #srcList li').count();
  check(srcItems === ERDO.sources.length + 1, `a Források ablakban ${ERDO.sources.length} forrás + NÉBIH van (talált: ${srcItems})`);
  await page.keyboard.press('Escape');

  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${label}.png` });
  await page.close();
}

await run('asztali', { width: 1280, height: 800 });
await run('mobil', { width: 375, height: 812 });
await browser.close();

console.log(failures.length ? `\n${failures.length} ellenőrzés bukott el.` : '\nMinden ellenőrzés rendben.');
for (const f of failures) console.log(`::error::${f}`);
process.exit(failures.length ? 1 : 0);
