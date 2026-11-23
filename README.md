# Tervezett fakitermelések térképe

**Élő oldal: https://norbert-olah.github.io/tervezett-fakitermelesek-terkep/**

Személyes használatra készült térkép, amely egy felületen mutatja az állami erdőgazdaságok által közzétett (tervezett vagy folyamatban lévő) fakitermeléseket, erdőrészletenként, fahasználati módonként színezve.

Háttér: a Telex 2026. 11. 23-i cikke szerint minden erdőgazdaság másképp (vagy egyáltalán nem) teszi közzé, hol vágnak védett erdőben.

## Adatforrások

| Erdőgazdaság | Forrás | Formátum | Részletek |
|---|---|---|---|
| Budapesti Erdőgazdaság Zrt. | [2026-ban még hátralévő tervezett fakitermelések](https://www.bp-erdo.hu/hu/2026-evben-meg-hatralevo-tervezett-fakitermelesek) | HTML-táblázat (erdőrészlet + fahasználat) | 40 |
| Vérteserdő Zrt. | [Aktuális tevékenységeink](https://verteserdo.hu/aktualis-tevekenysegeink/) | Google Saját térkép (KML), várható befejezéssel | 98 |

## Importálási napló

Minden új forrásnál vagy frissítésnél ide kerül egy sor (és a `data/<forrás>.js` `importalva` mezője is frissül).

| Importálva | Erdőgazdaság | Forrás közzététele | Letöltve | Részletek | Megjegyzés |
|---|---|---|---|---|---|
| 2026-11-23 | Budapesti Erdőgazdaság Zrt. | 2026-11-17 | 2026-11-23 | 40 | első import |
| 2026-11-23 | Vérteserdő Zrt. | 2026-11-11 | 2026-11-23 | 98 | első import |

A részlethatárokat, a területet, a védettséget, a Natura 2000-es státuszt és a rendeltetést a [NÉBIH Erdőtérkép](https://erdoterkep.nebih.gov.hu/) nyilvános GeoServer WFS-éből (`nebih:KUL_RESZLET_VW`) kértem le. A Vérteserdőnél a saját KML-jük geometriája szerepel. Letöltés: 2026. 11. 23.

Ismert eltérések:
- A Vérteserdő „Hánta” néven közölt részletei a NÉBIH-ben „Kisbér-Hánta” néven szerepelnek.
- „Császár 29 C” a NÉBIH-ben nem található (ott 29/A, B, D, F, G van), ezért ennél nincs terület- és védettségi adat.

## Használat

- **Böngészőben:** nyisd meg az `index.html`-t (duplakattal is működik). Az OpenStreetMap-háttér `file://`-ból tilthatja a csempéket. Az alapértelmezett Esri-háttér és a NÉBIH-réteg így is betöltődik.
- **Webszerveren:** bármilyen statikus hoszting jó, például GitHub Pages (Settings → Pages → Branch: `main` / root), vagy helyben:
  ```
  python -m http.server 8000
  ```

A Claude alkalmazás és más, sandboxolt előnézetek nem töltenek be külső képeket, ezért ott a háttértérkép üres marad.

## Felépítés

```
index.html                 a térkép (Leaflet 1.9.4, unpkg-ről)
data/bp-erdo.js            BP Erdő adatai
data/verteserdo.js         Vérteserdő adatai
tools/nebih-export.js      konzolscript: erdőrészlet-lista → adatsorok a NÉBIH-ből
tools/mymaps-kml-export.js konzolscript: Google My Maps → adatsorok (geometriával)
```

Egy adatsor: `[erdőrészlet, fahasználat, várható befejezés, körzet, terület (ha), tulajdon, rendeltetés, Natura 2000, védettség, NÉBIH RET_ID, geometria]`. A geometria poligononként gyűrűk listája, [Google encoded polyline](https://developers.google.com/maps/documentation/utilities/polylinealgorithm) formában (1e-5 fok ≈ 1 m pontosság).

## Új forrás vagy frissítés

A NÉBIH WFS-e más oldalról nem hívható (nincs CORS), ezért a lekérés az Erdőtérkép oldalán, a böngésző konzoljában fut:

1. **Csak erdőrészlet-lista van** (mint a BP Erdőnél): nyisd meg az https://erdoterkep.nebih.gov.hu/ oldalt, töltsd ki a `tools/nebih-export.js` `INPUT`-ját, és futtasd a konzolban.
2. **Saját térkép van (Google My Maps):** a térkép oldalán futtasd a `tools/mymaps-kml-export.js`-t, a kimenetét add meg `ROWS`-ként a `nebih-export.js`-ben, és futtasd az Erdőtérkép oldalán.
3. A vágólapra került sorokat tedd egy `data/<forras>.js` fájlba (a meglévők mintájára, `ERDO.add({...})`), és vegyél fel hozzá egy `<script src="data/<forras>.js">` sort az `index.html`-be.
4. Írd be az importálás dátumát a fájl `importalva` mezőjébe és az **Importálási napló** táblázatba.

Új fahasználati mód esetén a `MODES` tömbbe (index.html) kell egy szín és egy rövid leírás.

## Ellenőrzés (CI)

Minden pull requestnél és `main`-re pusholásnál lefut a `.github/workflows/ci.yml`, két külön jobbal (mindkettő beállítható kötelező ellenőrzésnek):

- **Adatellenőrzés** (`tools/ci/validate-data.mjs`, függőség nélkül):
  - minden `data/*.js` be van-e töltve az `index.html`-ben, és fordítva;
  - lefut-e hiba nélkül a fájl;
  - megvannak-e a kötelező mezők, és ÉÉÉÉ-HH-NN formájúak-e a dátumok;
  - szerepel-e minden fahasználati mód a `MODES` tömbben;
  - érvényes-e a polyline, zártak-e a gyűrűk, és Magyarországon belül vannak-e a koordináták;
  - van-e sor a forráshoz az **Importálási naplóban**.
- **Böngészős füstteszt** (`tools/ci/smoke-test.mjs`, Playwright + Chromium): asztali és mobil méretben betölti az oldalt, és ellenőrzi, hogy
  - nincs-e JavaScript-hiba;
  - mind az összes erdőrészlet kirajzolódik-e;
  - működik-e a keresés és a felugró ablak;
  - látszik-e a névjegy doboz, és teljes-e a Források ablak.

  A háttércsempéket és a NÉBIH-réteget a teszt kikapcsolja, hogy külső szolgáltatás kiesése ne buktassa. A képernyőképek letölthetők a futás artifactjai közül.

Helyben:
```
node tools/ci/validate-data.mjs
npm install --no-save playwright@1.49.1 && npx playwright install chromium
python3 -m http.server 8000 &   # másik terminálban
node tools/ci/smoke-test.mjs
```

## Megjegyzés

A térkép a közzétett adatokat mutatja, a tényleges munkák ettől eltérhetnek (időjárás, módosított tervek). A fahasználati módok leírása tájékoztató jellegű.
