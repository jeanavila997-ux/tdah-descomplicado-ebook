# Plano de Melhoria — TDAH Descomplicado Ebook PWA

## Estado verificado (29/06/2026)

### Verdades confirmadas por inspeção direta
- ✅ Service Worker **ativo** (`navigator.serviceWorker.register('./service-worker.js')` em `main-controller.js:1479`; `service-worker.js` cache-first com precache + fallback offline para `index.html`). Claim anterior de "SW desabilitado" estava **errada**.
- ✅ Disclaimer médico **não-fechável** (sem botão close em `index.html:50`). Claim anterior "fechável" estava **errada**.
- ✅ `generator.js` **não usa `onclick` inline** (zero matches). Usa `data-action`/`data-page`/`data-quiz-id` + listeners delegados. Claim anterior #11 estava **errada**.
- ⚠️ CSP ainda contém `'unsafe-inline'` em `script-src` e `style-src` (`index.html:12-13`, `login.html:11-12`).
- ⚠️ `validate.js` só checa existência de arquivos + `ebook.tema` — sem validação de schema.
- ⚠️ `main-controller.js` = 44KB monólito com ~60 funções misturando UI/nav/quiz/PDF/paywall/SW/tema/foco/som/bionic.
- ⚠️ `login.html` reimplementa auth Supabase do zero (CSP própria, não reutiliza `integrations.js`).
- ⚠️ Lint passa limpo; `npm test` só roda `validate.js`.

### Novos achados (não cobertos pelo plano anterior)
- 🐛 `package.json`: `"name": "kimi-agent-deployment-v12"` (nome errado do projeto), `repository.url` aponta para `Kimi_Agent_Deployment_v12` (repo errado), e `chrome-devtools-mcp` listado como dependency (MCP server não pertence às deps do app).
- 🗑️ `ebook-tdah.bundle` (258KB) — arquivo **git bundle** commitado acidentalmente na raiz. Deve ser removido + gitignore.
- 🗑️ `js/vendor/chart.min.js` (203KB) — **não é mais carregado** em `index.html` nem no `ASSETS_TO_CACHE`. Código morto ocupando repo.

### Organização dos capítulos (briefing.json)
8 capítulos com distribuição saudável de `tipo`:
1. introducao — "O que é TDAH?" (com quiz)
2. fundamentos — "O Cérebro com TDAH"
3. pratica — "TDAH na Rotina Diária" (com quiz)
4. solucoes — "Foco, Procrastinação e Hiperfoco"
5. emocional — "Emoções e TDAH"
6. tecnico — "Medicamentos"
7. acao — "Estratégias Práticas" (com quiz)
8. conclusao — "Neuroplasticidade" (CTA final)

3 quizzes (caps 1, 3, 7) + glossário de 10 itens. Conteúdo bem estruturado e validado por evidências.

---

## FASE 1 — Quick Wins (correções sem mudar arquitetura)

- [ ] **F1.1 Limpeza de repo**: remover `ebook-tdah.bundle`, remover `js/vendor/chart.min.js` (+ ref README), adicionar `*.bundle` ao `.gitignore`.
- [ ] **F1.2 Corrigir `package.json`**: name → `tdah-descomplicado-ebook`, repository.url → repo correto, remover `chrome-devtools-mcp` das deps.
- [ ] **F1.3 Endurecer CSP**: remover `'unsafe-inline'` de `script-src` (migrar inline `<script>` do `index.html:40-43` para arquivo externo ou usar hash/nonce). Manter `unsafe-inline` em `style-src` temporariamente se necessário, mas planejar remover.
- [ ] **F1.4 Sincronizar versões**: garantir `CONFIG.version` (`config.js`) == `CACHE_NAME` (`service-worker.js`).

## FASE 2 — Estruturais (reorg de código + UX)

- [ ] **F2.1 Modularizar `main-controller.js`** em: `navigation.js`, `renderer.js`, `quiz.js`, `theme.js`, `focus-mode.js` (timer+som+active focus), `bookmarks.js`, `pdf-export.js`, `paywall.js`, `pwa.js`, orquestrados por `app.js`. Meta: cada módulo ≤300 linhas.
- [ ] **F2.2 Unificar auth**: `login.html` importa de `integrations.js` (signIn/signUp/magicLink/signOut); eliminar duplicação de CSP e SDK.
- [ ] **F2.3 Estado centralizado** (`js/state.js`): single source of truth para currentPage/bookmarks/theme/fontSize/quizResults com persistência local+remote.
- [ ] **F2.4 Validar schema do briefing** com JSON Schema em `scripts/validate.js` (capítulos, tipos obrigatórios, quizzes, glossário).
- [ ] **F2.5 Testes básicos** (Node test runner) para `generator.js` e `config.js`.
- [ ] **F2.6 UX**: busca no conteúdo, retomada de leitura, botão instalar PWA (`beforeinstallprompt`), PDF com capa+sumário.

## FASE 3 — Avançadas (produto robusto + template reutilizável)

- [ ] **F3.1 Design system**: revisar paleta (substituir verde-limão clichê por assinatura visual própria ao tema TDAH), tipografia legível (Atkinson Hyperlegible/Lexend), contraste 4.5:1.
- [ ] **F3.2 Quiz com explicações por resposta** + links para conteúdo relacionado.
- [ ] **F3.3 Sync offline-confiável**: fila de operações com retry exponencial + background sync.
- [ ] **F3.4 Integração Cakto end-to-end** + webhook seguro validando assinatura.
- [ ] **F3.5 Suporte a múltiplos ebooks** via query param `?briefing=`.
- [ ] **F3.6 CI/CD** (GitHub Actions): lint + testes + validação de briefing em PR.

## Critérios de aceitação
- F1: repo limpo (sem bundle/dead chart), package.json correto, CSP sem `unsafe-inline` em script-src.
- F2: `main-controller.js` extinto (módulos ≤300 linhas), login reutiliza integrations, busca + retomada + install funcionando, `npm test` roda schema + 5+ testes.
- F3: fluxo Cakto E2E, app instalável via botão, template multi-ebook, CI bloqueia PR ruim.

## Próximo passo
Iniciar pela FASE 1 (limpeza + correções de metadata/CSP) — impacto alto, risco baixo, sem refactor.