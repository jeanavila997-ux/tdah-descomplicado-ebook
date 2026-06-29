/**
 * app.js — Controlador principal da UI
 * Modularizado por feature: navegação, render, quiz, theme, progress
 * 100% funcional sem Supabase — usa localStorage como fallback
 */

import { CONFIG, STORAGE_KEYS, getInitialTheme, setTheme } from './config.js';
import { generateEbook } from './generator.js';
import { verifyPurchase } from './integrations.js';

// ==========================================
// DADOS DO EBOOK (gerados a partir do briefing)
// ==========================================
let ebookCache = null;

async function loadData() {
  if (!ebookCache) {
    try {
      ebookCache = await generateEbook();
    } catch (err) {
      console.error('[app] Falha no generator:', err);
    }
  }
  return ebookCache;
}

function getData() {
  return ebookCache || { structure: {}, pages: [], quizzes: {}, glossary: [] };
}

function getPages() { return getData().pages || []; }
function getQuizzes() { return getData().quizzes || {}; }
function getGlossary() { return getData().glossary || []; }
function getStructure() { return getData().structure || {}; }

// ==========================================
// ESTADO GLOBAL
// ==========================================
let state = {
  currentPage: 0,
  totalPages: 0,
  bookmarks: new Set(),
  theme: getInitialTheme(),
  fontSize: parseInt(localStorage.getItem(STORAGE_KEYS.fontSize)) || 16,
  quizResults: JSON.parse(localStorage.getItem(STORAGE_KEYS.quizResults) || '[]'),
  isNavOpen: false,
  activeFocus: localStorage.getItem(STORAGE_KEYS.activeFocus) === 'true'
};

// Referências DOM (cacheadas)
let $ = {};

// ==========================================
// INIT
// ==========================================
export async function init() {
  cacheDOM();

  // Carrega dados do ebook (generator → briefing.json)
  try {
    await loadData();
    const data = getData();
    state.totalPages = (data?.pages || []).length;
    console.log('[app.js] Dados carregados:', state.totalPages, 'páginas');
  } catch (err) {
    console.error('[app.js] Erro ao carregar dados:', err);
    showLoadError();
    return;
  }

  setupTheme();
  setupActiveFocus();
  setupBionic();
  setupFocusTimer();
  setupFocusSound();
  setupEventListeners();
  setupNavigation();
  setupGlossary();
  loadProgress();

  if (state.totalPages > 0) {
    // Atualiza título da página e branding dinâmico (logo, theme-color, disclaimer)
    const structure = getStructure();
    if (structure?.title) {
      document.title = `${structure.title} — Ebook Interativo`;
    }
    applyBranding(structure);
    renderPage(state.currentPage);
    setupAccordion();
  } else {
    showLoadError();
  }

  setupServiceWorker();
  setupPaywall();

  console.log('[app.js] Inicializado — modo:', CONFIG.isSupabaseEnabled ? 'online' : 'offline');
}

function showLoadError() {
  if ($.contentArea) {
    $.contentArea.innerHTML = `
      <div class="error-state">
        <p>⚠️ Nenhum conteúdo encontrado.</p>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem;">
          Verifique se o arquivo briefings/briefing.json está presente.
        </p>
      </div>
    `;
  }
}

function cacheDOM() {
  $ = {
    contentArea: document.getElementById('content-area'),
    breadcrumb: document.getElementById('breadcrumb'),
    pageIndicator: document.getElementById('page-indicator'),
    progressFill: document.getElementById('progress-fill'),
    navDrawer: document.getElementById('nav-drawer'),
    navOverlay: document.getElementById('nav-overlay'),
    navList: document.getElementById('nav-list'),
    btnMenu: document.getElementById('btn-menu'),
    btnClose: document.getElementById('nav-close'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnBookmark: document.getElementById('btn-bookmark'),
    btnTextSize: document.getElementById('btn-text-size'),
    btnGlossary: document.getElementById('btn-glossary'),
    btnActiveFocus: document.getElementById('btn-active-focus'),
    btnBionic: document.getElementById('btn-bionic'),
    btnFocusTimer: document.getElementById('btn-focus-timer'),
    btnFocusSound: document.getElementById('btn-focus-sound'),
    timerModal: document.getElementById('timer-modal'),
    soundModal: document.getElementById('sound-modal'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),
    themeToggle: document.getElementById('theme-toggle'),
    glossaryModal: document.getElementById('glossary-modal'),
    quizModal: document.getElementById('quiz-modal'),
    toastContainer: document.getElementById('toast-container'),
    logoIcon: document.querySelector('.logo-icon'),
    logoText: document.querySelector('.logo-text'),
    themeColorMeta: document.querySelector('meta[name="theme-color"]'),
    disclaimerText: document.getElementById('disclaimer-text'),
    disclaimerIcon: document.querySelector('.disclaimer-icon')
  };
}

// ==========================================
// BRANDING DINÂMICO (multi-ebook)
// ==========================================
// Aplica identidade visual do ebook ativo (logo, theme-color, disclaimer)
// a partir de structure.capa / structure.ebook. Mantém o fallback estático
// do index.html quando o briefing não expõe esses campos.
function applyBranding(structure) {
  if (!structure) return;
  const capa = structure.capa || {};
  const ebook = structure.ebook || {};

  // Logo: titulo_principal é dividido em duas partes; a última palavra
  // recebe o estilo <em> (mesma estrutura do HTML estático "TDAH <em>Descomplicado</em>").
  if ($.logoText && capa.titulo_principal) {
    const parts = String(capa.titulo_principal).trim().split(/\s+/);
    if (parts.length >= 2) {
      const last = parts.pop();
      $.logoText.innerHTML = `${parts.join(' ')} <em>${last}</em>`;
    } else {
      $.logoText.textContent = capa.titulo_principal;
    }
  }
  if ($.logoIcon && capa.icone) {
    $.logoIcon.textContent = capa.icone;
  }

  // theme-color: usa a cor primária do briefing quando disponível.
  if ($.themeColorMeta && capa.cores?.primaria) {
    $.themeColorMeta.setAttribute('content', capa.cores.primaria);
  }

  // Disclaimer: texto e ícone (opcional) específicos do ebook.
  if ($.disclaimerText && ebook.disclaimer_texto) {
    $.disclaimerText.textContent = ebook.disclaimer_texto;
  }
  if ($.disclaimerIcon && ebook.disclaimer_icone) {
    $.disclaimerIcon.textContent = ebook.disclaimer_icone;
  }
}

// ==========================================
// THEME
// ==========================================
function setupTheme() {
  setTheme(state.theme);
  $.themeToggle?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(state.theme);
  });
}

