import { PrismaClient } from '@prisma/client';

// Mock de Prisma para tests
jest.mock('@/db/client', () => ({
  prisma: {
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    statement: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Mock de logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  sanitizeForLog: jest.fn((data) => data),
}));

// Mock de WhatsApp Client
jest.mock('@/services/WhatsAppClient', () => ({
  WhatsAppClient: jest.fn().mockImplementation(() => ({
    sendText: jest.fn().mockResolvedValue(true),
    sendButtons: jest.fn().mockResolvedValue(true),
    sendList: jest.fn().mockResolvedValue(true),
    sendDocument: jest.fn().mockResolvedValue(true),
    sendTemplate: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock de QueueManager
jest.mock('@/jobs/QueueManager', () => ({
  QueueManager: jest.fn().mockImplementation(() => ({
    createQueue: jest.fn().mockReturnValue({
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn(),
      close: jest.fn(),
    }),
    createWorker: jest.fn().mockReturnValue({
      on: jest.fn(),
      close: jest.fn(),
    }),
    addJob: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    getQueueStats: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    }),
    pauseQueue: jest.fn(),
    resumeQueue: jest.fn(),
    cleanQueue: jest.fn(),
    closeAll: jest.fn(),
    getQueue: jest.fn(),
    getWorker: jest.fn(),
  })),
}));

// Mock de PDFGenerator
jest.mock('@/services/PDFGenerator', () => ({
  PDFGenerator: jest.fn().mockImplementation(() => ({
    generateStatementPDF: jest.fn().mockResolvedValue('/path/to/pdf'),
    generateBulkStatementsPDF: jest.fn().mockResolvedValue('/path/to/bulk-pdf'),
    deletePDF: jest.fn(),
    getPDFUrl: jest.fn().mockReturnValue('/path/to/pdf'),
  })),
}));

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.WHATSAPP_TOKEN = 'test-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
process.env.VERIFY_TOKEN = 'test-verify-token';
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.COMPANY_NAME = 'Test Company';
process.env.PDF_STORAGE_PATH = './test-storage';
process.env.LOG_LEVEL = 'error';

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});

// Limpiar después de todos los tests
afterAll(async () => {
  // Cerrar conexiones si es necesario
  jest.restoreAllMocks();
});
