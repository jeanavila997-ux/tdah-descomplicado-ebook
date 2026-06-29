/**
 * generator.js — Motor de Geração de eBooks a partir de Briefing
 *
 * Lê briefings/briefing.json e gera:
 * - estrutura do ebook (título, capítulos)
 * - páginas com HTML completo
 * - quizzes
 * - glossário
 *
 * Um briefing novo = um ebook novo. Zero código a alterar.
 */

const briefingCache = new Map();

// Resolve qual arquivo de briefing carregar.
// Suporta múltiplos ebooks via query param: ?briefing=ansiedade
// Default: briefings/briefing.json (intocado).
function resolveBriefingUrl() {
  const params = new URLSearchParams(location.search);
  const name = (params.get('briefing') || 'briefing').trim();
  // Sanitiza: só permite letras/números/_-; proíbe path traversal.
  const safe = /^[A-Za-z0-9_-]+$/.test(name) ? name : 'briefing';
  return `briefings/${safe}.json`;
}

// ==========================================
// CARREGAR BRIEFING
// ==========================================

export async function loadBriefing() {
  const url = resolveBriefingUrl();
  if (briefingCache.has(url)) return briefingCache.get(url);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Briefing não encontrado: ${url}`);
    const data = await res.json();
    briefingCache.set(url, data);
    return data;
  } catch (err) {
    console.error('[generator.js] Erro ao carregar briefing:', err);
    return null;
  }
}

export function getBriefing() {
  const url = resolveBriefingUrl();
  return briefingCache.get(url) || null;
}

// Helper para prose override: lê cont._prosa[key] com fallback.
// Permite que cada ebook defina seus próprios textos de introdução
// sem alterar o generator. O fallback preserva o comportamento original.
function P(cont, key, fallback) {
  return cont?._prosa?.[key] ?? fallback;
}

// ==========================================
// GERAR ESTRUTURA
// ==========================================

export function generateStructure(briefing) {
  const eb = briefing.ebook;
  const caps = briefing.estrutura_capitulos;

  return {
    title: eb.tema,
    subtitle: eb.transformacao_prometida,
    author: eb.nicho,
    version: '1.0.0',
    totalPages: countPages(briefing),
    chapters: caps.map(c => ({
      id: `cap${c.numero}`,
      title: `Capítulo ${c.numero}`,
      subtitle: c.titulo,
      pageStart: 0 // calculado depois
    })),
    // Expostos para branding dinâmico (logo, theme-color, disclaimer)
    capa: briefing.capa || null,
    ebook: eb
  };
}

// ==========================================
// GERAR PÁGINAS
// ==========================================

export function generatePages(briefing) {
  const pages = [];
  let pageNum = 0;
  const caps = briefing.estrutura_capitulos;

  caps.forEach((cap) => {
    const cont = cap.conteudo;

    // PÁGINA 1: Capa do capítulo
    pageNum++;
    pages.push({
      id: `p${pageNum}`,
      chapterId: `cap${cap.numero}`,
      type: 'chapter-cover',
      number: pageNum,
      title: cap.titulo,
      subtitle: cap.subtitulo,
      icon: cap.icone || '📖'
    });

    // PÁGINAS DE CONTEÚDO (geradas por tipo)
    const contentPages = generateContentPages(cap, briefing);
    contentPages.forEach(html => {
      pageNum++;
      pages.push({
        id: `p${pageNum}`,
        chapterId: `cap${cap.numero}`,
        type: 'content',
        number: pageNum,
        title: extractTitleFromHtml(html) || cap.titulo,
        content: html
      });
    });

    // QUIZ (se houver)
    if (cont?.has_quiz) {
      pageNum++;
      pages.push({
        id: `p${pageNum}`,
        chapterId: `cap${cap.numero}`,
        type: 'quiz',
        number: pageNum,
        title: cont.quiz_titulo || 'Quiz',
        quizId: `quiz-${cap.numero}`
      });
    }
  });

  return pages;
}

// ==========================================
// GERADORES POR TIPO DE CAPÍTULO
// ==========================================

function generateContentPages(cap, briefing) {
  const cont = cap.conteudo;
  const tipo = cap.tipo;
  const pages = [];

  switch (tipo) {
    case 'introducao':
      pages.push(renderIntroducao(cap, cont));
      break;
    case 'fundamentos':
      pages.push(renderFundamentos(cap, cont));
      break;
    case 'pratica':
      pages.push(...renderPratica(cap, cont));
      break;
    case 'solucoes':
      pages.push(...renderSolucoes(cap, cont));
      break;
    case 'emocional':
      pages.push(...renderEmocional(cap, cont));
      break;
    case 'tecnico':
      pages.push(...renderTecnico(cap, cont));
      break;
    case 'acao':
      pages.push(...renderAcao(cap, cont));
      break;
    case 'conclusao':
      pages.push(...renderConclusao(cap, cont, briefing));
      break;
    default:
      pages.push(renderGenerico(cap, cont));
  }

  return pages;
}

// --- INTRODUÇÃO ---
function renderIntroducao(cap, cont) {
  const d = cont;
  let html = `<div class="content-body">`;

  // Definição
  html += `<p>${d.definicao}</p>`;
  html += `<p>${P(d, 'intro_prevalencia', `Estima-se que o TDAH afete entre <strong>${d.prevalencia}</strong>. No Brasil, isso representa milhões de pessoas — muitas delas nunca diagnosticadas.`)}</p>`;

  // Tipos
  if (d.tipos?.length) {
    html += `<h4>${P(d, 'intro_tipos_titulo', 'Os três tipos principais:')}</h4><ul>`;
    d.tipos.forEach(t => {
      html += `<li><strong>${t.nome}:</strong> ${t.descricao}</li>`;
    });
    html += `</ul>`;
  }

  // Destaques
  if (d.destaques?.length) {
    d.destaques.forEach(dest => {
      html += `<div class="highlight-box"><div class="highlight-title">💡 ${P(d, 'intro_voce_sabia', 'Você sabia?')}</div><p>${dest}</p></div>`;
    });
  }

  // Por que diagnóstico importa
  html += `<h4>${P(d, 'intro_diagnostico_titulo', 'Por que o diagnóstico é importante?')}</h4>`;
  html += `<p>${P(d, 'intro_diagnostico_corpo', `Muitas pessoas vivem décadas sem saber que têm TDAH. Elas se sentem <strong>"diferentes"</strong> ou <strong>"preguiçosas"</strong> — quando, na verdade, seus cérebros simplesmente funcionam de um jeito diferente.`)}</p>`;
  html += `<div class="highlight-box"><div class="highlight-title">✨ ${P(d, 'intro_narrativa_titulo', 'O diagnóstico muda a narrativa')}</div><p>${P(d, 'intro_narrativa_corpo', `Em vez de "eu sou disfuncional", você passa a pensar "meu cérebro funciona diferente, e existem formas de me ajudar".`)}</p></div>`;

  // Disclaimer
  html += `<div class="warning-box"><div class="warning-title">⚠️ ${P(d, 'intro_aviso_titulo', 'O diagnóstico deve ser feito por um profissional')}</div><p>${P(d, 'intro_aviso_corpo', `Psiquiatras, neurologistas e neuropsicólogos qualificados são os únicos profissionais aptos a diagnosticar TDAH. Testes online podem ser úteis como <strong>autoavaliação inicial</strong>, mas não substituem a avaliação clínica.`)}</p></div>`;

  html += `</div>`;
  return html;
}

// --- FUNDAMENTOS ---
function renderFundamentos(cap, cont) {
  let html = `<div class="content-body">`;

  html += `<p>${P(cont, 'fund_intro', `O TDAH não é "falta de vontade" ou "preguiça". É uma <strong>condição neurobiológica</strong> com bases genéticas e estruturais no cérebro. Estudos de neuroimagem mostram diferenças mensuráveis em regiões específicas.`)}</p>`;

  // Regiões cerebrais como cards
  if (cont.regioes_cerebrais?.length) {
    html += `<h4>${P(cont, 'fund_regioes_titulo', 'Regiões cerebrais envolvidas:')}</h4>`;
    cont.regioes_cerebrais.forEach(r => {
      html += `<div class="card card-hover" style="margin:1rem 0;">
        <div class="card-header">
          <div class="card-icon">${r.emoji}</div>
          <div><div class="card-title">${r.nome}</div></div>
        </div>
        <div class="card-body"><p>${r.funcao}</p></div>
      </div>`;
    });
  }

  // Molécula central
  html += `<h4>${P(cont, 'fund_molecula_titulo', 'Dopamina: A Molécula Central')}</h4>`;
  html += `<p>${P(cont, 'fund_molecula_corpo', `A <strong>dopamina</strong> é o neurotransmissor estrela do TDAH. Ela não é apenas a molécula do prazer — é a molécula da <strong>motivação, do interesse e da recompensa</strong>.`)}</p>`;
  html += `<div class="highlight-box"><div class="highlight-title">🧪 ${P(cont, 'fund_urgencia_titulo', `Por que "só funciona na urgência"?`)}</div><p>${P(cont, 'fund_urgencia_corpo', `O estresse de um prazo iminente libera dopamina e norepinefrina — exatamente os neurotransmissores que o cérebro com TDAH precisa. É por isso que muitas pessoas são <strong>adictas à urgência</strong>.`)}</p></div>`;

  // Tabela de neurotransmissores
  if (cont.neurotransmissores?.length) {
    html += `<h4>${P(cont, 'fund_neuro_titulo', 'Neurotransmissores envolvidos:')}</h4>`;
    html += `<div class="table-wrapper"><table><thead><tr><th>${P(cont, 'fund_neuro_col1', 'Neurotransmissor')}</th><th>${P(cont, 'fund_neuro_col2', 'Função')}</th><th>${P(cont, 'fund_neuro_col3', 'No TDAH')}</th></tr></thead><tbody>`;
    cont.neurotransmissores.forEach(n => {
      html += `<tr><td><strong>${n.nome}</strong></td><td>${n.funcao}</td><td>${n.no_tdah}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  html += `<div class="info-box"><div class="info-title">💊 ${P(cont, 'fund_medic_titulo', 'Como os medicamentos ajudam')}</div><p>${P(cont, 'fund_medic_corpo', `Os estimulantes aumentam a disponibilidade de dopamina e norepinefrina na fenda sináptica, compensando a disregulação natural. Isso é análogo a óculos para quem tem miopia.`)}</p></div>`;

  html += `</div>`;
  return html;
}