function isModalOpen() {
  return $.glossaryModal?.open || $.quizModal?.open || $.timerModal?.open || $.soundModal?.open;
}

// ==========================================
// LEITURA BIÔNICA
// ==========================================
let bionicEnabled = localStorage.getItem('tdah-ebook:bionic') === 'true';

function setupBionic() {
  updateBionicUI();

  $.btnBionic?.addEventListener('click', () => {
    bionicEnabled = !bionicEnabled;
    localStorage.setItem('tdah-ebook:bionic', bionicEnabled);
    updateBionicUI();
    applyBionicToContent();
    showToast(bionicEnabled ? '🔤 Leitura Biônica ativada' : 'Leitura Biônica desativada');
  });
}

function updateBionicUI() {
  if (!$.btnBionic) return;
  $.btnBionic.classList.toggle('active', bionicEnabled);
  $.btnBionic.setAttribute('aria-pressed', bionicEnabled);
}

function applyBionicToContent() {
  if (!$.contentArea) return;

  // Remove bionic markup anterior
  document.querySelectorAll('.bionic-bold').forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });

  if (!bionicEnabled) return;

  const textNodes = [];
  const walker = document.createTreeWalker(
    $.contentArea,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Ignora dentro de scripts, estilos e elementos já processados
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, .bionic-bold, .checklist-checkbox')) return NodeFilter.FILTER_REJECT;
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  textNodes.forEach(node => {
    const text = node.textContent;
    const fragment = document.createDocumentFragment();

    // Separa palavras mantendo espaçamento e pontuação
    const parts = text.split(/(\s+|[\p{P}\p{S}])/u);

    parts.forEach(part => {
      if (!part) return;

      if (/^\s+$/.test(part) || /^[\p{P}\p{S}]+$/u.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }

      const boldLength = Math.max(1, Math.ceil(part.length / 2));
      const boldPart = part.slice(0, boldLength);
      const restPart = part.slice(boldLength);

      const strong = document.createElement('strong');
      strong.className = 'bionic-bold';
      strong.style.fontWeight = '600';
      strong.style.color = 'inherit';
      strong.textContent = boldPart;

      fragment.appendChild(strong);
      if (restPart) {
        fragment.appendChild(document.createTextNode(restPart));
      }
    });

    node.parentNode.replaceChild(fragment, node);
  });
}

// ==========================================
// TIMER DE FOCO
// ==========================================
let timerState = {
  totalSeconds: 25 * 60,
  remaining: 25 * 60,
  interval: null,
  running: false
};

function setupFocusTimer() {
  $.btnFocusTimer?.addEventListener('click', () => {
    openModalWithAnimation($.timerModal);
  });

  $.timerModal?.querySelector('.modal-close')?.addEventListener('click', () => {
    closeModalWithAnimation($.timerModal);
  });

  // Presets
  $.timerModal?.querySelectorAll('[data-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes);
      resetTimer(minutes * 60);
      updateTimerPresetUI(btn);
    });
  });

  document.getElementById('timer-start')?.addEventListener('click', startTimer);
  document.getElementById('timer-pause')?.addEventListener('click', pauseTimer);
  document.getElementById('timer-reset')?.addEventListener('click', () => resetTimer(timerState.totalSeconds));

  updateTimerDisplay();
}

function updateTimerPresetUI(activeBtn) {
  $.timerModal?.querySelectorAll('[data-minutes]').forEach(btn => {
    btn.classList.toggle('btn-primary', btn === activeBtn);
    btn.classList.toggle('btn-outline', btn !== activeBtn);
  });
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (!display) return;
  const minutes = Math.floor(timerState.remaining / 60).toString().padStart(2, '0');
  const seconds = (timerState.remaining % 60).toString().padStart(2, '0');
  display.textContent = `${minutes}:${seconds}`;
  document.title = timerState.running && timerState.remaining < timerState.totalSeconds
    ? `${minutes}:${seconds} · Foco · TDAH Descomplicado`
    : `${getStructure().title || 'TDAH Descomplicado'} — Ebook Interativo`;
}

