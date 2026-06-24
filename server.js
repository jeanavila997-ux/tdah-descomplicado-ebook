/**
 * server.js — Servidor Node.js/Express para hospedar o Ebook PWA
 * Otimizado para produção: compressão, segurança e headers PWA
 */

import express from 'express';
import path from 'path';
import compression from 'compression';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ativa compressão gzip
app.use(compression());

// Headers de segurança básicos (sem CSP estrita para não quebrar inline scripts)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Headers específicos para PWA
app.use((req, res, next) => {
  // Service worker precisa de header especial
  if (req.url.endsWith('service-worker.js')) {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }
  // Manifest não deve cachear
  if (req.url.endsWith('manifest.json')) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }
  next();
});

// Serve arquivos estáticos da raiz
app.use(express.static(path.join(__dirname, '.'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache de 1 ano para assets (icons, vendor libs)
    if (path.includes('/assets/') || path.includes('/js/vendor/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Fallback para SPA: qualquer rota retorna index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Ebook PWA rodando em http://localhost:${PORT}`);
});
