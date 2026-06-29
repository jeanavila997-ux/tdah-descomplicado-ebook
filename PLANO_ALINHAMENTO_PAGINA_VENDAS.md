# Plano de Alinhamento — Ebook PWA × Página de Vendas

> **Página de vendas analisada:** https://blanchedalmond-camel-967527.hostingersite.com/  
> **Produto:** TDAH Descomplicado — Kit de Produtividade Neuro-Compatível  
> **Status:** Rascunho para revisão

---

## 1. Identidade Visual Extraída da Página de Vendas

A página de vendas usa um visual **limpo, leve e profissional**, não o tema dark atual do ebook.

### Paleta real (extraída do CSS)

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-brand-bg` | `#fdfdfd` | Background geral |
| `--color-brand-text` | `#1a1a1a` | Texto principal |
| `--color-brand-primary` | `#4f46e5` | Botões, links, destaques |
| `--color-brand-accent` | `#4f46e5` | Ícones e acentos |
| `--color-brand-muted` | `#f3f4f6` | Cards, superfícies secundárias |
| `--color-brand-highlight` | `#eef2ff` | Badges, highlights suaves |
| `--color-emerald-600` | `#059669` | Sucesso, checkmarks |
| `--color-red-500` | `#ef4444` | Alertas, erro |

### Tipografia

- **Corpo:** `Inter` (300–700)
- **Display:** `Space Grotesk` (400–700)
- Escala clean, com muito espaço em branco.

### Estilo de componentes

- Cards com bordas sutis, fundo `#f3f4f6` ou branco, sombras leves.
- Botões principais arredondados, fundo índigo, texto branco.
- Badges pequenos, letras maiúsculas, tracking wide.
- Layout mobile-first, com muita respiração entre seções.

---

## 2. O que Mudar no Ebook para Alinhar

### A) Design System

| Área | Hoje | Alvo |
|------|------|------|
| Tema default | Dark (midnight blue) | **Light clean** (`#fdfdfd`) |
| Cor primária | `#6366f1` + verde-limão | `#4f46e5` índigo puro |
| Corpo | `Outfit` | `Inter` |
| Display | `Space Grotesk` | `Space Grotesk` (manter) |
| Cards | Borda grossa + sombra offset | Borda sutil + sombra leve |
| Disclaimer | Marrom/alaranjado | Vermelho suave ou índigo claro, menos invasivo |

### B) Estrutura de Conteúdo

A página de vendas vende o produto como um **"Kit de Produtividade Neuro-Compatível"**, não apenas um e-book educativo. O ebook deve reforçar essa promessa:

- Deixar claro que o leitor está acessando um **sistema**, não só conteúdo.
- Usar a mesma linguagem: "Neuro-Arquitetura", "Hiperfoco sob Demanda", "Fatiamento de Tempo", "Segundo Cérebro", "Rotas de Escape".
- Fechar capítulos com **ações práticas** (checklists, modelos, áudios).

### C) Fluxo de Leitura

| Funcionalidade na página de vendas | Como trazer para o ebook |
|-----------------------------------|--------------------------|
| **Leitura Biônica** | Toggle na toolbar que destaca iniciais das palavras para leitura mais rápida. |
| **Modo Hiperfoco** | Evoluir o "Modo Foco Ativo" atual para destacar parágrafo ativo e reduzir distrações. |
| **Timer de Leitura** | Timer Pomodoro-like embutido (5m / 15m / 25m) com sinal suave. |
| **Ruído Foco** | Botão para tocar ruído branco/lofi suave durante leitura. |
| **Teste de Sobrecarga** | Quiz inicial opcional no primeiro acesso para personalizar rota de leitura. |
| **Rotas de Escape** | Cards interativos: "Se você luta com X, vá para a página Y". |
| **Calculadora de Custo Cognitivo** | Mini-calculadora no capítulo de produtividade/financeiro. |
| **Pequenas Vitórias + XP** | Checklist gamificado de hábitos com barra de progresso. |
| **Depoimentos** | Página ou seção com depoimentos (pode vir do briefing). |
| **FAQ** | Seção expansível no final do ebook. |

---

## 3. Plano de Implementação Sugerido

### Fase A — Alinhamento Visual Imediato (1–2 dias)

Esta fase deixa o ebook **visualmente irmão da página de vendas**.