function startTimer() {
  if (timerState.running) return;
  timerState.running = true;
  toggleTimerButtons(true);

  timerState.interval = setInterval(() => {
    timerState.remaining--;
    updateTimerDisplay();

    if (timerState.remaining <= 0) {
      completeTimer();
    }
  }, 1000);
}

function pauseTimer() {
  timerState.running = false;
  clearInterval(timerState.interval);
  toggleTimerButtons(false);
  updateTimerDisplay();
}

function resetTimer(seconds) {
  pauseTimer();
  timerState.totalSeconds = seconds;
  timerState.remaining = seconds;
  updateTimerDisplay();
}

function completeTimer() {
  pauseTimer();
  timerState.remaining = 0;
  updateTimerDisplay();
  playSoftBell();
  showToast('🛎️ Sessão de foco concluída!');
}

function toggleTimerButtons(running) {
  const startBtn = document.getElementById('timer-start');
  const pauseBtn = document.getElementById('timer-pause');
  if (startBtn) startBtn.style.display = running ? 'none' : 'inline-flex';
  if (pauseBtn) pauseBtn.style.display = running ? 'inline-flex' : 'none';
}

function playSoftBell() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 1.5); // C4

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 1.5);
  } catch (err) {
    console.error('[timer] Erro ao tocar sino:', err);
  }
}

// ==========================================
// RUÍDO FOCO (Web Audio API)
// ==========================================
let soundState = {
  ctx: null,
  noise: null,
  gain: null,
  playing: false,
  volume: parseFloat(localStorage.getItem('tdah-ebook:focusSoundVolume')) || 0.3
};

function setupFocusSound() {
  $.btnFocusSound?.addEventListener('click', () => {
    openModalWithAnimation($.soundModal);
  });

  $.soundModal?.querySelector('.modal-close')?.addEventListener('click', () => {
    closeModalWithAnimation($.soundModal);
  });

  const volumeInput = document.getElementById('sound-volume');
  if (volumeInput) {
    volumeInput.value = Math.round(soundState.volume * 100);
    volumeInput.addEventListener('input', (e) => {
      soundState.volume = parseInt(e.target.value) / 100;
      localStorage.setItem('tdah-ebook:focusSoundVolume', soundState.volume);
      if (soundState.gain) {
        soundState.gain.gain.setTargetAtTime(soundState.volume, soundState.ctx.currentTime, 0.1);
      }
    });
  }

  const toggleBtn = document.getElementById('sound-toggle');
  toggleBtn?.addEventListener('click', () => {
    if (soundState.playing) {
      stopFocusSound();
    } else {
      startFocusSound();
    }
  });

  updateFocusSoundUI();
}

function createPinkNoise(ctx) {
  const bufferSize = ctx.sampleRate * 2; // 2 segundos
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

function startFocusSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      showToast('⚠️ Seu navegador não suporta áudio');
      return;
    }

    if (!soundState.ctx) {
      soundState.ctx = new AudioContext();
    }

    if (soundState.ctx.state === 'suspended') {
      soundState.ctx.resume();
    }

    const gain = soundState.ctx.createGain();
    gain.gain.setValueAtTime(0.001, soundState.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(soundState.volume, soundState.ctx.currentTime + 1);

    const noise = createPinkNoise(soundState.ctx);
    noise.connect(gain);
    gain.connect(soundState.ctx.destination);
    noise.start();

    soundState.noise = noise;
    soundState.gain = gain;
    soundState.playing = true;

    updateFocusSoundUI();
    showToast('🌊 Ruído Foco iniciado');
  } catch (err) {
    console.error('[sound] Erro ao iniciar ruído:', err);
    showToast('❌ Erro ao iniciar ruído');
  }
}

function stopFocusSound() {
  if (!soundState.noise) return;

  try {
    const now = soundState.ctx?.currentTime || 0;
    if (soundState.gain) {
      soundState.gain.gain.cancelScheduledValues(now);
      soundState.gain.gain.setValueAtTime(soundState.gain.gain.value, now);
      soundState.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    }

    setTimeout(() => {
      soundState.noise?.stop();
      soundState.noise?.disconnect();
      soundState.gain?.disconnect();
      soundState.noise = null;
      soundState.gain = null;
      soundState.playing = false;
      updateFocusSoundUI();
    }, 500);

    soundState.playing = false;
    updateFocusSoundUI();
  } catch (err) {
    console.error('[sound] Erro ao parar ruído:', err);
  }
}

function updateFocusSoundUI() {
  const toggleBtn = document.getElementById('sound-toggle');
  if (!toggleBtn) return;

  toggleBtn.textContent = soundState.playing ? 'Parar Ruído' : 'Iniciar Ruído';
  toggleBtn.classList.toggle('btn-primary', !soundState.playing);
  toggleBtn.classList.toggle('btn-outline', soundState.playing);

  if ($.btnFocusSound) {
    $.btnFocusSound.classList.toggle('active', soundState.playing);
    $.btnFocusSound.setAttribute('aria-pressed', soundState.playing);
  }
}

// ==========================================
// ACTIVE FOCUS (Modo Hiperfoco 2.0)
// ==========================================
let focusBlocks = [];
let currentFocusIndex = -1;

