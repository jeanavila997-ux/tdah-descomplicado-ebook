# Copilot Instructions — TDAH Descomplicado Ebook PWA

## Build, test, and lint commands

```bash
npm run validate    # Checks essential files exist + briefings/briefing.json is valid JSON
npm run lint        # ESLint on js/ (eslint:recommended, ES modules, ignores js/vendor/)
npm run dev         # Node Express server on PORT or 3000 (server.js — production-shaped: compression, helmet, SPA fallback)
npm run dev:local   # http-server on :8000, cache disabled (lighter, no Express)
npm run build       # Alias for npm run validate (no bundler — static deploy)
npm test            # Alias for npm run validate
```

No unit test framework is configured. `npm test` only runs `scripts/validate.js`, which checks file existence and JSON parse of the briefing — it does **not** validate the briefing schema, run the generator, or exercise the UI. To manually verify changes, run `npm run dev:local` and open `http://localhost:8000`.

ESLint config (`.eslintrc.json`): `eslint:recommended`, `sourceType: module`, `no-unused-vars: warn`, `no-undef: off` (browser globals), `no-console: off`. Vendor libs in `js/vendor/**` are ignored.

## High-level architecture

This is a **zero-bundler static PWA** that renders an interactive ebook entirely client-side from a single JSON file. The same shell can produce an ebook on any topic by swapping `briefings/briefing.json`.

### Data flow

```
briefings/briefing.json  →  js/generator.js  →  ebook object {structure, pages, quizzes, glossary}
                                                        ↓
index.html  →  boot() in inline <script type=module>  →  js/main-controller.js (init)
                                                        ↓
                                                   renders pages into #content-area
```

- **`briefings/briefing.json`** — the entire ebook content (theme, 8 chapters, quizzes, glossary, pricing). Schema is documented in `PROMPT_MESTRE.md`. Each chapter has a `tipo` (`introducao` | `fundamentos` | `pratica` | `solucoes` | `emocional` | `tecnico` | `acao` | `conclusao`) that maps to a `renderXxx()` function in `generator.js`.
- **`js/generator.js`** — pure data→HTML motor. `generateEbook()` is the entry point; outputs `{structure, pages, quizzes, glossary}`. Pages are `{id, chapterId, type: 'chapter-cover'|'content'|'quiz', number, title, content (html string)}`. **Do not edit for content changes — edit the briefing instead.**
- **`js/main-controller.js`** — the monolithic UI controller (~1500 lines): navigation, rendering, quiz, theme, bookmarks, progress, focus timer/sound, bionic reading, PDF export, paywall, service worker registration. Exports `init()` which `index.html` calls on boot. State lives in a module-level `state` object; DOM refs are cached in a `$` object via `cacheDOM()`.
- **`js/integrations.js`** — optional Supabase + Cakto layer. Only loaded when `CONFIG.isSupabaseEnabled` (lazy script injection in `index.html`). Has full localStorage fallback when Supabase is off.
- **`js/config.js`** — single source of truth for feature flags, Supabase/Cakto config, localStorage keys, pricing (in **centavos**, never float), and theme helpers. Version here must match `CACHE_NAME` in `service-worker.js`.

### Key invariants

1. **App must work 100% offline without Supabase or Cakto.** Every integration path has a localStorage fallback. Never make remote calls unconditional.
2. **Only public/anon keys in the frontend.** `service_role` stays in the Supabase Edge Function (`supabase/functions/cakto-webhook/`). `config.js` documents this explicitly.
3. **Prices are integers in centavos.** Use `PRICING.priceCents` / `parseCaktoPrice()` / `formatPriceCents()` from `config.js`. Never store BRL floats in the DB.
4. **No inline event handlers.** `generator.js` and `main-controller.js` emit `data-action` / `data-page` / `data-quiz-id` attributes; `main-controller.js` attaches delegated listeners on `#content-area` and `#nav-list`. This keeps CSP `script-src` closer to `'unsafe-inline'`-free.
5. **Service worker version must match `CONFIG.version`.** Bumping one without the other breaks cache invalidation.

### PWA / offline

- `service-worker.js` — cache-first for same-origin GETs, network fallback with dynamic caching, `index.html` as offline shell. `ASSETS_TO_CACHE` is an explicit precache list; new static assets added to the app must be added here too. `SKIP_WAITING` message handler enables fast updates.
- `manifest.json` — standalone display, portrait, pt-BL, icons 72–512px in `assets/icons/`.
- `vercel.json` — SPA routes (`/(.*)` → `/index.html`), plus no-cache headers for `service-worker.js` and `manifest.json`.

### Integrations (optional)

- **Supabase** — Auth + Postgres with RLS on every table (`supabase/schema.sql`: `profiles`, `user_state`, `leads`, `purchases`). Enable by filling `SUPABASE_CONFIG.url` and `anonKey` in `js/config.js`. The SDK is loaded from `cdn.jsdelivr.net` at runtime only when enabled.
- **Cakto** — payment via hosted checkout URL. Webhook is a Supabase Edge Function (`supabase/functions/cakto-webhook/index.ts`) that validates the payload and records the purchase in centavos.
- Full setup walkthrough in `docs/INTEGRACOES.md`.

## Key conventions

### Briefing-driven content
To change ebook content, edit `briefings/briefing.json` — do **not** hand-edit generated HTML in `generator.js` unless adding a new chapter `tipo`. Adding a new `tipo` requires: a `renderXxx()` function in `generator.js`, a `case` in `generateContentPages()`, and a count branch in `countPages()`.

### CSS architecture
- `css/main.css` — design tokens (`:root` light, `[data-theme="dark"]` override), layout, disclaimer bar, nav drawer, animations.
- `css/components.css` — cards, accordion, timeline, quiz, CTA, badges.
- `css/auth-gateway.css` — paywall/auth modal.
- Theme is toggled via `data-theme` attribute on `<html>`; `getInitialTheme()` in `config.js` respects `prefers-color-scheme` + localStorage.
- `prefers-reduced-motion` is handled globally and explicitly disables decorative sumário animations (`wordWiggle`, `charBounce`, `slideInNavItem`).

### State & persistence
All user state persists in `localStorage` under namespaced keys (prefix `tdah-ebook:`) defined in `STORAGE_KEYS` (`config.js`). The lead capture queue (`leadsQueue`) buffers offline leads for later sync.

### Modals
Use native `<dialog>` (`showModal()` / `close()`), opened via `openModalWithAnimation()` in `main-controller.js` which applies a scale/translate Web Animations entry. `closedby="any"` is set on dismissible modals; ESC closes natively.

### Vendor libs
Vendored locally in `js/vendor/` (no CDN at runtime for app code). **jsPDF loads lazily** via `loadJsPDF()` only when the user clicks "Salvar PDF" — do not re-add it to `index.html` as a eager `<script>`. Chart.js was removed from precache because it was unused; if reintroduced, add it to `service-worker.js` `ASSETS_TO_CACHE`.

### Medical disclaimer
The disclaimer bar in `index.html` is sticky and non-dismissable by design (compliance). Do not add a close button to it.

### Language
All user-facing strings are in **pt-BR**. Code comments and commit messages may be in pt-BR or English. Match the surrounding file's language when editing.

### Deployment
Static deploy — no build step. `npm run build` only validates. Vercel config is in `vercel.json` (SPA fallback). `server.js` (Express) is an alternative self-host option with compression + helmet, not required for Vercel.