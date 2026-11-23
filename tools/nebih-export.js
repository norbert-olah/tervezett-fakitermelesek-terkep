// NÉBIH Erdőtérkép → data/<forrás>.js sorai
// ---------------------------------------------------------------
// Használat:
//  1. Nyisd meg: https://erdoterkep.nebih.gov.hu/ (a WFS csak innen érhető el, más oldalról CORS miatt nem)
//  2. F12 → Console, másold be ezt a scriptet. Előtte töltsd ki az INPUT-ot VAGY a ROWS-t:
//     - INPUT: soronként „Település tag részlet | fahasználat | várható befejezés (opcionális)”
//              → a geometriát is a NÉBIH-ből veszi (pl. BP Erdő-féle listákhoz)
//     - ROWS:  a mymaps-kml-export.js kimenete (saját geometriával) → csak az adatokat teszi hozzá
//  3. Az eredmény a vágólapra kerül: ezt illeszd a data/<forrás>.js "rows" tömbjébe.

const INPUT = `
Dunaszentmiklós 12 E | növekedésfokozó gyérítés
Lábatlan 19 B | bontás
`;
const ROWS = null;            // pl. ROWS = [ ...a mymaps-kml-export.js kimenete... ]
const ALIAS = { 'HÁNTA': 'KISBÉR-HÁNTA' };   // ha a forrás más településnevet használ, mint a NÉBIH

(async () => {
  const enc = pts => { let s = '', pl = 0, pn = 0;
    const e = v => { v = v < 0 ? ~(v << 1) : (v << 1); let o = '';
      while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
      return o + String.fromCharCode(v + 63); };
    for (const [x, y] of pts) { const la = Math.round(y * 1e5), ln = Math.round(x * 1e5); s += e(la - pl) + e(ln - pn); pl = la; pn = ln; }
    return s; };
  const rows = ROWS || INPUT.trim().split('\n').filter(l => l.trim()).map(l => {
    const [nev, haszn, befejezes] = l.split('|').map(s => s.trim());
    return { nev: nev.replace(/(\d+)\s*([A-ZÁÉÍÓÖŐÚÜŰ]+)$/, '$1 $2'), haszn: haszn.toLowerCase(), befejezes: befejezes || null, g: null }; });
  const key = n => { const m = n.match(/^(.+) (\d+) ?([A-ZÁÉÍÓÖŐÚÜŰ0-9 ]+)$/);
    if (!m) return null; const h = m[1].toUpperCase(); return `${ALIAS[h] || h} ${m[2]}/${m[3].trim()}`; };
  const found = [];
  for (let i = 0; i < rows.length; i += 8) {   // kis csomagokban, mert hosszú IN-listánál a szerver csonkol
    const ks = rows.slice(i, i + 8).map(r => key(r.nev)).filter(Boolean);
    const u = '/geoserver/nebih/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=nebih:KUL_RESZLET_VW' +
      '&outputFormat=application/json&srsName=EPSG:4326' +
      '&propertyName=RET_ID,KORZET,TULF,REND,NATURA2000,VEDETT,KERES,TER,ALAKZAT' +
      '&CQL_FILTER=' + encodeURIComponent(`KERES IN (${ks.map(k => `'${k}'`).join(',')})`);
    found.push(...(await (await fetch(u)).json()).features);
    console.log(`${Math.min(i + 8, rows.length)}/${rows.length}`);
  }
  const missing = [];
  const out = rows.map(r => {
    const f = found.find(f => f.properties.KERES === key(r.nev));
    if (!f) missing.push(r.nev);
    const p = f ? f.properties : {};
    const g = r.g || (f ? f.geometry.coordinates.map(poly => poly.map(enc)) : null);
    return [r.nev, r.haszn, r.befejezes, p.KORZET ?? null, p.TER ?? null, p.TULF ?? null, p.REND ?? null,
            p.NATURA2000 ?? null, p.VEDETT ?? null, p.RET_ID ?? null, g];
  }).filter(r => r[10]);
  copy(out.map(r => JSON.stringify(r)).join(',\n'));
  console.log(`${out.length} sor a vágólapon.`, missing.length ? 'Nem található a NÉBIH-ben:' : '', missing);
})();