function setupActiveFocus() {
  const updateFocusUI = () => {
    const isActive = state.activeFocus;
    $.btnActiveFocus?.classList.toggle('active', isActive);
    $.btnActiveFocus?.setAttribute('aria-pressed', isActive);
    $.contentArea?.classList.toggle('focus-active', isActive);

    if (isActive) {
      buildFocusBlocks();
      highlightFocusBlock(0);
    } else {
      clearFocusBlocks();
    }
  };

  updateFocusUI();

  $.btnActiveFocus?.addEventListener('click', () => {
    state.activeFocus = !state.activeFocus;
    localStorage.setItem(STORAGE_KEYS.activeFocus, state.activeFocus);
    updateFocusUI();
    showToast(state.activeFocus ? '⚡ Modo Hiperfoco habilitado!' : 'Modo Hiperfoco desabilitado.');
  });
}

function buildFocusBlocks() {
  if (!$.contentArea) return;
  clearFocusBlocks();

  // Seleciona blocos legíveis: parágrafos, itens de lista, cards, timeline items
  focusBlocks = Array.from($.contentArea.querySelectorAll(
    'article p, article li, article .card, article .timeline-item, article .accordion-item, article .highlight-box, article .info-box, article .warning-box'
  )).filter(el => el.textContent.trim().length > 0);

  focusBlocks.forEach((el, idx) => {
    el.classList.add('focus-block');
    el.dataset.focusIndex = idx;
    el.addEventListener('mouseenter', () => highlightFocusBlock(idx));
    el.addEventListener('click', () => highlightFocusBlock(idx));
  });
}

function clearFocusBlocks() {
  focusBlocks.forEach(el => {
    el.classList.remove('focus-block', 'focus-block-active');
    delete el.dataset.focusIndex;
  });
  focusBlocks = [];
  currentFocusIndex = -1;
}

function highlightFocusBlock(index) {
  if (!state.activeFocus || focusBlocks.length === 0) return;
  if (index < 0) index = 0;
  if (index >= focusBlocks.length) index = focusBlocks.length - 1;

  currentFocusIndex = index;
  focusBlocks.forEach((el, idx) => {
    el.classList.toggle('focus-block-active', idx === index);
  });
}

// Navegação por blocos no modo Hiperfoco
function handleFocusBlockNavigation(e) {
  if (!state.activeFocus) return;

  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault();
    highlightFocusBlock(currentFocusIndex + 1);
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault();
    highlightFocusBlock(currentFocusIndex - 1);
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Nav
  $.btnMenu?.addEventListener('click', openNav);
  $.btnClose?.addEventListener('click', closeNav);
  $.navOverlay?.addEventListener('click', closeNav);

  // Page nav
  $.btnPrev?.addEventListener('click', goPrev);
  $.btnNext?.addEventListener('click', goNext);

  // Keyboard
  document.addEventListener('keydown', handleKeydown);

  // Bookmark
  $.btnBookmark?.addEventListener('click', toggleBookmark);

  // Font size
  $.btnTextSize?.addEventListener('click', cycleFontSize);

  // Glossary
  $.btnGlossary?.addEventListener('click', openGlossary);
  $.glossaryModal?.querySelector('.modal-close')?.addEventListener('click', closeGlossary);

  // PDF
  $.btnDownloadPdf?.addEventListener('click', downloadPDF);

  // Quiz close
  $.quizModal?.querySelector('.modal-close')?.addEventListener('click', closeQuiz);
  $.quizModal?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close-quiz"]')) closeQuiz();
  });

  // Search glossary
  document.getElementById('glossary-search')?.addEventListener('input', handleGlossarySearch);

  // Touch swipe
  setupSwipe();

  // Event delegation para botões injetados no conteúdo (sem onclick inline)
  $.contentArea?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'next-chapter') {
      goToPage(state.currentPage + 1);
    } else if (action === 'start-quiz') {
      startQuiz(btn.dataset.quizId);
    }
  });
}

function handleKeydown(e) {
  if (state.activeFocus) {
    handleFocusBlockNavigation(e);
    // Se usou setas em modo hiperfoco, não navega de página
    if (['ArrowUp', 'ArrowDown', 'j', 'k'].includes(e.key)) return;
  }

  if (isModalOpen()) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      goPrev();
      break;
    case 'ArrowRight':
    case ' ':
      e.preventDefault();
      goNext();
      break;
    case 'Escape':
      closeNav();
      closeGlossary();
      closeQuiz();
      closeTimerModal();
      closeSoundModal();
      break;
  }
}

function closeTimerModal() {
  $.timerModal?.close();
}

function closeSoundModal() {
  $.soundModal?.close();
}

// ==========================================
// NAVIGATION
// ==========================================
function openNav() {
  $.navDrawer?.classList.add('open');
  $.navOverlay?.classList.add('active');
  state.isNavOpen = true;
  document.body.style.overflow = 'hidden';
}

function closeNav() {
  $.navDrawer?.classList.remove('open');
  $.navOverlay?.classList.remove('active');
  state.isNavOpen = false;
  document.body.style.overflow = '';
}

