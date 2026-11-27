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

## Gra online (Supabase)

1. Załóż projekt na [supabase.com](https://supabase.com) i w **SQL Editor** uruchom `supabase/schema.sql`.
2. W Vercelu (Settings → Environment Variables) dodaj:
   - `NEXT_PUBLIC_SUPABASE_URL` – Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – klucz `anon` / publishable
   - `SUPABASE_SERVICE_ROLE_KEY` – klucz `service_role` / secret (tajny, tylko na serwerze)
3. Zrób redeploy.

Lokalnie (`npm run dev`) bez tych zmiennych gra online działa na pamięci serwera.
