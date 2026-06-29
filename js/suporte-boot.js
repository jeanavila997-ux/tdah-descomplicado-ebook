import { getInitialTheme, setTheme } from './config.js';

// Inicializa tema
setTheme(getInitialTheme());

// Accordion
document.querySelectorAll('.accordion-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', !isExpanded);
    const panel = trigger.nextElementSibling;
    if (panel) {
      panel.classList.toggle('open', !isExpanded);
    }
  });
});