function setupNavigation() {
  if (!$.navList) return;

  // Split title "Sumário" into characters for animation
  const navTitleEl = $.navDrawer?.querySelector('.nav-title');
  if (navTitleEl && !navTitleEl.querySelector('.nav-char')) {
    const text = navTitleEl.textContent.trim();
    navTitleEl.innerHTML = text.split('').map((char, idx) => {
      // Preserve spaces, but wrap normal characters in spans
      if (char === ' ') return ' ';
      return `<span class="nav-char" style="--char-idx: ${idx};">${char}</span>`;
    }).join('');
  }

  const pages = getPages();
  const structure = getStructure();
  const chapters = structure.chapters || [];

  // Group pages by chapterId
  const pagesByChapter = {};
  pages.forEach((page, index) => {
    const cid = page.chapterId || 'unknown';
    if (!pagesByChapter[cid]) {
      pagesByChapter[cid] = [];
    }
    pagesByChapter[cid].push({ page, index });
  });

  let itemIndex = 0;
  $.navList.innerHTML = chapters.map(chapter => {
    const chapPages = pagesByChapter[chapter.id] || [];
    if (chapPages.length === 0) return '';

    const pagesHtml = chapPages.map(({ page, index }) => {
      const isActive = index === state.currentPage;
      const isChapter = page.type === 'chapter-cover';
      const icon = isChapter ? '📑' : (page.type === 'quiz' ? '🎯' : '📄');
      const displayTitle = isChapter ? 'Capa / Introdução' : page.title;
      const currentItemIdx = itemIndex++;

      const words = displayTitle.split(' ');
      const wordsHtml = words.map((word, wordIdx) => `
        <span class="nav-word" style="--word-idx: ${wordIdx};">${word}</span>
      `).join(' ');

      return `
        <li style="--nav-item-idx: ${currentItemIdx};">
          <button
            class="${isActive ? 'active' : ''}"
            data-page="${index}"
          >
            <span class="nav-item-number">${icon}</span>
            <span class="nav-item-title-text" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;" title="${displayTitle}">
              ${wordsHtml}
            </span>
            <span class="nav-item-type">${isChapter ? 'Capa' : (page.type === 'quiz' ? 'Quiz' : page.number)}</span>
          </button>
        </li>
      `;
    }).join('');

    const chapterHeaderIdx = itemIndex++;
    const chapTitleText = `${chapter.title}: ${chapter.subtitle}`;
    const chapWords = chapTitleText.split(' ');
    const chapWordsHtml = chapWords.map((word, wordIdx) => `
      <span class="nav-word" style="--word-idx: ${wordIdx};">${word}</span>
    `).join(' ');

    return `
      <li class="nav-chapter-item" style="--nav-item-idx: ${chapterHeaderIdx};">
        <div class="nav-chapter-header">
          ${chapWordsHtml}
        </div>
        <ul class="nav-chapter-pages">
          ${pagesHtml}
        </ul>
      </li>
    `;
  }).join('');

  // Event delegation: cliques nos botões de navegação (sem onclick inline)
  $.navList?.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.page, 10);
      goToPage(index);
      closeNav();
    });
  });
}

async function hasPaidAccess() {
  if (!CONFIG.isPaywallEnabled) return true;

  const userJson = localStorage.getItem(STORAGE_KEYS.user);
  if (!userJson) return false;

  try {
    const user = JSON.parse(userJson);
    const email = user?.email;
    if (!email) return false;

    // Se estiver em modo Supabase e online, verifica remotamente
    if (CONFIG.isSupabaseEnabled && navigator.onLine) {
      const { hasAccess } = await verifyPurchase(email);
      if (hasAccess) {
        localStorage.setItem('tdah-ebook:hasAccess', 'true');
      } else {
        localStorage.removeItem('tdah-ebook:hasAccess');
      }
      return hasAccess;
    } else {
      // Modo offline fallback: verifica purchases locais ou flag
      const hasLocalAccess = localStorage.getItem('tdah-ebook:hasAccess') === 'true';
      if (hasLocalAccess) return true;

      const purchases = JSON.parse(localStorage.getItem('tdah-ebook:purchases') || '[]');
      const hasPurchases = purchases.some(p => p.email === email && p.status === 'completed');
      if (hasPurchases) {
        localStorage.setItem('tdah-ebook:hasAccess', 'true');
        return true;
      }
      return false;
    }
  } catch (err) {
    console.error('[app] Erro checkAccess:', err);
    return localStorage.getItem('tdah-ebook:hasAccess') === 'true';
  }
}

async function goToPage(index) {
  if (index < 0 || index >= state.totalPages) return;

  // Paywall check
  const isPaidPage = index >= CONFIG.features.freePages;
  if (CONFIG.isPaywallEnabled && isPaidPage) {
    if (!isUserAuthenticated()) {
      showPaywall();
      return;
    }

    const paid = await hasPaidAccess();
    if (!paid) {
      showPaywall();
      return;
    }
  }

  state.currentPage = index;
  renderPage(index);
  saveProgress();
  updateNavActive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goPrev() {
  goToPage(state.currentPage - 1);
}

function goNext() {
  goToPage(state.currentPage + 1);
}

function updateNavActive() {
  $.navList?.querySelectorAll('button').forEach((btn) => {
    const pageIndex = parseInt(btn.dataset.page);
    btn.classList.toggle('active', pageIndex === state.currentPage);
  });
}

// Swipe
function setupSwipe() {
  let startX = 0;
  let startY = 0;

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, { passive: true });
}

