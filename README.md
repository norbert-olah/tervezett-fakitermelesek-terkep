# Tervezett fakitermelések térképe

**Élő oldal: https://norbert-olah.github.io/tervezett-fakitermelesek-terkep/**

Személyes használatra készült térkép, amely egy felületen mutatja az állami erdőgazdaságok által közzétett (tervezett vagy folyamatban lévő) fakitermeléseket, erdőrészletenként, fahasználati módonként színezve.

Háttér: a Telex 2026. 11. 23-i cikke szerint minden erdőgazdaság másképp (vagy egyáltalán nem) teszi közzé, hol vágnak védett erdőben.

## Adatforrások

| Erdőgazdaság | Forrás | Formátum | Részletek |
|---|---|---|---|
| Budapesti Erdőgazdaság Zrt. | [2026-ban még hátralévő tervezett fakitermelések](https://www.bp-erdo.hu/hu/2026-evben-meg-hatralevo-tervezett-fakitermelesek) | HTML-táblázat (erdőrészlet + fahasználat) | 40 |
| Vérteserdő Zrt. | [Aktuális tevékenységeink](https://verteserdo.hu/aktualis-tevekenysegeink/) | Google Saját térkép (KML), várható befejezéssel | 98 |
| Mecsekerdő Zrt. | [Erdőkezelésünk](https://mecsekerdo.hu/fenntarthato-gazdalkodas/erdokezelesunk/) | Nyilvános Power BI-jelentés (ütemezett hónapok, részlethatárok WKT-ként) | 206 |
| Egererdő Zrt. | [Fahasználatok helyei](https://www.google.com/maps/d/viewer?mid=1edFqyqTrWi4-Gdpcgqgje9N7Li-W8Ao) | Google Saját térkép (KML, csak pontok), érintett terület és fatömeg | 83 |

## Importálási napló

Minden új forrásnál vagy frissítésnél ide kerül egy sor (és a `data/<forrás>.js` `importalva` mezője is frissül).

| Importálva | Erdőgazdaság | Forrás közzététele | Letöltve | Részletek | Megjegyzés |
|---|---|---|---|---|---|
| 2026-11-23 | Budapesti Erdőgazdaság Zrt. | 2026-11-17 | 2026-11-23 | 40 | első import |
| 2026-11-23 | Vérteserdő Zrt. | 2026-11-11 | 2026-11-23 | 98 | első import |
| 2026-11-23 | Mecsekerdő Zrt. | 2026-11-23 | 2026-11-23 | 206 | első import (a Power BI-modell napi frissítésű; ütemezés: 2026. november–december) |
| 2026-11-23 | Egererdő Zrt. | – | 2026-11-23 | 83 | első import (a térképen nincs dátum) |

A részlethatárokat, a területet, a védettséget, a Natura 2000-es státuszt és a rendeltetést a [NÉBIH Erdőtérkép](https://erdoterkep.nebih.gov.hu/) nyilvános GeoServer WFS-éből (`nebih:KUL_RESZLET_VW`) kértem le. A Vérteserdőnél a saját KML-jük, a Mecsekerdőnél a Power BI-modelljük geometriája szerepel, a BP Erdőnél és az Egererdőnél (amelynek térképén csak pontok vannak) a NÉBIH részlethatára. Letöltés: 2026. 11. 23.

A forrásspecifikus, a NÉBIH-ben nem szereplő adatok (erdészet, ütemezett hónapok, terv állapota, üzemmód, érintett terület, fatömeg) a sor 12. elemében vannak, és a felugró ablakban jelennek meg.

Ismert eltérések:
- A Vérteserdő „Hánta” néven közölt részletei a NÉBIH-ben „Kisbér-Hánta” néven szerepelnek.
- „Császár 29 C” a NÉBIH-ben nem található (ott 29/A, B, D, F, G van), ezért ennél nincs terület- és védettségi adat.
- Mecsekerdő: a forrás védettsége és Natura 2000-es státusza mind a 206 részletnél egyezik a NÉBIH-hel, a részlethatárok területe is 10%-on belül. A Power BI-ban közölt részletterület 19 részletnél (mind a Sellyei erdészetben: Adorjás, Páprád, Kisszentmárton, Besence, Siklós stb.) eltér a NÉBIH-étől, jellemzően néhány tized hektárral. Kiugró a „Páprád 40 C”: a forrás 5,64 ha-t ír, a NÉBIH és a közölt határvonal is 2,92 ha-t. A térkép a NÉBIH területét mutatja.
- Mecsekerdő: az ütemezésben a „Terv állapota” 199 részletnél „Engedélyezett”, 4-nél „Bejelentés generálva”, 2-nél „Tervezett” (egynél vegyes). Ez a felugró ablakban látszik.
- Mecsekerdő: a lista egyéb részleteket is tartalmaz (utak, nyiladékok, vízfolyások: „Bogdása 20 ÚT 3”, „Bogdása 23 NY 1”, „Marócsa 13 VI” stb.). Ezek a NÉBIH-ben is megvannak, ezért felkerültek.
- Egererdő: a védettség („nem védett / védett / fokozottan védett terület”) és a Natura 2000-es státusz mind a 83 részletnél egyezik a NÉBIH-hel. A pontok 4 részletnél (Erdőkövesd 9 G, Felsőtárkány 82 C, Nagyvisnyó 46 E, Mátramindszent 4 F) a NÉBIH-poligonon kívül, de attól legfeljebb 31 m-re esnek, mert a koordináták három tizedesre vannak kerekítve.
- Egererdő: „Arló 42 G”-nél az érintett terület (10 ha) nagyobb, mint a részlet NÉBIH-területe (9,42 ha). Valószínűleg kerekítés. „Gyöngyöspata 19 B2” a NÉBIH-ben „19/B 2”, „Nagyvisnyó 48 C 1” „48/C 1” alakban szerepel. Az alrészleteket a `nebih-export.js` így keresi.
- Egererdő: a fatömeg 17 részletnél (Pétervásárai Erdészet) nettó, 62-nél bruttó köbméterben van megadva. Az Egri Erdészet 4 részleténél se érintett terület, se fatömeg nincs kitöltve.

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
favicon.svg                ikon (Noto Emoji, Apache 2.0); favicon.ico és apple-touch-icon.png ebből készül
NOTICE, LICENSES/          harmadik féltől származó elemek licencei
data/bp-erdo.js            BP Erdő adatai
data/verteserdo.js         Vérteserdő adatai
data/mecsekerdo.js         Mecsekerdő adatai
data/egererdo.js           Egererdő adatai
tools/nebih-export.js      konzolscript: erdőrészlet-lista → adatsorok a NÉBIH-ből
tools/mymaps-kml-export.js konzolscript: Google My Maps → adatsorok (poligonnál geometriával; presetek: Vérteserdő, Egererdő)
tools/powerbi-export.js    konzolscript: Mecsekerdő Power BI-jelentés → adatsorok (geometriával)
```

Az ikon a Google [Noto Emoji](https://github.com/googlefonts/noto-emoji) készlet „lombhullató fa” (U+1F333) képe, [Apache 2.0](LICENSES/Apache-2.0.txt) licenccel; a részletek a [NOTICE](NOTICE) fájlban. A PNG/ICO változatok így generálhatók újra (librsvg + ImageMagick):
```
for s in 16 32 48; do rsvg-convert -w $s -h $s favicon.svg -o /tmp/f$s.png; done
convert /tmp/f16.png /tmp/f32.png /tmp/f48.png favicon.ico
rsvg-convert -w 140 -h 140 favicon.svg -o /tmp/t140.png
convert -size 180x180 xc:'#f6f7f4' /tmp/t140.png -gravity center -composite apple-touch-icon.png
```

Egy adatsor: `[erdőrészlet, fahasználat, várható befejezés, körzet, terület (ha), tulajdon, rendeltetés, Natura 2000, védettség, NÉBIH RET_ID, geometria, extra]`. Az utolsó, opcionális `extra` elem a forrás saját adatai `{címke: érték}` formában. A várható befejezés `ÉÉÉÉ-HH-NN` vagy (ha a forrás csak hónapot ad) `ÉÉÉÉ-HH`. A geometria poligononként gyűrűk listája, [Google encoded polyline](https://developers.google.com/maps/documentation/utilities/polylinealgorithm) formában (1e-5 fok ≈ 1 m pontosság).

## Új forrás vagy frissítés

A NÉBIH WFS-e más oldalról nem hívható (nincs CORS), ezért a lekérés az Erdőtérkép oldalán, a böngésző konzoljában fut:

1. **Csak erdőrészlet-lista van** (mint a BP Erdőnél): nyisd meg az https://erdoterkep.nebih.gov.hu/ oldalt, töltsd ki a `tools/nebih-export.js` `INPUT`-ját, és futtasd a konzolban.
2. **Saját térkép van (Google My Maps):** a térkép oldalán futtasd a `tools/mymaps-kml-export.js`-t (a `CONFIG` sorban válaszd ki a presetet: `PRESETS.verteserdo` vagy `PRESETS.egererdo`), a kimenetét add meg `ROWS`-ként a `nebih-export.js`-ben, és futtasd az Erdőtérkép oldalán. Ha a térképen csak pontok vannak (Egererdő), a részlethatárt a NÉBIH adja.
3. **Mecsekerdő (Power BI):** nyisd meg a jelentést (a link a `tools/powerbi-export.js` `CONFIG.url`-jében és a `data/mecsekerdo.js` `powerbi` mezőjében van), futtasd a konzolban a `powerbi-export.js`-t, majd a kimenetét add meg `ROWS`-ként a `nebih-export.js`-ben. A konzol kiírja a modell utolsó frissítésének idejét is (ez a `kozzetett`).
4. A vágólapra került sorokat tedd egy `data/<forras>.js` fájlba (a meglévők mintájára, `ERDO.add({...})`), és vegyél fel hozzá egy `<script src="data/<forras>.js">` sort az `index.html`-be.
5. Írd be az importálás dátumát a fájl `importalva` mezőjébe és az **Importálási napló** táblázatba.
6. Vesd össze a forrás saját védettségi és Natura 2000-adatait (ha közli) a NÉBIH-ével, és az eltéréseket írd az **Ismert eltérések** közé.

Új fahasználati mód esetén a `MODES` tömbbe (index.html) kell egy szín és egy rövid leírás, a forrás saját elnevezését pedig a szkript `codes` táblájában kell a `MODES` kulcsára fordítani. A szkriptek kiírják, ha ismeretlen módot találnak.

## Ellenőrzés (CI)

Minden pull requestnél és `main`-re pusholásnál lefut a `.github/workflows/ci.yml`, két külön jobbal (mindkettő beállítható kötelező ellenőrzésnek):

- **Adatellenőrzés** (`tools/ci/validate-data.mjs`, függőség nélkül):
  - minden `data/*.js` be van-e töltve az `index.html`-ben, és fordítva;
  - lefut-e hiba nélkül a fájl;
  - megvannak-e a kötelező mezők (a `kozzetett` lehet `null`, ha a forrás nem közöl dátumot), és ÉÉÉÉ-HH-NN formájúak-e a dátumok (a várható befejezés lehet ÉÉÉÉ-HH is);
  - 11 elemű-e a sor, vagy 12 elemű, ha az utolsó egy `{címke: szöveg}` extra objektum;
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

## Megjegyzés

A térkép a közzétett adatokat mutatja, a tényleges munkák ettől eltérhetnek (időjárás, módosított tervek). A fahasználati módok leírása tájékoztató jellegű.
