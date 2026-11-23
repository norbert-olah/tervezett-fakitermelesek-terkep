// Mecsekerdő Power BI-jelentés → fakitermelési sorok (geometriával)
// ---------------------------------------------------------------
// A Mecsekerdő az aktuális munkáit egy nyilvános („Publish to web”) Power BI-jelentésben teszi közzé
// (https://mecsekerdo.hu/fenntarthato-gazdalkodas/erdokezelesunk/). A jelentés modellje tartalmazza
// az ütemezést (T_Utemezes), a részletadatokat (D_Erdoreszlet), a használati módokat (D_Hmod) és a
// részlethatárokat WKT-ként (D_Hatter), ezt kérdezi le a jelentés saját nyilvános API-ján keresztül.
//
// Használat:
//  1. Nyisd meg a jelentést (CONFIG.url), várd meg, amíg betölt.
//  2. F12 → Console, másold be ezt a scriptet, Enter.
//  3. Az eredmény (JSON tömb) a vágólapra kerül → ezt add meg ROWS-ként a nebih-export.js-ben
//     (az erdoterkep.nebih.gov.hu oldalon), az hozzáteszi a NÉBIH-adatokat.
//  A konzolban megjelenik a modell utolsó frissítésének ideje is (→ „kozzetett” mező).

const CONFIG = {
  url: 'https://app.powerbi.com/view?r=eyJrIjoiZWIzNjY3ZGYtYWE0Mi00NTdhLTkxZWYtNzhhNmEyYWY1YWRiIiwidCI6IjlmYzEyMDA3LWM1ZGMtNDgwZC05YTQ0LWZlOGFkZTExY2NkMyIsImMiOjl9',
  api: 'https://wabi-west-europe-e-primary-api.analysis.windows.net/public/reports/',   // a jelentés hálózati kéréseiben látszik
  // használati mód kódja (D_Hmod[Használati mód]) → hivatalos kód. A Mecsekerdő a NÉBIH-kódokat használja, ezeket nem
  // kell felsorolni; a modellben szereplő HF és FELK nem NÉBIH-kód, a jelentésük tisztázandó (docs/fahasznalati-modok.md).
  codes: {}
};
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


