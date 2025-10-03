import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { QueueManager } from './jobs/QueueManager';
import { MonthlyCloseJob } from './jobs/MonthlyCloseJob';
import { ImportJob } from './jobs/ImportJob';

// Importar rutas
import webhookRoutes from './routes/webhook';
import adminRoutes from './routes/admin';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Detrás de proxy (Render, Nginx, etc.) para que express-rate-limit use X-Forwarded-For
app.set('trust proxy', 1);

// Configurar middleware de seguridad
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Rate limiting específico para webhook de WhatsApp
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto
  message: 'Too many webhook requests, please try again later.',
});

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar QueueManager y workers
const queueManager = new QueueManager();

// Crear colas
const importQueue = queueManager.createQueue('import');
const monthlyCloseQueue = queueManager.createQueue('monthly-close');

// Crear workers
const importWorker = queueManager.createWorker('import', async (job) => {
  const importJob = new ImportJob();
  return await importJob.process(job);
});

const monthlyCloseWorker = queueManager.createWorker('monthly-close', async (job) => {
  const monthlyCloseJob = new MonthlyCloseJob();
  return await monthlyCloseJob.process(job);
});

// Rutas
app.use('/webhook', webhookLimiter, webhookRoutes);
app.use('/admin', adminRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'WhatsApp Business Accounts Management API',
    version: '1.0.0',
    endpoints: {
      webhook: '/webhook/whatsapp',
      admin: '/admin',
      health: '/health'
    }
  });
});

// Middleware de manejo de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Manejo de señales para graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await queueManager.closeAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await queueManager.closeAll();
  process.exit(0);
});

// Iniciar servidor (evitar levantar puerto durante tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📱 WhatsApp webhook: http://localhost:${PORT}/webhook/whatsapp`);
    logger.info(`🔧 Admin API: http://localhost:${PORT}/admin`);
    logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
