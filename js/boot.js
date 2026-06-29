import { CONFIG } from './config.js';

async function boot() {
  try {
    // Carrega app (que internamente carrega dados do briefing)
    const app = await import('./main-controller.js');
    await app.init();

    // Atualiza título dinamicamente
    const titleEl = document.querySelector('title');
    if (titleEl && titleEl.textContent === 'Carregando Ebook...') {
      // O app.js atualizará o título após carregar os dados
    }

    // Carrega Supabase (se configurado)
    if (CONFIG.isSupabaseEnabled) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = async () => {
        const integrations = await import('./integrations.js');
        await integrations.initIntegrations();
      };
      document.head.appendChild(script);
    }
  } catch (err) {
    console.error('[boot] Erro:', err);
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="error-state">
          <p>❌ Erro ao carregar o ebook.</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:1rem;">${err.message}</p>
        </div>
      `;
    }
  }
}

boot();
