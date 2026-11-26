# Fabrykant

Gra przeglądarkowa o budowie przemysłowej Łodzi (1820–1914). Mechanika jest inspirowana grą London (Martin Wallace), ale zasady, karty i grafiki są własne.

## Uruchomienie

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # testy silnika zasad
```

## Struktura

- `src/engine/data.ts` – plansza (24 pola) i talia (104 karty). Liczby są startowe, do strojenia.
- `src/engine/engine.ts` – czysty silnik zasad: `apply(stan, ruch) → nowy stan`. Ten sam kod posłuży serwerowi w multiplayerze.
- `src/engine/ai.ts` – bot (3 poziomy).
- `src/app/Game.tsx` – interfejs gry solo.
