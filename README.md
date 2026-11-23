# Tervezett fakitermelések térképe

Személyes használatra készült térkép, amely egy felületen mutatja az állami erdőgazdaságok által közzétett (tervezett vagy folyamatban lévő) fakitermeléseket, erdőrészletenként, fahasználati módonként színezve.

Háttér: a Telex 2026. 11. 23-i cikke szerint minden erdőgazdaság másképp (vagy egyáltalán nem) teszi közzé, hol vágnak védett erdőben.

## Adatforrások

| Erdőgazdaság | Forrás | Formátum | Részletek |
|---|---|---|---|
| Budapesti Erdőgazdaság Zrt. | [2026-ban még hátralévő tervezett fakitermelések](https://www.bp-erdo.hu/hu/2026-evben-meg-hatralevo-tervezett-fakitermelesek) | HTML-táblázat (erdőrészlet + fahasználat) | 40 |
| Vérteserdő Zrt. | [Aktuális tevékenységeink](https://verteserdo.hu/aktualis-tevekenysegeink/) | Google Saját térkép (KML), várható befejezéssel | 98 |

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

Új fahasználati mód esetén a `MODES` tömbbe (index.html) kell egy szín és egy rövid leírás.

## Megjegyzés

A térkép a közzétett adatokat mutatja, a tényleges munkák ettől eltérhetnek (időjárás, módosított tervek). A fahasználati módok leírása tájékoztató jellegű.