(async () => {
  const KEY = JSON.parse(atob(new URL(CONFIG.url).searchParams.get('r'))).k;
  const H = { 'X-PowerBI-ResourceKey': KEY, 'Content-Type': 'application/json;charset=UTF-8' };
  const me = await (await fetch(CONFIG.api + KEY + '/modelsAndExploration?preferReadOnlySession=true', { headers: H })).json();
  const model = me.models[0];

  // Egyszerű „táblázat” lekérdezés: [[tábla, oszlop], …] → sorok. A válasz tömörített DSR formátumú (R = ismétlés, Ø = null).
  const query = async cols => {
    const ents = [...new Set(cols.map(c => c[0]))], al = Object.fromEntries(ents.map((e, i) => [e, 't' + i]));
    const body = { version: '1.0.0', cancelQueries: [], modelId: model.id, queries: [{ QueryId: '',
      ApplicationContext: { DatasetId: model.dbName, Sources: [{ ReportId: me.exploration.report.objectId }] },
      Query: { Commands: [{ SemanticQueryDataShapeCommand: {
        Query: { Version: 2, From: ents.map(e => ({ Name: al[e], Entity: e, Type: 0 })),
          Select: cols.map(([e, p]) => ({ Column: { Expression: { SourceRef: { Source: al[e] } }, Property: p }, Name: e + '.' + p })) },
        Binding: { Primary: { Groupings: [{ Projections: cols.map((_, i) => i) }] }, DataReduction: { DataVolume: 4, Primary: { Window: { Count: 30000 } } }, Version: 1 } } }] } }] };
    const r = await (await fetch(CONFIG.api + 'querydata?synchronous=true', { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
    const ds = r.results[0].result.data.dsr.DS[0], dicts = ds.ValueDicts || {}, rows = [];
    if (!ds.IC) console.warn('A Power BI csonkolta a választ, nem minden sor jött meg!', cols);
    let S, prev = [];
    for (const ph of ds.PH) for (const k in ph) for (const row of ph[k]) {
      if (row.S) S = row.S;
      const out = []; let ci = 0;
      for (let i = 0; i < S.length; i++) {
        if ((row.R || 0) & (1 << i)) { out.push(prev[i]); continue; }
        if ((row['Ø'] || 0) & (1 << i)) { out.push(null); continue; }
        let v = row.C[ci++]; if (S[i].DN && typeof v === 'number') v = dicts[S[i].DN][v]; out.push(v);
      }
      rows.push(prev = out);
    }
    return rows;
  };

  const enc = pts => { let s = '', pl = 0, pn = 0;
    const e = v => { v = v < 0 ? ~(v << 1) : (v << 1); let o = '';
      while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
      return o + String.fromCharCode(v + 63); };
    for (const [x, y] of pts) { const la = Math.round(y * 1e5), ln = Math.round(x * 1e5); s += e(la - pl) + e(ln - pn); pl = la; pn = ln; }
    return s; };
  const wkt = w => { const t = w.trim(), body = t.replace(/^\w+\s*/, '');
    const polys = t.startsWith('MULTI') ? body.slice(1, -1).split(/\)\)\s*,\s*\(\(/) : [body];
    return polys.map(p => p.replace(/^\(+|\)+$/g, '').split(/\)\s*,\s*\(/).map(r => { const pts = [];
      for (const c of r.replace(/[()]/g, '').split(',')) { const [x, y] = c.trim().split(/\s+/).map(Number);
        const l = pts[pts.length - 1]; if (!l || l[0] !== x || l[1] !== y) pts.push([x, y]); }
      return pts.length >= 4 ? enc(pts) : null; }).filter(Boolean))   // elfajult (pl. egypontos) gyűrűk kihagyása
    .filter(p => p.length); };

  const U = await query([['T_Utemezes', 'azok'], ['T_Utemezes', 'hmod_kod'], ['T_Utemezes', 'Terv állapota'], ['T_Utemezes', 'ev'], ['T_Utemezes', 'honap_sz']]);
  const D = Object.fromEntries((await query([['D_Erdoreszlet', 'azok'], ['D_Erdoreszlet', 'Erdőrészlet'], ['D_Erdoreszlet', 'Erdészet'],
    ['D_Erdoreszlet', 'Üzemmód'], ['D_Erdoreszlet', 'Természetességi mutató']])).map(r => [r[0], r]));
  const HM = Object.fromEntries((await query([['D_Hmod', 'hmod_kod'], ['D_Hmod', 'Használati mód'], ['D_Hmod', 'Használati mód neve']])).map(r => [r[0], r]));
  const ids = new Set(U.map(r => r[0]));
  const G = Object.fromEntries((await query([['D_Hatter', 'azok'], ['D_Hatter', 'WKT']])).filter(r => ids.has(r[0])).map(r => [r[0], r[1]]));

  const HU = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const by = {};   // részlet + használati mód → ütemezett hónapok
  for (const [a, h, all, ev, ho] of U) { const k = a + '|' + h;
    (by[k] = by[k] || { a, h, all: new Set(), m: new Set() }); by[k].all.add(all); by[k].m.add(ev * 100 + ho); }
  const unknown = new Set(), noGeom = [];
  const rows = Object.values(by).map(({ a, h, all, m }) => {
    const d = D[a], code = HM[h][1], ms = [...m].sort(), last = ms[ms.length - 1];
    const years = [...new Set(ms.map(x => Math.floor(x / 100)))];
    const kod = toCode(code, CONFIG.codes);
    if (!isKnown(kod)) unknown.add(`${code} (${HM[h][2]})`);
    if (!G[a]) noGeom.push(d[1]);
    return { nev: d[1].replace(/\s+/g, ' ').trim(), haszn: kod,
      befejezes: `${Math.floor(last / 100)}-${String(last % 100).padStart(2, '0')}`,
      x: Object.fromEntries(Object.entries({ 'Erdészet': d[2],
           'Ütemezett hónapok': years.map(y => `${y}: ` + ms.filter(x => Math.floor(x / 100) === y).map(x => HU[x % 100 - 1]).join(', ')).join('; '),
           'Terv állapota': [...all].join(', '), 'Üzemmód': d[3], 'Természetességi mutató': d[4] }).filter(([, v]) => v != null)),   // egyéb részleteknél (út, nyiladék) nincs üzemmód
      g: G[a] ? wkt(G[a]) : null };
  });
  copy(JSON.stringify(rows));
  console.log(`${rows.length} sor a vágólapon. Modell frissítve: ${model.LastRefreshTime}.`,
    unknown.size ? 'Ismeretlen használati módok (a CONFIG.codes-ban kell a hivatalos kódra fordítani):' : '', [...unknown], noGeom.length ? 'Geometria nélkül:' : '', noGeom);
})();
