// Google Saját térkép (My Maps) → fakitermelési sorok
// ---------------------------------------------------------------
// Használat:
//  1. Nyisd meg a térképet: https://www.google.com/maps/d/viewer?mid=<MID>
//  2. F12 → Console, másold be ezt a scriptet, válaszd ki a CONFIG-ot, Enter.
//  3. Az eredmény (JSON tömb) a vágólapra kerül → ezt add meg ROWS-ként
//     a nebih-export.js-ben (az erdoterkep.nebih.gov.hu oldalon).
// Poligonos térképnél a geometriát a My Maps KML-jéből veszi; pontos térképnél (pl. Egererdő)
// g: null lesz, és a nebih-export.js a NÉBIH részlethatárát teszi be.

const PRESETS = {
  verteserdo: {
    mid: '1JqAtCPVt-i4SD440GXcEj0c8-QCJssA',      // a térkép azonosítója (mid=…)
    folder: 'Állománynevelési beavatkozások',     // csak ebből a rétegből (üres = mind)
    fieldHaszn: 'Erdőnevelési beavatkozás',       // ExtendedData mező: fahasználat
    fieldBefejezes: 'Várható befejezés',          // ExtendedData mező: dátum (vagy null)
    // a forrás hivatalos kódokat használ (NFGY, TKGY, TI, EÜ, ET, TRV), ezeket nem kell felsorolni;
    // BO, SZA: felkészülésként, az eddigi importokban nem fordultak elő (bizonytalan besorolás)
    codes: { BO: 'BIZ-BONT', SZA: 'BIZ-SZA' },
    extra: null                                    // ({folder, d}) => {címke: érték} a felugró ablakba
  },
  egererdo: {
    mid: '1edFqyqTrWi4-Gdpcgqgje9N7Li-W8Ao',
    folder: '',                                    // rétegenként egy erdészet
    fieldHaszn: 'Fahasználat módja',
    fieldBefejezes: null,
    // a hivatalos nevekkel egyezőket (Növedékfokozó gyérítés, Tisztítás, Tarvágás stb.) nem kell felsorolni
    codes: { 'Fokozatos felújítóvágás – bontóvágás': 'FVB', 'Fokozatos felújítóvágás – végvágás': 'FVV' },
    extra: ({ folder, d }) => {
      const hu = (v, dec) => Number(v).toLocaleString('hu-HU', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      const x = { 'Erdészet': folder };
      const ter = d['Fahasználattal érintett terület nagysága (ha)'];
      const netto = d['Érintett fatömeg (nettó köbméter)'], brutto = d['Érintett fatömeg (köbméter)'];
      if (ter) x['Érintett terület (forrás)'] = hu(ter, 2) + ' ha';
      if (netto) x['Érintett fatömeg (forrás)'] = hu(netto, 0) + ' m³ (nettó)';
      else if (brutto) x['Érintett fatömeg (forrás)'] = hu(brutto, 0) + ' m³';
      return x;
    }
  }
};
const CONFIG = PRESETS.egererdo;

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
  const ring = el => { const out = [];
    for (const t of el.getElementsByTagName('coordinates')[0].textContent.trim().split(/\s+/)) {
      const [x, y] = t.split(',').map(Number); const q = [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];
      const l = out[out.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q); }
    return enc(out); };
  const xml = await (await fetch(`/maps/d/kml?mid=${CONFIG.mid}&forcekml=1`)).text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const fname = f => f.getElementsByTagName('name')[0].textContent.trim();
  const folders = [...doc.getElementsByTagName('Folder')].filter(f => !CONFIG.folder || fname(f) === CONFIG.folder);
  const pms = (folders.length ? folders : [doc]).flatMap(f => [...f.getElementsByTagName('Placemark')].map(p => ({ p, folder: f.tagName === 'Folder' ? fname(f) : '' })));
  const rows = pms.filter(({ p }) => p.getElementsByTagName('Polygon').length || p.getElementsByTagName('Point').length).map(({ p, folder }) => {
    const d = Object.fromEntries([...p.getElementsByTagName('Data')].map(e => [e.getAttribute('name'), e.textContent.trim()]));
    const code = d[CONFIG.fieldHaszn] || null;
    const bef = CONFIG.fieldBefejezes ? d[CONFIG.fieldBefejezes] : null;
    const polys = [...p.getElementsByTagName('Polygon')];
    const r = { nev: p.getElementsByTagName('name')[0].textContent.trim().replace(/\s+/g, ' '),
      haszn: toCode(code, CONFIG.codes),
      befejezes: bef ? bef.replace(/[./]/g, '-').replace(/-$/, '') : null,
      g: polys.length ? polys.map(pg => [...pg.getElementsByTagName('outerBoundaryIs'), ...pg.getElementsByTagName('innerBoundaryIs')].map(ring)) : null };
    if (CONFIG.extra) r.x = CONFIG.extra({ folder, d });
    r.x = withSource(r.x, code, r.haszn);
    return r;
  });
  copy(JSON.stringify(rows));
  console.log(`${rows.length} sor a vágólapon (${rows.filter(r => !r.g).length} pont, ezekhez a NÉBIH adja a geometriát). Ismeretlen fahasználati módok (a CONFIG.codes-ban kell a hivatalos kódra fordítani):`,
    [...new Set(rows.map(r => r.haszn).filter(h => !isKnown(h)))]);
})();