// --- PRÁTICA ---
function renderPratica(cap, cont) {
  const pages = [];

  // Página 1: Timeline do dia
  let html = `<div class="content-body">`;
  html += `<p>${P(cont, 'prat_intro', `Para quem tem TDAH, o cotidiano pode ser um desafio constante. As dificuldades não acontecem por falta de esforço — são resultado de como o cérebro processa <strong>tempo, prioridades e recompensas</strong>.`)}</p>`;
  html += `<div class="highlight-box"><div class="highlight-title">⏰ ${P(cont, 'prat_agora_titulo', `"Agora" e "Não-agora"`)}</div><p>${P(cont, 'prat_agora_corpo', `O cérebro com TDAH vive basicamente em dois momentos: <strong>agora</strong> e <strong>não-agora</strong>. Tudo que não é urgente ou estimulante parece distante.`)}</p></div>`;

  if (cont.timeline_dia?.length) {
    html += `<h4>${P(cont, 'prat_timeline_titulo', 'Desafios comuns no dia a dia:')}</h4>`;
    html += `<div class="timeline">`;
    cont.timeline_dia.forEach((t, i) => {
      html += `<div class="timeline-item">
        <div class="timeline-dot">${i + 1}</div>
        <div class="timeline-content">
          <div class="timeline-title">${t.hora}: ${t.titulo}</div>
          <div class="timeline-desc">${t.descricao}</div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  pages.push(html);

  // Página 2: Sintomas invisíveis
  html = `<div class="content-body">`;
  html += `<p>${P(cont, 'prat_invisiveis_intro', `O TDAH tem sintomas <strong>invisíveis</strong> — aqueles que ninguém percebe, mas que consomem energia mental diariamente:`)}</p>`;

  if (cont.sintomas_invisiveis?.length) {
    html += `<div class="accordion">`;
    cont.sintomas_invisiveis.forEach(s => {
      html += `<div class="accordion-item">
        <button class="accordion-trigger" aria-expanded="false">
          <span>${s.emoji} ${s.titulo}</span>
          <span class="accordion-icon">▼</span>
        </button>
        <div class="accordion-panel"><p>${s.descricao}</p></div>
      </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  pages.push(html);

  return pages;
}

// --- SOLUÇÕES ---
function renderSolucoes(cap, cont) {
  const pages = [];

  cont.topicos?.forEach(topico => {
    let html = `<div class="content-body">`;
    html += `<h4>${topico.titulo}</h4>`;

    if (topico.texto) html += `<p>${topico.texto}</p>`;

    if (topico.destaque) {
      html += `<div class="highlight-box"><div class="highlight-title">💡 ${topico.titulo}</div><p>${topico.destaque}</p></div>`;
    }

    if (topico.lista?.length) {
      html += `<ul>`;
      topico.lista.forEach(item => html += `<li>${item}</li>`);
      html += `</ul>`;
    }

    if (topico.passos?.length) {
      html += `<div class="card"><div class="card-body"><p><strong>Passo a passo:</strong></p><ol>`;
      topico.passos.forEach(p => html += `<li>${p}</li>`);
      html += `</ol></div></div>`;
    }

    html += `</div>`;
    pages.push(html);
  });

  return pages;
}

// --- EMOCIONAL ---
function renderEmocional(cap, cont) {
  const pages = [];

  // Página 1: Desregulação emocional
  let html = `<div class="content-body">`;
  html += `<p>${P(cont, 'emo_intro', `O TDAH não afeta apenas o foco — ele tem um impacto profundo nas <strong>emoções</strong>. Pessoas com TDAH frequentemente vivenciam o que os especialistas chamam de <strong>desregulação emocional</strong>.`)}</p>`;
  html += `<div class="highlight-box"><div class="highlight-title">🌊 ${P(cont, 'emo_destaque_titulo', 'O que é desregulação emocional?')}</div><p>${cont.topico_principal}</p></div>`;
  html += `<p>${P(cont, 'emo_estatistica_intro', `Estudos mostram que até`)} <strong>${cont.estatistica}</strong></p>`;

  if (cont.caracteristicas?.length) {
    html += `<h4>${P(cont, 'emo_caracteristicas_titulo', 'Características:')}</h4><ul>`;
    cont.caracteristicas.forEach(c => html += `<li>${c}</li>`);
    html += `</ul>`;
  }

  html += `<blockquote><p>${P(cont, 'emo_citacao', `"O TDAH é 50% atenção e 50% emoção. Se você só trata a atenção, está tratando metade do problema."`)}</p><cite>${P(cont, 'emo_citacao_autor', '— Dr. William Dodson')}</cite></blockquote>`;
  html += `</div>`;
  pages.push(html);

  // Página 2: RSD
  html = `<div class="content-body">`;
  html += `<h4>${P(cont, 'emo_rsd_titulo', 'RSD: A Rejeição Que Dói Fisicamente')}</h4>`;

  if (cont.cards_rsd?.length) {
    cont.cards_rsd.forEach(c => {
      html += `<div class="card" style="margin:1rem 0;">
        <div class="card-header">
          <div class="card-icon">${c.emoji}</div>
          <div class="card-title">${c.titulo}</div>
        </div>
        <div class="card-body"><p>${c.descricao}</p></div>
      </div>`;
    });
  }

  if (cont.estrategias_rsd?.length) {
    html += `<div class="info-box"><div class="info-title">💜 ${P(cont, 'emo_estrategias_titulo', 'Estratégias para RSD')}</div><ul>`;
    cont.estrategias_rsd.forEach(e => html += `<li>${e}</li>`);
    html += `</ul></div>`;
  }

  html += `</div>`;
  pages.push(html);

  return pages;
}

// --- TÉCNICO ---
function renderTecnico(cap, cont) {
  const pages = [];

  // Página 1: Medicamentos
  let html = `<div class="content-body">`;
  html += `<p>${P(cont, 'tec_intro', `Os medicamentos para TDAH são alguns dos <strong>mais estudados e eficazes</strong> da psiquiatria. Aproximadamente 70-80% das pessoas respondem positivamente aos estimulantes.`)}</p>`;

  html += `<div class="warning-box"><div class="warning-title">⚠️ ${P(cont, 'tec_aviso_titulo', 'Informação educativa — não prescrição')}</div><p>${cont.disclaimer_destaque}</p></div>`;

  if (cont.tipos_medicamentos?.length) {
    html += `<h4>${P(cont, 'tec_tipos_titulo', 'Tipos de medicamentos:')}</h4>`;
    html += `<div class="table-wrapper"><table><thead><tr><th>${P(cont, 'tec_col1', 'Categoria')}</th><th>${P(cont, 'tec_col2', 'Exemplos')}</th><th>${P(cont, 'tec_col3', 'Mecanismo')}</th></tr></thead><tbody>`;
    cont.tipos_medicamentos.forEach(m => {
      html += `<tr><td><strong>${m.categoria}</strong></td><td>${m.exemplos}</td><td>${m.mecanismo}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  html += `<h4>${P(cont, 'tec_func_titulo', 'Como os estimulantes funcionam:')}</h4>`;
  html += `<p>${P(cont, 'tec_func_corpo', `Os estimulantes não "calmam" o cérebro — eles o <strong>ativam</strong>. Eles aumentam a disponibilidade de dopamina e norepinefrina nas regiões responsáveis pela função executiva.`)}</p>`;
  html += `<ul>${P(cont, 'tec_func_lista', `<li>Atenção sustentada e seletiva</li><li>Controle de impulsos</li><li>Planejamento e organização</li><li>Regulação emocional</li><li>Motivação para iniciar tarefas</li>`)}</ul>`;

  html += `<div class="highlight-box"><div class="highlight-title">🧪 ${P(cont, 'tec_anatomia_titulo', 'Anatomia de um estimulante')}</div>
    ${P(cont, 'tec_anatomia_corpo', `
    <p><strong>Metilfenidato:</strong> bloqueia a recaptação de dopamina.</p>
    <p><strong>Lisdexanfetamina (Venvanse):</strong> pró-droga convertida em dextroanfetamina. Efeito mais longo (10-14 horas).</p>`)}
  </div>`;

  html += `</div>`;
  pages.push(html);

  // Página 2: Segurança e mitos
  html = `<div class="content-body">`;
  html += `<p>${P(cont, 'tec_seg_intro', `Os estimulantes para TDAH são seguros quando usados conforme prescrito. São um dos tratamentos psiquiátricos mais estudados da história, com mais de <strong>50 anos de pesquisa</strong>.`)}</p>`;
  html += `<h4>${P(cont, 'tec_mitos_titulo', 'Mitos comuns:')}</h4>`;
  html += `<div class="accordion">`;
  cont.mitos?.forEach(m => {
    html += `<div class="accordion-item">
      <button class="accordion-trigger" aria-expanded="false">
        <span>❌ "${m.mito}"</span>
        <span class="accordion-icon">▼</span>
      </button>
      <div class="accordion-panel"><p>${m.realidade}</p></div>
    </div>`;
  });
  html += `</div>`;

  if (cont.efeitos_colaterais?.length) {
    html += `<h4>${P(cont, 'tec_efeitos_titulo', 'Efeitos colaterais comuns (geralmente leves e transitórios):')}</h4><ul>`;
    cont.efeitos_colaterais.forEach(e => html += `<li>${e}</li>`);
    html += `</ul>`;
  }

  html += `<div class="info-box"><div class="info-title">🩺 ${P(cont, 'tec_monitor_titulo', 'Monitoramento é essencial')}</div><p>${P(cont, 'tec_monitor_corpo', `Acompanhamento médico regular permite ajustar a dose, trocar de medicamento se necessário, e monitorar efeitos colaterares. O tratamento do TDAH é <strong>individualizado</strong>.`)}</p></div>`;
  html += `</div>`;
  pages.push(html);

  return pages;
}

// --- AÇÃO ---
function renderAcao(cap, cont) {
  const pages = [];

  // Página 1: Sistema de organização
  let html = `<div class="content-body">`;
  html += `<p>${P(cont, 'acao_intro', `A boa notícia é que existem estratégias concretas que podem tornar a rotina com TDAH muito mais gerenciável. O segredo não é ter força de vontade heroica — é criar <strong>sistemas externos</strong>.`)}</p>`;
  html += `<div class="highlight-box"><div class="highlight-title">🧠 ${P(cont, 'acao_principio_titulo', 'Princípio fundamental')}</div><p>${P(cont, 'acao_principio_corpo', `Pense nos sistemas de organização como <strong>muletas para uma perna machucada</strong>: elas não curam, mas permitem que você se mova com muito mais eficiência.`)}</p></div>`;

  if (cont.sistema_organizacao?.length) {
    html += `<h4>🗂️ ${P(cont, 'acao_sistema_titulo', 'Sistema de Organização:')}</h4>`;
    html += `<div class="stepper">`;
    cont.sistema_organizacao.forEach((s, i, arr) => {
      html += `<div class="step"><div class="step-dot ${i === 0 ? 'active' : ''}">${s.passo}</div></div>`;
      if (i < arr.length - 1) html += `<div class="step-connector"></div>`;
    });
    html += `</div>`;

    cont.sistema_organizacao.forEach(s => {
      html += `<div class="card" style="margin:1rem 0;">
        <div class="card-header"><div class="card-icon">${s.passo}️⃣</div><div class="card-title">${s.titulo}</div></div>
        <div class="card-body"><p>${s.descricao}</p></div>
      </div>`;
    });
  }
  html += `</div>`;
  pages.push(html);

  // Página 2: Plano 7 dias
  html = `<div class="content-body">`;
  html += `<h4>${P(cont, 'acao_plano_titulo', 'Plano de Ação — 7 Dias')}</h4>`;

  if (cont.plano_7_dias?.length) {
    html += `<div class="checklist">`;
    cont.plano_7_dias.forEach(p => {
      html += `<li>
        <div class="checklist-checkbox" data-day="${p.dia}"></div>
        <div class="checklist-text"><strong>${P(cont, 'acao_dia_label', 'Dia')} ${p.dia} — ${p.titulo}:</strong> ${p.descricao}</div>
      </li>`;
    });
    html += `</div>`;
  }

  html += `<div class="info-box"><div class="info-title">🎉 ${P(cont, 'acao_lembrete_titulo', 'Lembre-se')}</div><p>${P(cont, 'acao_lembrete_corpo', `O TDAH não define quem você é. O objetivo é entender melhor como você funciona, reduzir a culpa que tanto pesa, e construir uma vida com mais clareza, organização e leveza.`)}</p></div>`;
  html += `</div>`;
  pages.push(html);

  return pages;
}

// --- CONCLUSÃO ---
function renderConclusao(cap, cont, briefing) {
  const pages = [];
  const eb = briefing.ebook;

  let html = `<div class="content-body">`;
  html += `<p>${cont.topico_principal}</p>`;

  if (cont.pilares_neuroplasticidade?.length) {
    html += `<h4>${P(cont, 'conc_pilares_titulo', 'Como fortalecer a neuroplasticidade:')}</h4>`;
    cont.pilares_neuroplasticidade.forEach(p => {
      html += `<div class="card" style="margin:1rem 0;">
        <div class="card-header"><div class="card-icon">${p.emoji}</div><div class="card-title">${p.titulo}</div></div>
        <div class="card-body"><p>${p.descricao}</p></div>
      </div>`;
    });
  }

  if (cont.nootropicos_naturais?.length) {
    html += `<h4>${P(cont, 'conc_nootropicos_titulo', 'Nootrópicos naturais (complementares):')}</h4><ul>`;
    cont.nootropicos_naturais.forEach(n => {
      html += `<li><strong>${n.nome}:</strong> ${n.descricao}</li>`;
    });
    html += `</ul>`;
  }

  html += `<div class="warning-box"><div class="warning-title">⚠️ ${P(cont, 'conc_aviso_titulo', 'Suplementos não substituem tratamento')}</div><p>${P(cont, 'conc_aviso_corpo', `Nootrópicos naturais são <strong>complementares</strong> — não substituem medicamentos prescritos, terapia ou mudanças de estilo de vida. Consulte seu médico.`)}</p></div>`;

  // CTA Final
  if (cont.has_cta_final) {
    html += `<div class="cta-section">`;
    html += `<div class="cta-title">🎉 ${cont.cta_titulo}</div>`;
    html += `<p style="color:var(--text-secondary);margin-bottom:1rem;">${cont.cta_descricao}</p>`;

    const price = eb.preco_brl.toFixed(2).replace('.', ',');
    const origPrice = eb.preco_original_brl.toFixed(2).replace('.', ',');
    html += `<div class="cta-price"><span class="currency">R$</span> ${price}<span class="original">R$ ${origPrice}</span></div>`;

    if (cont.cta_beneficios?.length) {
      html += `<ul class="cta-features">`;
      cont.cta_beneficios.forEach(b => html += `<li>${b}</li>`);
      html += `</ul>`;
    }

    const ctaBtn = P(cont, 'conc_cta_botao', 'Quero o Acesso Completo →');
    const ctaFoot = P(cont, 'conc_cta_rodape', `Pagamento seguro via Cakto · 7 dias de garantia sem perguntas · Dúvidas? <a href="mailto:bookflow@ebooksaude.shop" style="color:var(--color-primary);">bookflow@ebooksaude.shop</a>`);
    html += `<button class="btn btn-primary btn-large" id="btn-comprar" style="margin-top:1rem;">${ctaBtn}</button>`;
    html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:1rem;">${ctaFoot}</p>`;
    html += `</div>`;
  }

  html += `</div>`;
  pages.push(html);

  return pages;
}

// --- GENÉRICO (fallback) ---
function renderGenerico(cap, cont) {
  return `<div class="content-body">
    <h4>${cap.titulo}</h4>
    <p>${JSON.stringify(cont)}</p>
  </div>`;
}

// ==========================================
// GERAR QUIZZES
// ==========================================

export function generateQuizzes(briefing) {
  const quizzes = {};

  briefing.estrutura_capitulos.forEach(cap => {
    if (!cap.conteudo?.has_quiz) return;

    const qid = `quiz-${cap.numero}`;

    if (cap.conteudo.quiz_perguntas) {
      // Quiz scored (likert)
      quizzes[qid] = {
        title: cap.conteudo.quiz_titulo,
        description: 'Este quiz não é diagnóstico — é uma autoavaliação para reflexão.',
        questions: cap.conteudo.quiz_perguntas.map(p => ({
          text: p.texto,
          options: [
            { text: 'Nunca', score: 0 },
            { text: 'Raramente', score: 1 },
            { text: 'Às vezes', score: 2 },
            { text: 'Frequentemente', score: 3 },
            { text: 'Sempre', score: 4 }
          ]
        })),
        results: [
          { min: 0, max: 8, label: 'Baixa', description: 'Seus sintomas são pouco frequentes.' },
          { min: 9, max: 16, label: 'Moderada', description: 'Você apresenta alguns sintomas comuns. Vale investigar com um profissional.' },
          { min: 17, max: 28, label: 'Significativa', description: 'Seus sintomas são frequentes. Recomendamos buscar avaliação profissional.' }
        ]
      };
    }

    if (cap.conteudo.quiz_opcoes) {
      // Quiz de escolha (estratégia)
      quizzes[qid] = {
        title: cap.conteudo.quiz_titulo,
        description: 'Escolha seu maior desafio atual:',
        questions: [{
          text: 'Qual é seu maior desafio atual?',
          options: cap.conteudo.quiz_opcoes.map(o => ({
            text: o.texto,
            result: o.resultado
          }))
        }],
        resultMessages: cap.conteudo.quiz_opcoes.reduce((acc, o) => {
          acc[o.resultado] = o.mensagem;
          return acc;
        }, {})
      };
    }
  });

  return quizzes;
}

// ==========================================
// GERAR GLOSSÁRIO
// ==========================================

export function generateGlossary(briefing) {
  return briefing.glossario?.map(g => ({
    term: g.termo,
    category: g.categoria,
    definition: g.definicao
  })) || [];
}

// ==========================================
// HELPERS
// ==========================================

function countPages(briefing) {
  let count = 0;
  briefing.estrutura_capitulos.forEach(cap => {
    count++; // capa do capítulo
    // estimativa de páginas de conteúdo baseada no tipo
    switch (cap.tipo) {
      case 'introducao': count += 2; break;
      case 'fundamentos': count += 1; break;
      case 'pratica': count += 2; break;
      case 'solucoes': count += cap.conteudo?.topicos?.length || 2; break;
      case 'emocional': count += 2; break;
      case 'tecnico': count += 2; break;
      case 'acao': count += 2; break;
      case 'conclusao': count += 1; break;
      default: count += 1;
    }
    if (cap.conteudo?.has_quiz) count++;
  });
  return count;
}

function extractTitleFromHtml(html) {
  const match = html.match(/<h4>(.*?)<\/h4>/);
  return match ? match[1] : '';
}

// ==========================================
// GERAR TUDO (entry point)
// ==========================================

export async function generateEbook() {
  const briefing = await loadBriefing();
  if (!briefing) return null;

  return {
    structure: generateStructure(briefing),
    pages: generatePages(briefing),
    quizzes: generateQuizzes(briefing),
    glossary: generateGlossary(briefing)
  };
}