// ==========================================
// RENDER
// ==========================================
function renderPage(index) {
  const pages = getPages();
  const page = pages[index];
  if (!page) return;

  // Atualiza breadcrumb
  const structure = getStructure();
  const chapter = structure.chapters?.find(c => c.id === page.chapterId);
  if ($.breadcrumb) {
    $.breadcrumb.innerHTML = chapter
      ? `<span>${chapter.title}</span><span style="color:var(--text-muted);margin:0 0.5rem;">›</span><span>${page.title}</span>`
      : `<span>${page.title}</span>`;
  }

  // Atualiza indicador
  if ($.pageIndicator) {
    $.pageIndicator.textContent = `${page.number} / ${pages.length}`;
  }

  // Atualiza progresso
  const progress = ((index + 1) / state.totalPages) * 100;
  if ($.progressFill) {
    $.progressFill.style.width = `${progress}%`;
  }

  // Renderiza conteúdo
  if ($.contentArea) {
    if (page.type === 'chapter-cover') {
      renderChapterCover(page);
    } else if (page.type === 'quiz') {
      renderQuizPlaceholder(page);
    } else {
      renderContent(page);
    }

    // WAAPI page transition (fade-in & slide-up)
    $.contentArea.animate([
      { opacity: 0, transform: 'translateY(16px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 350,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both'
    });
  }

  // Atualiza botões
  if ($.btnPrev) $.btnPrev.disabled = index === 0;
  if ($.btnNext) $.btnNext.disabled = index === state.totalPages - 1;

  // Bookmark icon
  updateBookmarkIcon();
}

function renderChapterCover(page) {
  $.contentArea.innerHTML = `
    <div class="cover-page">
      <div style="font-size:4rem;margin-bottom:1rem;">${page.icon || '📖'}</div>
      <span class="badge badge-primary" style="margin-bottom:1rem;">${page.title}</span>
      <h1 class="chapter-title" style="margin-top:1rem;">${page.subtitle}</h1>
      <button class="btn btn-primary btn-large" data-action="next-chapter" style="margin-top:2rem;">
        Começar Capítulo →
      </button>
    </div>
  `;
}

function renderContent(page) {
  $.contentArea.innerHTML = `
    <article>
      <h1 class="chapter-title">${page.title}</h1>
      ${page.content || '<p>Conteúdo em breve...</p>'}
    </article>
  `;

  // Re-inicializa accordion no novo conteúdo
  setupAccordion();

  // Re-attach checklist listeners
  setupChecklist();

  // Re-aplica leitura biônica se ativa
  if (bionicEnabled) {
    applyBionicToContent();
  }

  // Reconstrói blocos de foco se modo hiperfoco ativo
  if (state.activeFocus) {
    buildFocusBlocks();
  }
}

function renderQuizPlaceholder(page) {
  const quiz = getQuizzes()[page.quizId];
  $.contentArea.innerHTML = `
    <div style="text-align:center;padding:3rem 1rem;">
      <div style="font-size:3rem;margin-bottom:1rem;">🎯</div>
      <h2 class="chapter-title">${quiz?.title || page.title}</h2>
      <p style="color:var(--text-secondary);margin-bottom:2rem;">${quiz?.description || ''}</p>
      <button class="btn btn-primary btn-large" data-action="start-quiz" data-quiz-id="${page.quizId}">
        Iniciar Quiz
      </button>
    </div>
  `;
}

// ==========================================
// ACCORDION
// ==========================================
function setupAccordion() {
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    // Remove listeners antigos clonando
    const newTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(newTrigger, trigger);

    newTrigger.addEventListener('click', () => {
      const isExpanded = newTrigger.getAttribute('aria-expanded') === 'true';
      newTrigger.setAttribute('aria-expanded', !isExpanded);
      const panel = newTrigger.nextElementSibling;
      panel.classList.toggle('open', !isExpanded);
    });
  });
}

// ==========================================
// CHECKLIST
// ==========================================
function setupChecklist() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}');
  const checkedDays = saved.checkedDays || [];

  document.querySelectorAll('.checklist-checkbox').forEach(checkbox => {
    const day = checkbox.dataset.day;
    if (checkedDays.includes(day)) {
      checkbox.classList.add('checked');
      checkbox.innerHTML = '✓';
    }

    checkbox.addEventListener('click', () => {
      const isChecked = checkbox.classList.toggle('checked');
      checkbox.innerHTML = isChecked ? '✓' : '';

      const days = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}').checkedDays || [];
      if (isChecked) {
        days.push(day);
      } else {
        const idx = days.indexOf(day);
        if (idx > -1) days.splice(idx, 1);
      }
      saved.checkedDays = [...new Set(days)];
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(saved));
    });
  });
}

// ==========================================
// QUIZ
// ==========================================
window.__startQuiz = startQuiz; // mantido por compat; chamado via delegation abaixo

function startQuiz(quizId) {
  const quiz = getQuizzes()[quizId];
  if (!quiz) return;

  if (quizId === 'quiz-estrategias') {
    renderStrategyQuiz(quiz);
  } else {
    renderScoredQuiz(quiz, quizId);
  }

  openModalWithAnimation($.quizModal);
}

