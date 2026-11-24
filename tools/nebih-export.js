// NÉBIH Erdőtérkép → data/<forrás>.js sorai
// ---------------------------------------------------------------
// Használat:
//  1. Nyisd meg: https://erdoterkep.nebih.gov.hu/ (a WFS csak innen érhető el, más oldalról CORS miatt nem)
//  2. F12 → Console, másold be ezt a scriptet. Előtte töltsd ki az INPUT-ot VAGY a ROWS-t:
//     - INPUT: soronként „Település tag részlet | fahasználat | várható befejezés (opcionális)”;
//              a fahasználat lehet hivatalos kód, hivatalos név vagy a CODES táblában felsorolt saját elnevezés
//              → a geometriát is a NÉBIH-ből veszi (pl. BP Erdő-féle listákhoz)
//     - ROWS:  a mymaps-kml-export.js vagy a powerbi-export.js kimenete. Ha egy sorban van
//              geometria (g), azt tartja meg, ha nincs (g: null, pl. pontos My Maps), a NÉBIH-ét veszi.
//              A sorok „x” mezője (a forrás saját adatai) a 12. elemként megy tovább.
//  3. Az eredmény a vágólapra kerül: ezt illeszd a data/<forrás>.js "rows" tömbjébe.
// Egy csomag (8 részlet) lekérése néhány másodperc, ezért 4 párhuzamos szálon fut.

const INPUT = `
Dunaszentmiklós 12 E | növekedésfokozó gyérítés
Lábatlan 19 B | bontás
`;
// a forrás saját elnevezése → hivatalos kód (az INPUT-hoz; indoklás: docs/fahasznalati-modok.md, „Leképezés”)
const CODES = { 'növekedésfokozó gyérítés': 'NFGY', 'bontás': 'BIZ-BONT', 'szerkezetátalakítás': 'BIZ-SZA' };   // BP Erdő
const ROWS = null;            // pl. ROWS = [ ...a mymaps-kml-export.js / powerbi-export.js kimenete... ]
const ALIAS = { 'HÁNTA': 'KISBÉR-HÁNTA' };   // ha a forrás más településnevet használ, mint a NÉBIH


// Hivatalos (NÉBIH) fakitermelési és haszonvételi kódok → név; a térkép MODES kulcsai (docs/fahasznalati-modok.md)
const OFFICIAL = { TI: 'Tisztítás', TKGY: 'Törzskiválasztó gyérítés', NFGY: 'Növedékfokozó gyérítés', HGY: 'Haszonvételi gyérítés',
  'EÜ': 'Egészségügyi fakitermelés', ET: 'Egyéb termelés', KGH: 'Készletgondozó használat', SZV: 'Szálalóvágás',
  FVB: 'Felújító vágás bontó vágása', FVV: 'Felújító vágás végvágása', TRV: 'Tarvágás',
  'VÁT': 'Erdőfelújítás érdekében végzett vágástakarítás', 'ÁP': 'Erdősítés érdekében végzett ápolás',
  'BEFÁP': 'Befejezett ápolás során végzett ápolóvágás', FFK: 'Faanyag felkészítése', 'FGÁ': 'Fekvő gally gyűjtése, nyesés',
  CSK: 'Cserje kitermelése', TK: 'Tuskó termelése' };
const EXTRA_KEYS = ['BIZ-BONT', 'BIZ-SZA'];   // bizonytalan besorolás: a térképen használt, nem hatósági kulcsok
// forrás saját elnevezése → kód: előbb a codes tábla, aztán maga a kód, aztán a hivatalos név (kis/nagybetű nem számít)
const toCode = (v, codes) => { if (!v) return v; const s = v.trim().replace(/\s+/g, ' '), l = s.toLowerCase();
  for (const [k, c] of Object.entries(codes)) if (k.toLowerCase() === l) return c;
  if (OFFICIAL[s.toUpperCase()] || EXTRA_KEYS.includes(s.toUpperCase())) return s.toUpperCase();
  return Object.keys(OFFICIAL).find(k => OFFICIAL[k].toLowerCase() === l) || s; };
