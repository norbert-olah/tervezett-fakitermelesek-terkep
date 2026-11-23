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
    codes: { NFGY: 'növekedésfokozó gyérítés', TKGY: 'törzskiválasztó gyérítés', TI: 'tisztítás',
             'EÜ': 'egészségügyi termelés', ET: 'egyéb termelés', TRV: 'tarvágás',
             BO: 'bontás', SZA: 'szerkezetátalakítás' },
    extra: null                                    // ({folder, d}) => {címke: érték} a felugró ablakba
  },
  egererdo: {
    mid: '1edFqyqTrWi4-Gdpcgqgje9N7Li-W8Ao',
    folder: '',                                    // rétegenként egy erdészet
    fieldHaszn: 'Fahasználat módja',
    fieldBefejezes: null,
    codes: { 'Fokozatos felújítóvágás – bontóvágás': 'bontás', 'Növedékfokozó gyérítés': 'növekedésfokozó gyérítés',
             'Egészségügyi fakitermelés': 'egészségügyi termelés', 'Törzskiválasztó gyérítés': 'törzskiválasztó gyérítés',
             'Tisztítás': 'tisztítás', 'Tarvágás': 'tarvágás', 'Szálalóvágás': 'szálalóvágás',
             'Készletgondozó használat': 'készletgondozó használat', 'Egyéb termelés': 'egyéb termelés' },
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
  const known = new Set(Object.values(CONFIG.codes));
  const rows = pms.filter(({ p }) => p.getElementsByTagName('Polygon').length || p.getElementsByTagName('Point').length).map(({ p, folder }) => {
    const d = Object.fromEntries([...p.getElementsByTagName('Data')].map(e => [e.getAttribute('name'), e.textContent.trim()]));
    const code = d[CONFIG.fieldHaszn] || null;
    const bef = CONFIG.fieldBefejezes ? d[CONFIG.fieldBefejezes] : null;
    const polys = [...p.getElementsByTagName('Polygon')];
    const r = { nev: p.getElementsByTagName('name')[0].textContent.trim().replace(/\s+/g, ' '),
      haszn: CONFIG.codes[code] || (code ? code.toLowerCase() : code),
      befejezes: bef ? bef.replace(/[./]/g, '-').replace(/-$/, '') : null,
      g: polys.length ? polys.map(pg => [...pg.getElementsByTagName('outerBoundaryIs'), ...pg.getElementsByTagName('innerBoundaryIs')].map(ring)) : null };
    if (CONFIG.extra) r.x = CONFIG.extra({ folder, d });
    return r;
  });
  copy(JSON.stringify(rows));
  console.log(`${rows.length} sor a vágólapon (${rows.filter(r => !r.g).length} pont, ezekhez a NÉBIH adja a geometriát). Ismeretlen fahasználati módok:`,
    [...new Set(rows.map(r => r.haszn).filter(h => !known.has(h)))]);
})();
