# Splendor – digitális játékmester prototípus

Ez egy önálló, statikus PWA-prototípus.

## Indítás
- A legegyszerűbb: tedd fel egy statikus webtárhelyre.
- Lokálisan: `python -m http.server 8080`, majd nyisd meg a `http://localhost:8080` címet.
- Androidon a böngészőből telepíthető PWA-ként, ha HTTPS-es tárhelyen fut.

## V1 funkciók
- 2–4 játékos
- teljes 90 lapos alap pakli adatmodell
- 10 nemes
- játékosonként zsetonok, kártyák, rezervált kártyák, pontok
- 4 akció
- 10 zsetonos limit
- arany joker
- kártyabónuszok és automatikus költségszámítás
- nemesek automatikus kezelése
- 15 pontos játékvégi trigger
- localStorage mentés
- PWA offline cache

## Következő fejlesztési lépés
Firebase/Firestore realtime szobák, játékos-session visszaállítás, host/játékos jogosultságok,
és utána vizuális finomítás.
