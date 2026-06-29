import { CONFIG } from './config.js';

// Tabs
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const name = tab.dataset.tab;
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formMagic = document.getElementById('form-magic');
    const magicSuccess = document.getElementById('magic-success');

    if (formLogin) formLogin.style.display = name === 'login' ? 'flex' : 'none';
    if (formRegister) formRegister.style.display = name === 'register' ? 'flex' : 'none';
    if (formMagic) formMagic.style.display = name === 'magic' ? 'flex' : 'none';
    if (magicSuccess) magicSuccess.style.display = 'none';
  });
});

// Login
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  if (!CONFIG.isSupabaseEnabled) {
    // Modo offline
    const saved = localStorage.getItem('tdah-ebook:user');
    const user = saved ? JSON.parse(saved) : null;
    if (user && user.email === email) {
      localStorage.setItem('tdah-ebook:authToken', 'local-token');
      window.location.href = 'index.html';
      return;
    }
    alert('Email ou senha incorretos (modo offline)');
    return;
  }

  // Com Supabase — carrega SDK dinamicamente
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.href = 'index.html';
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

// Register
document.getElementById('form-register')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = e.target.name.value;
  const email = e.target.email.value;
  const password = e.target.password.value;

  if (!CONFIG.isSupabaseEnabled) {
    const user = { email, id: 'local-' + Date.now(), full_name: name };
    localStorage.setItem('tdah-ebook:user', JSON.stringify(user));
    localStorage.setItem('tdah-ebook:authToken', 'local-token');
    alert('Conta criada! (modo offline)');
    window.location.href = 'index.html';
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) throw error;
    alert('Conta criada! Verifique seu email.');
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

// Magic link
document.getElementById('form-magic')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;

  if (!CONFIG.isSupabaseEnabled) {
    alert('Magic Link disponível apenas com Supabase configurado.');
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    const formMagic = document.getElementById('form-magic');
    const magicSuccess = document.getElementById('magic-success');
    if (formMagic) formMagic.style.display = 'none';
    if (magicSuccess) magicSuccess.style.display = 'block';
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});
