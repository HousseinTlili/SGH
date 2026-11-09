import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { isDbReady } from './db';
import { correlation, errorHandler, notFound, sendError } from './errors';
import { router } from './routes';

export const app = express();

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
