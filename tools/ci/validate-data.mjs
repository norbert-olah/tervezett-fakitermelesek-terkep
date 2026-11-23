// Adatellenőrzés: a data/*.js fájlok szerkezete, geometriája és a README importálási naplója.
// Futtatás: node tools/ci/validate-data.mjs   (függőség nélkül, Node 18+)
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);

const html = readFileSync('index.html', 'utf8');
const readme = readFileSync('README.md', 'utf8');

// 1. index.html ↔ data/ mappa
// 0. csak saját (repóbeli) scriptek, stílusok és betűtípusok: külső szolgáltatónak ne menjen ki a látogató IP-címe
for (const [, tag, url] of html.matchAll(/<(script|link)\b[^>]*?\b(?:src|href)="(https?:\/\/[^"]+)"/g))
  err(`index.html: külső ${tag === 'script' ? 'script' : 'stílus/erőforrás'} (${url}) – tedd a vendor/ mappába`);
for (const [, url] of html.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)/g)) err(`index.html: külső CSS-erőforrás (${url})`);

const referenced = [...html.matchAll(/<script src="(data\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
const onDisk = readdirSync('data').filter(f => f.endsWith('.js')).map(f => 'data/' + f);
for (const f of onDisk) if (!referenced.includes(f)) err(`${f} nincs betöltve az index.html-ben`);
for (const f of referenced) if (!onDisk.includes(f)) err(`az index.html olyan fájlt tölt be, ami nincs meg: ${f}`);

// 2. ismert fahasználati módok (hivatalos kódok) az index.html MODES tömbjéből
const modes = new Set([...html.matchAll(/\{k:'([^']+)', n:'[^']+', c:'#[0-9a-f]{6}'/gi)].map(m => m[1]));
if (!modes.size) err('nem találom a MODES tömböt az index.html-ben');

// 3. adatfájlok betöltése ugyanúgy, ahogy a böngésző teszi
const ERDO = { sources: [], add(s) { this.sources.push(s); } };
const ctx = vm.createContext({ ERDO });
for (const f of referenced.filter(f => onDisk.includes(f))) {
  const before = ERDO.sources.length;
  try { vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f }); }
  catch (e) { err(`${f}: JavaScript-hiba: ${e.message}`); continue; }
  if (ERDO.sources.length !== before + 1) err(`${f}: pontosan egy ERDO.add(...) hívást várok`);
  else ERDO.sources[ERDO.sources.length - 1]._file = f;
}

const decode = s => { const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < s.length) { const v = [0, 0];
    for (let j = 0; j < 2; j++) { let r = 0, sh = 0, b;
      do { if (i >= s.length) throw new Error('csonka polyline'); b = s.charCodeAt(i++) - 63;
        if (b < 0 || b > 63) throw new Error('érvénytelen karakter'); r |= (b & 31) << sh; sh += 5; } while (b >= 32);
      v[j] = (r & 1) ? ~(r >> 1) : (r >> 1); }
    lat += v[0]; lng += v[1]; pts.push([lat / 1e5, lng / 1e5]); }
  return pts; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);   // ha a forrás csak hónapot ad (pl. Mecsekerdő ütemezése)
const HU = { latMin: 45.7, latMax: 48.6, lngMin: 16.1, lngMax: 22.9 };   // Magyarország befoglaló téglalapja

