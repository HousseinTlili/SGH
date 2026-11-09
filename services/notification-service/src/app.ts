import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { isDbReady } from './db';
import { correlation, errorHandler, notFound, sendError } from './errors';
import { router } from './routes';

export const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(correlation);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'UP' });
});

app.use('/api', (req, res, next) => {
  if (!isDbReady()) return sendError(req, res, 503, 'Database unavailable');
  next();
});

app.use('/api/notifications', router);

app.use(notFound);
app.use(errorHandler);
