import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { QueueManager } from '../jobs/QueueManager';
import { EmployeeService } from '../domain/employees/EmployeeService';
import { AccountService } from '../domain/accounts/AccountService';
import { StatementService } from '../domain/statements/StatementService';
import { TicketService } from '../domain/tickets/TicketService';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/logger';

const router = Router();
const queueManager = new QueueManager();
const employeeService = new EmployeeService();
const accountService = new AccountService();
const statementService = new StatementService();
const ticketService = new TicketService();

// Configurar multer para archivos CSV
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Middleware de autenticación
const authenticateAdmin = (req: Request, res: Response, next: any) => {
  const token = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
};

// Aplicar autenticación a todas las rutas
router.use(authenticateAdmin);

// Esquemas de validación
const ImportCsvSchema = z.object({
  fileType: z.enum(['employees', 'transactions']),
});

const ClosePeriodSchema = z.object({
  accountId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sendNotifications: z.boolean().optional().default(false),
});

const EmployeeSummarySchema = z.object({
  id: z.string().optional(),
  phone: z.string().optional(),
});

// Importar CSV
router.post('/import/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { fileType } = ImportCsvSchema.parse(req.body);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validar archivo
    const { ImportJob } = await import('@/jobs/ImportJob');
    const importJob = new ImportJob();
    
    const validation = await importJob.validateImportFile(req.file.path, fileType);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid file format',
        details: validation.errors
      });
    }

    // Agregar job a la cola
    const importQueue = queueManager.createQueue('import');
    const job = await queueManager.addJob('import', 'import-data', {
      filePath: req.file.path,
      fileType
    });

    return res.json({
      message: 'Import job queued',
      jobId: job.id,
      totalRows: validation.rowCount
    });

  } catch (error) {
    logger.error('Error importing CSV:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cerrar período
router.post('/close-period', async (req: Request, res: Response) => {
  try {
    const { accountId, date, sendNotifications } = ClosePeriodSchema.parse(req.body);
    const closingDate = new Date(date);

    const closeQueue = queueManager.createQueue('monthly-close');
    const job = await queueManager.addJob('monthly-close', 'close-period', {
      accountId,
      closingDate: date,
      sendNotifications
    });

    return res.json({
      message: 'Close period job queued',
      jobId: job.id,
      closingDate: date
    });

  } catch (error) {
    logger.error('Error queuing close period:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cerrar período para todas las cuentas
router.post('/close-period/all', async (req: Request, res: Response) => {
  try {
    const { date, sendNotifications } = ClosePeriodSchema.parse(req.body);
    const closingDate = new Date(date);

    const closeQueue = queueManager.createQueue('monthly-close');
    const job = await queueManager.addJob('monthly-close', 'close-period', {
      closingDate: date,
      sendNotifications
    });

    return res.json({
      message: 'Close period job queued for all accounts',
      jobId: job.id,
      closingDate: date
    });

  } catch (error) {
    logger.error('Error queuing bulk close period:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Obtener resumen de empleado
router.get('/employees/:id/summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    const employee = await employeeService.getEmployeeById(id);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const summary = await accountService.getAccountSummary(id);
    
    return res.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        phoneE164: employee.phoneE164
      },
      summary
    });

  } catch (error) {
    logger.error('Error getting employee summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Obtener resumen por teléfono
router.get('/employees/by-phone/:phone/summary', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    const employee = await employeeService.getEmployeeByPhone(phone);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const summary = await accountService.getAccountSummary(employee.id);
    
    return res.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        phoneE164: employee.phoneE164
      },
      summary
    });

  } catch (error) {
    logger.error('Error getting employee summary by phone:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Handover de ticket a RR. HH.
router.post('/tickets/:id/hand-over', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }
    const ticket = await ticketService.handoverToHR(id);
    
    return res.json({
      message: 'Ticket handed over to HR',
      ticket: {
        id: ticket.id,
        status: ticket.status
      }
    });

  } catch (error) {
    logger.error('Error handing over ticket:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Exportar datos de empleado
router.get('/employees/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    const employee = await employeeService.getEmployeeById(id);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const summary = await accountService.getAccountSummary(id);
    const statements = await statementService.getStatementsByEmployee(id);
    const tickets = await ticketService.getTicketsByEmployee(id);

    return res.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        dni: employee.dni,
        employeeCode: employee.employeeCode,
        phoneE164: employee.phoneE164,
        status: employee.status,
        createdAt: employee.createdAt
      },
      account: summary,
      statements: statements.map(s => ({
        id: s.id,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        closingBalanceCents: s.closingBalanceCents,
        pdfUrl: s.pdfUrl,
        createdAt: s.createdAt
      })),
      tickets: tickets.map(t => ({
        id: t.id,
        topic: t.topic,
        status: t.status,
        lastMessage: t.lastMessage,
        createdAt: t.createdAt
      }))
    });

  } catch (error) {
    logger.error('Error exporting employee data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Estadísticas generales
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [employeeStats, ticketStats, statementStats] = await Promise.all([
      employeeService.getAllEmployees().then(employees => ({
        total: employees.length,
        active: employees.filter(e => e.status === 'ACTIVE').length
      })),
      ticketService.getTicketStats(),
      statementService.getStatementStats()
    ]);

    res.json({
      employees: employeeStats,
      tickets: ticketStats,
      statements: statementStats
    });

  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Estado de las colas
router.get('/queues/status', async (req: Request, res: Response) => {
  try {
    const importStats = await queueManager.getQueueStats('import');
    const closeStats = await queueManager.getQueueStats('monthly-close');

    res.json({
      import: importStats,
      monthlyClose: closeStats
    });

  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