| ID | Tarefa | Arquivos |
|----|--------|----------|
| AV1 | Atualizar design tokens para paleta light/índigo | `css/main.css` |
| AV2 | Trocar `Outfit` por `Inter` no corpo | `index.html`, `css/main.css` |
| AV3 | Redesenhar cards, botões e badges no estilo da página de vendas | `css/main.css`, `css/components.css` |
| AV4 | Ajustar disclaimer para visual menos invasivo, mas persistente | `index.html`, `css/main.css` |
| AV5 | Tornar light mode o default; dark mode opcional | `js/config.js`, `js/main-controller.js` |
| AV6 | Atualizar `manifest.json` e meta tags para refletir novo posicionamento | `manifest.json`, `index.html` |
| AV7 | Atualizar `briefing.json` para linguagem do kit neuro-compatível | `briefings/briefing.json` |

### Fase B — Novas Funcionalidades de Leitura (3–6 dias)

| ID | Tarefa | Arquivos |
|----|--------|----------|
| NF1 | **Leitura Biônica**: destaque dinâmico das primeiras letras/parte das palavras | ✅ Implementado em `js/main-controller.js` + `css/main.css` |
| NF2 | **Timer de Foco**: 5/15/25 minutos com notificação suave | ✅ Implementado em `js/main-controller.js` + `index.html` |
| NF3 | **Ruído Foco**: player de ruído branco/lofi embutido | ✅ Implementado via Web Audio API em `js/main-controller.js` + `index.html` |
| NF4 | **Modo Hiperfoco 2.0**: highlight de parágrafo ativo, opacidade configurável | ✅ Implementado em `js/main-controller.js` + `css/main.css` |
| NF5 | **Quiz de Sobrecarga Dopaminérgica** no início, com rota personalizada | `js/quiz.js`, `briefings/briefing.json` |
| NF6 | **Rotas de Escape**: componente interativo para saltar para estratégias | `js/escape-routes.js`, `generator.js` |
| NF7 | **Calculadora de Custo Cognitivo** | `js/cost-calculator.js`, `generator.js` |
| NF8 | **Pequenas Vitórias + XP**: checklist gamificado com progresso visual | `js/victories.js`, `css/components.css` |

### Fase C — Integração Comercial e UX (2–4 dias)

| ID | Tarefa | Arquivos |
|----|--------|----------|
| IC1 | Botão "Garantir Meu Kit" alinhado com página de vendas | `js/paywall.js`, `css/main.css` |
| IC2 | Preço e condições idênticos (R$ 47,00 ou 12x de R$ 4,73) | `js/config.js`, `briefings/briefing.json` |
| IC3 | Depoimentos renderizados a partir do briefing | `generator.js`, `css/components.css` |
| IC4 | FAQ expansível renderizado do briefing | `generator.js`, `css/components.css` |
| IC5 | CTA final unificado com página de vendas | `generator.js` |

---

## 4. Diferenças de Posicionamento

### Página de vendas
> "Kit de Produtividade Neuro-Compatível" — foco em **produtividade prática**, sem ansiedade, com ferramentas.

### Ebook atual
> "Entenda Seu Cérebro, Organize Sua Rotina e Viva com Mais Leveza" — foco em **educação e autoaceitação**.

### Proposta de fusão
> **"TDAH Descomplicado — Kit de Produtividade Neuro-Compatível"**  
> Subtítulo do ebook: *"Entenda seu cérebro, organize sua rotina e ative seu foco sem ansiedade."*

Isso alinha o ebook com a promessa da página de vendas sem perder a base educativa.

---

## 5. Próximos Passos

1. **Aprovar o alinhamento visual** light/índigo.
2. **Decidir quais funcionalidades** da Fase B priorizar (recomendo começar por Leitura Biônica, Timer de Foco e Modo Hiperfoco 2.0).
3. **Fornecer depoimentos e FAQ** para incluir no `briefings/briefing.json`, ou deixar genérico.
4. Eu começo pela **Fase A** e entrego uma versão visualmente alinhada para você aprovar.

---

## 6. Notas

- Manter o app **zero bundler** e **PWA offline-first**.
- Todas as novas funcionalidades devem respeitar `prefers-reduced-motion`.
- Funcionalidades de áudio/timer precisam de botão de pausa visível e controle do usuário (nunca autoplay).
- O disclaimer médico continua obrigatório, mas com visual menos agressivo.
