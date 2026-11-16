import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes';
import { connectMongo } from './server/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Attempt initial MongoDB Atlas connection (non-fatal if env not set yet)
  await connectMongo();

  // API routes
  app.use('/api', apiRouter);
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API non trovato.' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const parentDist = path.resolve(__dirname, '..', 'dist');
    const localDist = path.resolve(__dirname, 'dist');
    const resolvedDist = fs.existsSync(parentDist)
      ? parentDist
      : fs.existsSync(localDist)
      ? localDist
      : path.resolve(process.cwd(), 'dist');

    app.use(express.static(resolvedDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(resolvedDist, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FantaJESic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FantaJESic server:', err);
  process.exit(1);
});