const ids = new Set();
let total = 0;
for (const s of ERDO.sources) {
  const P = `${s._file} (${s.id})`;
  for (const k of ['id', 'nev', 'rovid', 'url', 'importalva'])
    if (!s[k]) err(`${P}: hiányzó mező: ${k}`);
  // kozzetett: kötelező mező, de lehet null, ha a forrás nem közöl dátumot (pl. Egererdő)
  if (!('kozzetett' in s)) err(`${P}: hiányzó mező: kozzetett (null, ha a forrás nem közli)`);
  if (ids.has(s.id)) err(`${P}: ismétlődő forrás-azonosító`); ids.add(s.id);
  if (s.url && !/^https:\/\//.test(s.url)) err(`${P}: az url nem https`);
  for (const k of ['kozzetett', 'importalva']) if (s[k] && !isDate(s[k])) err(`${P}: ${k} nem ÉÉÉÉ-HH-NN dátum: ${s[k]}`);
  if (!Array.isArray(s.rows) || !s.rows.length) { err(`${P}: üres vagy hiányzó rows`); continue; }

  // README importálási napló: kell egy sor ezzel a dátummal és erdőgazdaság-névvel
  if (s.importalva && s.nev && !readme.split('\n').some(l => l.startsWith(`| ${s.importalva} | ${s.nev} |`)))
    err(`README.md: hiányzik az importálási napló sora: "| ${s.importalva} | ${s.nev} | ..."`);

  const names = new Set();
  s.rows.forEach((r, i) => {
    const R = `${P} #${i + 1}${Array.isArray(r) && r[0] ? ` „${r[0]}”` : ''}`;
    if (!Array.isArray(r) || (r.length !== 11 && r.length !== 12)) { err(`${R}: 11 (vagy extra mezővel 12) elemű tömböt várok`); return; }
    const [nev, haszn, bef, , ter, , , , , , g, x] = r;
    if (r.length === 12 && !(x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every(v => typeof v === 'string')))
      err(`${R}: a 12. (extra) elem {címke: szöveg} objektum legyen`);
    if (typeof nev !== 'string' || !/^.+ \d+ ?[A-ZÁÉÍÓÖŐÚÜŰ0-9 ]+$/.test(nev)) err(`${R}: az erdőrészlet neve nem „Település tag részlet” formájú`);
    if (names.has(nev)) warn(`${R}: ismétlődő erdőrészlet a forráson belül`); names.add(nev);
    if (!modes.has(haszn)) err(`${R}: ismeretlen fahasználati mód: „${haszn}” (a forrás saját elnevezését a szkript codes táblájában kell a hivatalos kódra fordítani, l. docs/fahasznalati-modok.md; új kód esetén vedd fel a MODES tömbbe)`);
    if (bef !== null && !isDate(bef) && !isMonth(bef)) err(`${R}: a várható befejezés nem ÉÉÉÉ-HH-NN vagy ÉÉÉÉ-HH: ${bef}`);
    if (ter !== null && !(typeof ter === 'number' && ter > 0 && ter < 1000)) err(`${R}: gyanús terület: ${ter}`);
    if (ter === null) warn(`${R}: nincs NÉBIH-adat (terület, védettség)`);
    if (!Array.isArray(g) || !g.length) { err(`${R}: hiányzó geometria`); return; }
    for (const poly of g) for (const ring of poly) {
      let pts; try { pts = decode(ring); } catch (e) { err(`${R}: hibás polyline: ${e.message}`); continue; }
      if (pts.length < 4) err(`${R}: túl kevés pontú gyűrű (${pts.length})`);
      const [a, b] = [pts[0], pts[pts.length - 1]];
      if (a[0] !== b[0] || a[1] !== b[1]) err(`${R}: nem zárt gyűrű`);
      if (pts.some(([la, lo]) => la < HU.latMin || la > HU.latMax || lo < HU.lngMin || lo > HU.lngMax))
        err(`${R}: Magyarországon kívüli koordináta (felcserélt lat/lng?)`);
    }
  });
  total += s.rows.length;
  console.log(`✓ ${s.id}: ${s.rows.length} erdőrészlet`);
}

for (const w of warnings) console.log(`::warning::${w}`);
for (const e of errors) console.log(`::error::${e}`);
console.log(`\n${ERDO.sources.length} forrás, ${total} erdőrészlet, ${errors.length} hiba, ${warnings.length} figyelmeztetés`);
process.exit(errors.length ? 1 : 0);
