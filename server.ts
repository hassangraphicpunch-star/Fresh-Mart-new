import express from 'express';
import * as dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/routes/api.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded product images
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // Mount API routes
  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fresh Mart server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
