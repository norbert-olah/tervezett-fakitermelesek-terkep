// Google Saját térkép (My Maps) → fakitermelési sorok
// ---------------------------------------------------------------
// Használat:
//  1. Nyisd meg a térképet: https://www.google.com/maps/d/viewer?mid=<MID>
//  2. F12 → Console, másold be ezt a scriptet, állítsd be a CONFIG-ot, Enter.
//  3. Az eredmény (JSON tömb) a vágólapra kerül → ezt add meg ROWS-ként
//     a nebih-export.js-ben (az erdoterkep.nebih.gov.hu oldalon).
// A geometriát a My Maps KML-jéből veszi; a NÉBIH-adatokat a második lépés teszi hozzá.

const CONFIG = {
  mid: '1JqAtCPVt-i4SD440GXcEj0c8-QCJssA',      // a térkép azonosítója (mid=…)
  folder: 'Állománynevelési beavatkozások',     // csak ebből a rétegből (üres = mind)
  fieldHaszn: 'Erdőnevelési beavatkozás',       // ExtendedData mező: fahasználat
  fieldBefejezes: 'Várható befejezés',          // ExtendedData mező: dátum (vagy null)
  codes: { NFGY: 'növekedésfokozó gyérítés', TKGY: 'törzskiválasztó gyérítés', TI: 'tisztítás',
           'EÜ': 'egészségügyi termelés', ET: 'egyéb termelés', TRV: 'tarvágás',
           BO: 'bontás', SZA: 'szerkezetátalakítás' }
};

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
  const folders = [...doc.getElementsByTagName('Folder')].filter(f => !CONFIG.folder || f.getElementsByTagName('name')[0].textContent.trim() === CONFIG.folder);
  const pms = (folders.length ? folders : [doc]).flatMap(f => [...f.getElementsByTagName('Placemark')]);
  const dat = (p, k) => [...p.getElementsByTagName('Data')].find(d => d.getAttribute('name') === k)?.textContent.trim() || null;
  const rows = pms.filter(p => p.getElementsByTagName('Polygon').length).map(p => {
    const code = dat(p, CONFIG.fieldHaszn);
    const d = CONFIG.fieldBefejezes ? dat(p, CONFIG.fieldBefejezes) : null;
    return { nev: p.getElementsByTagName('name')[0].textContent.trim(),
      haszn: CONFIG.codes[code] || code,
      befejezes: d ? d.replace(/[./]/g, '-').replace(/-$/, '') : null,
      g: [...p.getElementsByTagName('Polygon')].map(pg => [...pg.getElementsByTagName('outerBoundaryIs'), ...pg.getElementsByTagName('innerBoundaryIs')].map(ring)) };
  });
  copy(JSON.stringify(rows));
  console.log(`${rows.length} sor a vágólapon. Ismeretlen kódok:`, [...new Set(rows.map(r => r.haszn).filter(h => !Object.values(CONFIG.codes).includes(h)))]);
})();
