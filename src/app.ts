import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import pino from 'pino';
import adminRoutes from './routes/admin.routes';
import { env } from './config/env';

export const createApp = (): Express => {
  const app: Express = express();
  const logger = pino({ level: env.LOG_LEVEL || 'info' });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP Request Logging
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: {
          ignore: (req) => req.url === '/health',
        },
      }),
    );
  }

  // Mount Admin API Routes at root and /api/v1
  app.use('/', adminRoutes);
  app.use('/api/v1', adminRoutes);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      error: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('[GlobalErrorHandler] Uncaught request error:', err?.message || err);
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'INTERNAL_SERVER_ERROR',
      error: err.message || 'An unexpected internal server error occurred',
    });
  });

  return app;
};

export default createApp();