const isKnown = c => !!OFFICIAL[c] || EXTRA_KEYS.includes(c);
// ha a forrás elnevezése eltér a hivatalos kódtól és névtől, a felugró ablakban is megjelenik („Fahasználat a forrás szerint”)
const sourceName = (v, code) => { if (!v) return null; const s = v.trim().replace(/\s+/g, ' ');
  return s.toUpperCase() === code || (OFFICIAL[code] || '').toLowerCase() === s.toLowerCase() ? null : s; };
const withSource = (x, v, code) => { const s = sourceName(v, code); return s ? { 'Fahasználat a forrás szerint': s, ...(x || {}) } : x; };

(async () => {
  const enc = pts => { let s = '', pl = 0, pn = 0;
    const e = v => { v = v < 0 ? ~(v << 1) : (v << 1); let o = '';
      while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
      return o + String.fromCharCode(v + 63); };
    for (const [x, y] of pts) { const la = Math.round(y * 1e5), ln = Math.round(x * 1e5); s += e(la - pl) + e(ln - pn); pl = la; pn = ln; }
    return s; };
  const rows = ROWS || INPUT.trim().split('\n').filter(l => l.trim()).map(l => {
    const [nev, haszn, befejezes] = l.split('|').map(s => s.trim());
    return { nev: nev.replace(/(\d+)\s*([A-ZÁÉÍÓÖŐÚÜŰ]+)$/, '$1 $2'), haszn: toCode(haszn, CODES), befejezes: befejezes || null, g: null, x: withSource(null, haszn, toCode(haszn, CODES)) }; });
  const unknownModes = [...new Set(rows.map(r => r.haszn).filter(h => !isKnown(h)))];
  // NÉBIH-kulcs: „TELEPÜLÉS TAG/RÉSZLET”, alrészletnél szóközzel: „B2” / „B 2” → „B 2”
  const key = n => { const m = n.match(/^(.+) (\d+) ?([A-ZÁÉÍÓÖŐÚÜŰ0-9 ]+)$/);
    if (!m) return null; const h = m[1].toUpperCase();
    return `${ALIAS[h] || h} ${m[2]}/${m[3].trim().replace(/^([A-ZÁÉÍÓÖŐÚÜŰ]+)\s*(\d+)$/, '$1 $2')}`; };
  const polys = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;   // a NÉBIH többnyire MultiPolygont ad, de nem mindig
  const jobs = [];
  for (let i = 0; i < rows.length; i += 8) {   // kis csomagokban, mert hosszú IN-listánál a szerver csonkol
    const part = rows.slice(i, i + 8);
    jobs.push({ ks: part.map(r => key(r.nev)).filter(Boolean), geom: part.some(r => !r.g) });
  }
  const found = []; let done = 0;
  const worker = async () => { while (jobs.length) { const j = jobs.shift();
    const u = '/geoserver/nebih/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=nebih:KUL_RESZLET_VW' +
      '&outputFormat=application/json&srsName=EPSG:4326' +
      '&propertyName=RET_ID,KORZET,TULF,REND,NATURA2000,VEDETT,KERES,TER' + (j.geom ? ',ALAKZAT' : '') +
      '&CQL_FILTER=' + encodeURIComponent(`KERES IN (${j.ks.map(k => `'${k}'`).join(',')})`);
    found.push(...(await (await fetch(u)).json()).features);
    console.log(`${++done} csomag kész`); } };
  await Promise.all([1, 2, 3, 4].map(worker));
  const missing = [];
  const out = rows.map(r => {
    const f = found.find(f => f.properties.KERES === key(r.nev));
    if (!f) missing.push(r.nev);
    const p = f ? f.properties : {};
    const g = r.g || (f && f.geometry ? polys(f.geometry).map(poly => poly.map(enc)) : null);
    const row = [r.nev, r.haszn, r.befejezes, p.KORZET ?? null, p.TER ?? null, p.TULF ?? null, p.REND ?? null,
                 p.NATURA2000 ?? null, p.VEDETT ?? null, p.RET_ID ?? null, g];
    if (r.x && Object.keys(r.x).length) row.push(r.x);
    return row;
  }).filter(r => r[10]);
  copy(out.map(r => JSON.stringify(r)).join(',\n'));
  console.log(`${out.length} sor a vágólapon.`, missing.length ? 'Nem található a NÉBIH-ben:' : '', missing,
    unknownModes.length ? 'Ismeretlen fahasználati módok (a CODES-ban kell a hivatalos kódra fordítani):' : '', unknownModes);
})();