function renderScoredQuiz(quiz, quizId) {
  const body = document.getElementById('quiz-body');
  let currentQ = 0;
  let score = 0;

  function renderQuestion() {
    const q = quiz.questions[currentQ];
    body.innerHTML = `
      <div class="quiz-question">
        <div class="stepper" style="margin-bottom:1.5rem;">
          ${quiz.questions.map((_, i) => `
            <div class="step">
              <div class="step-dot ${i === currentQ ? 'active' : i < currentQ ? 'completed' : ''}">${i + 1}</div>
            </div>
            ${i < quiz.questions.length - 1 ? '<div class="step-connector ' + (i < currentQ ? 'completed' : '') + '"></div>' : ''}
          `).join('')}
        </div>
        <p class="quiz-question-text">${q.text}</p>
        <div class="quiz-options">
          ${q.options.map(opt => `
            <label class="quiz-option">
              <input type="radio" name="q${currentQ}" value="${opt.score}" style="display:none;">
              <span style="flex:1;">${opt.text}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.quiz-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const input = opt.querySelector('input');
        if (input) {
          input.checked = true;
          score += parseInt(input.value) || 0;
          currentQ++;
          if (currentQ < quiz.questions.length) {
            renderQuestion();
          } else {
            showQuizResult(quiz, score, quizId);
          }
        }
      });
    });
  }

  renderQuestion();
}

function renderStrategyQuiz(quiz) {
  const body = document.getElementById('quiz-body');
  const q = quiz.questions[0];

  body.innerHTML = `
    <div class="quiz-question">
      <p class="quiz-question-text">${q.text}</p>
      <div class="quiz-options">
        ${q.options.map(opt => `
          <button class="quiz-option" data-result="${opt.result}" style="text-align:left;">
            <span style="flex:1;">${opt.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  body.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = btn.dataset.result;
      const message = quiz.resultMessages?.[result] || 'Estratégia selecionada!';
      body.innerHTML = `
        <div class="quiz-result">
          <div class="quiz-result-score">💡</div>
          <h3 style="margin-bottom:1rem;">Sua Estratégia Ideal</h3>
          <p style="color:var(--text-secondary);margin-bottom:2rem;">${message}</p>
          <button class="btn btn-primary" data-action="close-quiz">Fechar</button>
        </div>
      `;
    });
  });
}

function showQuizResult(quiz, score, quizId) {
  const body = document.getElementById('quiz-body');
  const result = quiz.results?.find(r => score >= r.min && score <= r.max);

  body.innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-score">${score}</div>
      <h3 style="margin-bottom:0.5rem;">${result?.label || 'Resultado'}</h3>
      <p style="color:var(--text-secondary);margin-bottom:2rem;">${result?.description || ''}</p>
      <button class="btn btn-primary" data-action="close-quiz">Fechar</button>
    </div>
  `;

  // Salva resultado
  state.quizResults.push({ quizId, score, date: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEYS.quizResults, JSON.stringify(state.quizResults));
}

function closeQuiz() {
  closeModalWithAnimation($.quizModal);
}

window.__closeQuiz = closeQuiz; // compat

// ==========================================
// GLOSSARY
// ==========================================
function setupGlossary() {
  const list = document.getElementById('glossary-list');
  if (!list) return;

  list.innerHTML = getGlossary().map(item => `
    <div class="glossary-item" data-term="${item.term.toLowerCase()}">
      <span class="term-category">${item.category}</span>
      <dt>${item.term}</dt>
      <dd>${item.definition}</dd>
    </div>
  `).join('');
}

function handleGlossarySearch(e) {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.glossary-item').forEach(item => {
    const term = item.dataset.term;
    item.style.display = term.includes(query) ? '' : 'none';
  });
}

function openModalWithAnimation(modal) {
  if (!modal) return;
  modal.showModal();
  const content = modal.querySelector('.modal-content');
  if (content) {
    content.animate([
      { opacity: 0, transform: 'scale(0.92) translateY(12px)' },
      { opacity: 1, transform: 'scale(1) translateY(0)' }
    ], {
      duration: 300,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      fill: 'both'
    });
  }
}

function closeModalWithAnimation(modal) {
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  if (content) {
    const animation = content.animate([
      { opacity: 1, transform: 'scale(1) translateY(0)' },
      { opacity: 0, transform: 'scale(0.95) translateY(8px)' }
    ], {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      fill: 'both'
    });
    animation.onfinish = () => {
      modal.close();
    };
  } else {
    modal.close();
  }
}

function openGlossary() {
  setupGlossary();
  openModalWithAnimation($.glossaryModal);
}

function closeGlossary() {
  closeModalWithAnimation($.glossaryModal);
}

// ==========================================
// BOOKMARKS
// ==========================================
function toggleBookmark() {
  const pageNum = state.currentPage;
  if (state.bookmarks.has(pageNum)) {
    state.bookmarks.delete(pageNum);
    showToast('🔖 Marcador removido');
  } else {
    state.bookmarks.add(pageNum);
    showToast('🔖 Página marcada');
  }
  updateBookmarkIcon();
  saveProgress();
}

function updateBookmarkIcon() {
  const isMarked = state.bookmarks.has(state.currentPage);
  if ($.btnBookmark) {
    $.btnBookmark.style.opacity = isMarked ? '1' : '0.5';
    $.btnBookmark.style.color = isMarked ? 'var(--color-primary)' : '';
  }
}

// ==========================================
// FONT SIZE
// ==========================================
function cycleFontSize() {
  const sizes = [14, 16, 18, 20];
  const currentIdx = sizes.indexOf(state.fontSize);
  state.fontSize = sizes[(currentIdx + 1) % sizes.length];

  document.documentElement.style.fontSize = `${state.fontSize}px`;
  localStorage.setItem(STORAGE_KEYS.fontSize, state.fontSize);

  showToast(`🔤 Tamanho: ${state.fontSize}px`);
}

// ==========================================
// PROGRESS
// ==========================================
function saveProgress() {
  const data = {
    currentPage: state.currentPage,
    bookmarks: [...state.bookmarks],
    lastRead: new Date().toISOString(),
    checkedDays: JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}').checkedDays || []
  };
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(data));
  localStorage.setItem(STORAGE_KEYS.lastPage, state.currentPage);
}

function loadProgress() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}');
  state.currentPage = saved.currentPage || 0;
  state.bookmarks = new Set(saved.bookmarks || []);

  const lastPage = parseInt(localStorage.getItem(STORAGE_KEYS.lastPage));
  if (!isNaN(lastPage)) state.currentPage = lastPage;
}

// ==========================================
// PDF EXPORT
// ==========================================
// Carrega jsPDF sob demanda (lazy) apenas quando o usuário exporta.
let jspdfPromise = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (jspdfPromise) return jspdfPromise;
  jspdfPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './js/vendor/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf);
    script.onerror = () => reject(new Error('Falha ao carregar jsPDF'));
    document.head.appendChild(script);
  });
  return jspdfPromise;
}

async function downloadPDF() {
  showToast('📥 Gerando PDF...');

  let jspdfLib;
  try {
    jspdfLib = await loadJsPDF();
  } catch (err) {
    showToast('❌ Não foi possível carregar a biblioteca de PDF.');
    console.error('[app.js] jsPDF load error:', err);
    return;
  }

  try {
    const { jsPDF } = jspdfLib;
    const doc = new jsPDF();

    // Título
    doc.setFontSize(20);
    doc.text('TDAH Descomplicado', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Ebook Interativo — Resumo', 105, 30, { align: 'center' });

    let y = 50;
    doc.setFontSize(10);

    getPages().forEach(page => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${page.number}. ${page.title}`, 20, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      // Extrai texto simples do HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = page.content || '';
      const text = tempDiv.textContent || '';
      const lines = doc.splitTextToSize(text, 170);

      lines.slice(0, 5).forEach(line => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 5;
      });

      y += 10;
    });

    doc.save('tdah-descomplicado.pdf');
    showToast('✅ PDF baixado!');
  } catch (err) {
    console.error('[app.js] Erro PDF:', err);
    showToast('❌ Erro ao gerar PDF');
  }
}

