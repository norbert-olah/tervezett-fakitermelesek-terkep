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
  // A háttércsempék, a NÉBIH WMS és a turistaút-réteg külső szolgáltatás: kiesésük ne buktassa a tesztet.
  await page.route(/arcgisonline\.com|openstreetmap\.(org|hu)|opentopomap\.org|nebih\.gov\.hu/, r => r.abort());
  // Minden más külső kérés hiba: az oldalnak a saját fájljain kívül csak a térképcsempékhez szabad kimennie.
  const external = [];
  page.on('request', r => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !/arcgisonline\.com|openstreetmap\.(org|hu)|opentopomap\.org|nebih\.gov\.hu/.test(u.hostname) && !u.protocol.startsWith('data')) external.push(u.hostname); });

  const resp = await page.goto(BASE, { waitUntil: 'load' });
  check(resp && resp.ok(), `index.html betölt (HTTP ${resp && resp.status()})`);
  await page.waitForFunction(() => window.L && document.querySelector('#stats b'), null, { timeout: 15000 }).catch(() => {});

  const appErrors = consoleErrors.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));
  check(!pageErrors.length, `nincs JavaScript-kivétel${pageErrors.length ? ': ' + pageErrors.join(' | ') : ''}`);
  check(!appErrors.length, `nincs konzolhiba${appErrors.length ? ': ' + appErrors.join(' | ') : ''}`);
  check(await page.evaluate(() => !!window.L), 'a Leaflet betöltődött');
  check(!external.length, `nincs kérés más külső szerverre${external.length ? ': ' + [...new Set(external)].join(', ') : ''}`);
  check(await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Source Sans 3' && f.status === 'loaded'); }), 'a Source Sans 3 betűtípus a repóból betöltődött');
  for (const href of await page.$$eval('link[rel~="icon"],link[rel="apple-touch-icon"]', ls => ls.map(l => l.href))) {
    const r = await page.request.get(href);
    check(r.ok(), `az ikon elérhető: ${href.split('/').pop()} (HTTP ${r.status()})`);
  }

  // Mobilon húzható alsó lap három állással (peek / half / full). Első látogatáskor fél állásban nyílik,
  // később a legutóbb beállított állásban; csúcs állásban a térkép pontosan a lap fölött ér véget.
  const mobile = await page.locator('#handle').isVisible();
  const sheetState = () => page.locator('#side').getAttribute('data-state');
  const sheetTo = async s => { for (let i = 0; i < 3 && (await sheetState()) !== s; i++) await page.click('#handle'); await page.waitForTimeout(400); };
  const openFilters = async () => { if (mobile && (await page.locator('#fltBtn').getAttribute('aria-expanded')) !== 'true') await page.click('#fltBtn'); };
  if (mobile) {
    await page.waitForTimeout(400);   // a fejléc a betűtípus betöltésekor még változhat, a lap magassága animálódik
    const half = await page.locator('#side').boundingBox();
    check(await sheetState() === 'half' && Math.abs(half.height - viewport.height / 2) <= 2, 'első betöltéskor a lap fél állásban nyílik');
    check(await page.locator('#q').isVisible() && !(await page.locator('#legend').isVisible()), 'fél állásban a kereső látszik, a szűrők össze vannak csukva');
    const rows = await page.locator('#list .item').evaluateAll((els, b) => els.filter(e => { const r = e.getBoundingClientRect(); return r.top >= b.y && r.bottom <= b.y + b.height; }).length, half);
    check(rows >= 4, `fél állásban legalább 4 listasor látszik (${rows})`);
    await page.click('#handle'); await page.waitForTimeout(400);
    check(await sheetState() === 'full' && (await page.locator('#side').boundingBox()).y <= 50, 'a fogantyúra koppintva a lap szinte a teljes képernyőt kitölti');
    await page.click('#handle'); await page.waitForTimeout(400);
    const side = await page.locator('#side').boundingBox(), mapBox = await page.locator('#map').boundingBox();
    check(await sheetState() === 'peek' && side.height <= 90, `újabb koppintásra csúcs állás: csak a tömör fejléc látszik (${Math.round(side.height)} px)`);
    check(Math.abs(mapBox.y + mapBox.height - side.y) <= 2, 'csúcs állásban a térkép a lap tetejéig ér, nem lóg alá');
    check(!(await page.locator('#q').isVisible()), 'csúcs állásban a kereső és a lista rejtve van');
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
    check(await sheetState() === 'peek', 'újratöltéskor a lap a legutóbb beállított állásban nyílik');
    // Húzás a fejlécen: fel → nagyobb állás, és a tartalom már húzás közben látszik; le → csúcs állás
    const drag = async (dy, during) => { const h = await page.locator('#side header').boundingBox(); const x = h.x + h.width / 3, y = h.y + 12;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy, { steps: 8 });
      const r = during && await during(); await page.mouse.up(); await page.waitForTimeout(400); return r; };
    const visibleWhileDragging = await drag(-viewport.height / 2, () => page.locator('#q').isVisible());
    check(visibleWhileDragging, 'csúcs állásból felhúzva a kereső és a lista már húzás közben látszik');
    check(await sheetState() !== 'peek', 'a fejlécet felhúzva a lap kinyílik');
    await sheetTo('full');
    await drag(viewport.height);
    check(await sheetState() === 'peek', 'a fejlécet lehúzva a lap csúcs állásba csukódik');
    await sheetTo('full');
  }

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

  // Mobilon a szűrők sora jelzi a kikapcsolt szűrőket
  if (mobile) {
    await page.locator('#scroll').evaluate(e => { e.scrollTop = e.scrollHeight / 2; });
    await openFilters();
    check(await page.locator('#sources').isVisible() && await page.locator('#sources').evaluate(e => { const r = e.getBoundingClientRect(), s = document.getElementById('scroll').getBoundingClientRect(); return r.top >= s.top && r.top < s.bottom; }), 'a lista közepéről is a szűrők a kereső alatt nyílnak meg, láthatóan');
    const src = page.locator('#sources input[data-s]').first();
    await src.uncheck();
    const fl = await page.locator('#fltBtn');
    check((await fl.locator('.c').textContent()) === '1' && /1 kikapcsolva/.test(await fl.getAttribute('aria-label')), `a Szűrők gomb jelzi a kikapcsolt szűrőt („${await fl.getAttribute('aria-label')}”)`);
    await src.check();
    await page.click('#fltBtn');
  }

  // Mobilon a nyitott lap takarja a térkép vezérlőit (a forrásfeliratot), nem fordítva
  if (mobile) {
    const att = await page.locator('.leaflet-control-attribution').boundingBox();
    const onTop = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('#side'), [att.x + 5, att.y + att.height / 2]);
    check(onTop, 'nyitott lapnál a térkép forrásfelirata a lap alatt marad');
  }

  // Kattintás a listában → felugró ablak a részlet adataival
  await page.locator('#list .item').first().click();
  await page.waitForSelector('.leaflet-popup-content .pp', { timeout: 5000 }).catch(() => {});
  const popup = await page.locator('.leaflet-popup-content .pp h3').textContent().catch(() => null);
  check(!!popup, `listaelemre kattintva megnyílik a részlet ablaka (${popup})`);
  if (mobile) {
    await page.waitForTimeout(600);
    const side = await page.locator('#side').boundingBox(), pp = await page.locator('.leaflet-popup').boundingBox();
    check(await sheetState() === 'peek', 'listaelemre kattintva a lap csúcs állásba csukódik');
    check(pp && pp.y >= 0 && pp.y + pp.height <= side.y + 1, `a részlet ablaka teljes egészében a lap fölött, a térképen látszik (${Math.round(pp?.y)}–${Math.round(pp?.y + pp?.height)} px, lap: ${Math.round(side.y)} px)`);
    await page.click('.leaflet-popup-close-button');
    await sheetTo('full');
    await page.locator('#about').scrollIntoViewIfNeeded();
  }

  // Névjegy doboz látszik, a Források ablak minden forrást felsorol
  const about = await page.locator('#about').boundingBox();
  check(about && about.y >= 0 && about.y + about.height <= viewport.height + 1, 'a névjegy doboz a képernyőn belül van');
  const fb = await page.locator('#about #fbLink');
  check(await fb.isVisible() && /\/issues\/new\/choose$/.test(await fb.getAttribute('href')), 'a névjegy dobozban látszik a Visszajelzés link (issue-választó)');
  const overflow = await page.locator('#about').evaluate(e => e.scrollWidth > e.clientWidth);
  check(!overflow, 'a névjegy doboz tartalma nem lóg ki vízszintesen');
  await page.click('#srcBtn');
  const srcItems = await page.locator('#srcDlg[open] #srcList li').count();
  check(srcItems === ERDO.sources.length + 2, `a Források ablakban ${ERDO.sources.length} forrás + NÉBIH + Turistautak van (talált: ${srcItems})`);
  await page.keyboard.press('Escape');

  // Fogalomtár: a jelmagyarázat fejlécéből megnyílik, minden látható mód szerepel benne, a hivatkozások linkek, nem lóg ki
  await openFilters();
  await page.click('#glsBtn');
  check(await page.locator('#glsDlg[open]').count() === 1, 'a „Mit jelentenek?” gombra megnyílik a Fogalomtár ablak');
  const legendModes = await page.locator('#legend [data-k]').count();
  const glsModes = await page.locator('#glsDlg .gm').count();
  check(glsModes === legendModes && glsModes > 0, `a Fogalomtárban a jelmagyarázat mind a ${legendModes} módja szerepel (talált: ${glsModes})`);
  const hrefs = await page.$$eval('#glsDlg a', as => as.map(a => a.getAttribute('href')));
  const bad = hrefs.filter(h => !/^https:\/\/[^\s]+$/.test(h || ''));
  check(hrefs.length > glsModes && !bad.length, `a Fogalomtár hivatkozásai érvényes https-linkek (${hrefs.length} db${bad.length ? ', hibás: ' + bad.join(', ') : ''})`);
  check(await page.$$eval('#glsDlg a', as => as.every(a => a.target === '_blank' && /noopener/.test(a.rel))), 'a Fogalomtár linkjei új lapon nyílnak (noopener)');
  const dlgBox = await page.locator('#glsDlg').boundingBox();
  check(dlgBox && dlgBox.x >= 0 && dlgBox.x + dlgBox.width <= viewport.width + 1 && dlgBox.y >= 0 && dlgBox.y + dlgBox.height <= viewport.height + 1, 'a Fogalomtár ablak a képernyőn belül van');
  check(!(await page.locator('#glsDlg').evaluate(e => e.scrollWidth > e.clientWidth)), 'a Fogalomtár tartalma nem lóg ki vízszintesen');
  check(await page.locator('#glsDlg').evaluate(e => e.scrollHeight <= e.clientHeight + 1), 'a Fogalomtár ablak maga nem görget, csak a törzse (a görgetősáv nem lóg át a fejlécen és a sarkokon)');
  await page.keyboard.press('Escape');
  // „bővebben” egy mód ? dobozából: a Fogalomtár az adott módnál nyílik meg
  await page.locator('#legend .fold').first().click();
  await page.locator('#legend .lgm .info').first().click();
  await page.locator('#legend .lgm .desc.open .more').first().click();
  check(await page.locator('#glsDlg[open] .gm.hl').count() === 1, 'a ? doboz „bővebben” gombja a Fogalomtárban a módhoz ugrik');
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
