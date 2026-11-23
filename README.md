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

Minden új forrásnál vagy frissítésnél ide kerül egy sor, és a `data/<forrás>.js` `importalva` mezője is frissül. A letöltés és az importálás mindig ugyanazon a napon történik, ezért egy dátum tartozik hozzájuk.

| Importálva | Erdőgazdaság | Forrás közzététele | Részletek | Megjegyzés |
|---|---|---|---|---|
| 2026-11-23 | Budapesti Erdőgazdaság Zrt. | 2026-11-17 | 40 | első import |
| 2026-11-23 | Vérteserdő Zrt. | 2026-11-11 | 98 | első import |

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
index.html                 a térkép
vendor/                    Leaflet 1.9.4 és a Source Sans 3 betűtípus (helyben, nem CDN-ről)
favicon.svg                ikon (Noto Emoji, Apache 2.0); favicon.ico és apple-touch-icon.png ebből készül
NOTICE, LICENSES/          harmadik féltől származó elemek licencei
data/bp-erdo.js            BP Erdő adatai
data/verteserdo.js         Vérteserdő adatai
tools/nebih-export.js      konzolscript: erdőrészlet-lista → adatsorok a NÉBIH-ből
tools/mymaps-kml-export.js konzolscript: Google My Maps → adatsorok (geometriával)
```

Az ikon a Google [Noto Emoji](https://github.com/googlefonts/noto-emoji) készlet „lombhullató fa” (U+1F333) képe, [Apache 2.0](LICENSES/Apache-2.0.txt) licenccel; a részletek a [NOTICE](NOTICE) fájlban. A PNG/ICO változatok így generálhatók újra (librsvg + ImageMagick):
```
for s in 16 32 48; do rsvg-convert -w $s -h $s favicon.svg -o /tmp/f$s.png; done
convert /tmp/f16.png /tmp/f32.png /tmp/f48.png favicon.ico
rsvg-convert -w 140 -h 140 favicon.svg -o /tmp/t140.png
convert -size 180x180 xc:'#f6f7f4' /tmp/t140.png -gravity center -composite apple-touch-icon.png
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
npm ci && npx playwright install chromium
python3 -m http.server 8000 &   # másik terminálban
node tools/ci/smoke-test.mjs
```

Az actionök és a Playwright verzióit a Dependabot hetente ellenőrzi (`.github/dependabot.yml`), és frissítéskor PR-t nyit.

## Licenc

- **Kód** (`index.html`, `tools/`, CI): [MIT](LICENSE).
- **Adatok** (`data/*.js`): a megjelölt forrásokból (erdőgazdaságok közzétételei, NÉBIH Erdőtérkép) összeállított kivonat. A jogok a forrásoknál maradnak, a további felhasználásra az ő feltételeik vonatkoznak. Az MIT licenc az adatokra nem terjed ki.
- **Harmadik fél elemei:** Leaflet (BSD-2), Source Sans 3 (SIL OFL 1.1), Noto Emoji ikon (Apache 2.0). Részletek: [NOTICE](NOTICE), a licencszövegek a `vendor/` és a `LICENSES/` mappában.

## Jogi nyilatkozat

Ez nem hivatalos oldal, nem kapcsolódik az érintett erdőgazdaságokhoz és a NÉBIH-hez. Az adatok a közzétett forrásokból, tájékoztató jelleggel készültek. Hibásak, hiányosak vagy elavultak lehetnek, a tényleges munkák (időjárás, módosított tervek miatt) eltérhetnek. Mértékadó mindig az eredeti forrás. Az oldal és az adatok „ahogy vannak” állapotban, mindenféle garancia nélkül érhetők el. A használatukból, illetve az oldal működéséből vagy működésképtelenségéből eredő károkért felelősséget nem vállalok.

## Adatvédelem

Az oldal nem használ sütit, nincs rajta analitika vagy követés, és nem gyűjt adatot. A böngésző helyi tárolójában (`localStorage`) csak a választott háttértérkép neve marad meg, ez nem kerül sehova. Minden script, stílus és betűtípus a repóból töltődik be. Külső szolgáltatóhoz csak a térkép betöltésekor megy kérés, és ezzel a látogató IP-címe is:
- háttércsempék: Esri (alapértelmezett), illetve választás szerint OpenStreetMap, OpenTopoMap;
- a bekapcsolható erdőrészlet-réteg: NÉBIH Erdőtérkép;
- az oldalt magát a GitHub Pages szolgálja ki.

A CI ellenőrzi, hogy ne kerüljön be új külső script, stílus vagy betűtípus.

## Megjegyzés

A térkép a közzétett adatokat mutatja, a tényleges munkák ettől eltérhetnek (időjárás, módosított tervek). A fahasználati módok leírása tájékoztató jellegű.