// ==========================================
// TOAST
// ==========================================
function showToast(message) {
  if (!$.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  $.toastContainer.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// PAYWALL
// ==========================================
function setupPaywall() {
  if (!CONFIG.isPaywallEnabled) return;

  // Hook no CTA de compra
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-comprar')) {
      e.preventDefault();
      handlePurchase();
    }
  });
}

function showPaywall() {
  const modal = document.getElementById('auth-modal');
  const gateway = document.getElementById('auth-gateway');

  if (gateway) {
    gateway.innerHTML = `
      <div class="auth-header">
        <div class="auth-logo">🔒</div>
        <h2 class="auth-title">Conteúdo Exclusivo</h2>
        <p class="auth-subtitle">Faça login ou adquira o acesso completo</p>
      </div>
      <div style="text-align:center;padding:2rem;">
        <p style="color:var(--text-secondary);margin-bottom:1.5rem;">
          Você leu ${CONFIG.features.freePages} páginas gratuitas.
          Adquira o acesso para continuar.
        </p>
        <a href="${CONFIG.cakto.checkoutUrl || '#'}" class="btn btn-primary btn-large" target="_blank" rel="noopener">
          Quero Acesso Completo — R$ 47,00
        </a>
        <div class="auth-divider">ou</div>
        <a href="login.html" class="btn btn-outline">Já tenho acesso — Fazer login</a>
        <p style="margin-top:1.5rem;font-size:0.75rem;color:var(--text-muted);">
          Dúvidas ou problema com acesso? <a href="mailto:bookflow@ebooksaude.shop" style="color:var(--color-primary);">bookflow@ebooksaude.shop</a>
        </p>
      </div>
    `;
  }

  openModalWithAnimation(modal);
}

function handlePurchase() {
  if (CONFIG.isCaktoEnabled && CONFIG.cakto.checkoutUrl) {
    window.open(CONFIG.cakto.checkoutUrl, '_blank', 'noopener,noreferrer');
  } else {
    showToast('⚠️ Pagamento disponível em breve');
  }
}

function isUserAuthenticated() {
  return !!localStorage.getItem(STORAGE_KEYS.authToken);
}

// ==========================================
// SERVICE WORKER
// ==========================================
function setupServiceWorker() {
  // PWA offline-first: registra o service worker em produção.
  // Em desenvolvimento (localhost) pulamos para evitar cache agressivo
  // durante iteração, mas mantemos compatível.
  if (!('serviceWorker' in navigator)) return;

  const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isDev && !CONFIG.features.offlineMode) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        console.log('[app.js] SW registrado:', reg.scope);
        // Força update quando uma nova versão do SW estiver disponível
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch(err => console.error('[app.js] Erro no SW:', err));
  });
}

// ==========================================
// EXPOSE GLOBALLY (para event handlers inline)
// ==========================================
window.__app = { goToPage, goNext, goPrev, showToast };
