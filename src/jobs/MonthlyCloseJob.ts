import { Job } from 'bullmq';
import { prisma } from '@/db/client';
import { AccountService } from '@/domain/accounts/AccountService';
import { StatementService } from '@/domain/statements/StatementService';
import { WhatsAppClient } from '@/services/WhatsAppClient';
import { WHATSAPP_COPYS, formatCurrency, formatDate } from '@/domain/whatsapp/copy';
import { logger } from '@/utils/logger';

export interface MonthlyCloseJobData {
  accountId?: string;
  closingDate: string;
  sendNotifications?: boolean;
}

export class MonthlyCloseJob {
  private accountService: AccountService;
  private statementService: StatementService;
  private whatsappClient: WhatsAppClient;

  constructor() {
    this.accountService = new AccountService();
    this.statementService = new StatementService();
    this.whatsappClient = new WhatsAppClient();
  }

  async process(job: Job<MonthlyCloseJobData>): Promise<void> {
    const { accountId, closingDate, sendNotifications = false } = job.data;
    const closeDate = new Date(closingDate);

    try {
      logger.info(`Starting monthly close job for date: ${closingDate}`);

      if (accountId) {
        // Cerrar cuenta específica
        await this.closeAccount(accountId, closeDate, sendNotifications);
      } else {
        // Cerrar todas las cuentas activas
        await this.closeAllAccounts(closeDate, sendNotifications);
      }

      logger.info(`Monthly close job completed for date: ${closingDate}`);
    } catch (error) {
      logger.error(`Error in monthly close job:`, error);
      throw error;
    }
  }

  private async closeAccount(accountId: string, closingDate: Date, sendNotifications: boolean): Promise<void> {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { employee: true }
      });

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Obtener datos del período
      const openPeriod = this.accountService.getOpenPeriod(account);
      const periodData = await this.accountService.getPeriodData(accountId, openPeriod.start, closingDate);

      // Crear statement
      const statement = await this.statementService.createStatement({
        accountId,
        periodStart: periodData.start,
        periodEnd: periodData.end,
        closingBalanceCents: periodData.closingBalance
      });

      // Generar PDF
      const pdfUrl = await this.statementService.generateStatementPDF(statement.id);

      // Actualizar statement con URL del PDF
      await prisma.statement.update({
        where: { id: statement.id },
        data: { pdfUrl }
      });

      // Actualizar fecha de último cierre
      await prisma.account.update({
        where: { id: accountId },
        data: { lastClosingAt: closingDate }
      });

      // Enviar notificación si está habilitado
      if (sendNotifications) {
        await this.sendClosingNotification(account.employee.phoneE164, account.employee.fullName, periodData);
      }

      logger.info(`Account ${accountId} closed successfully`);
    } catch (error) {
      logger.error(`Error closing account ${accountId}:`, error);
      throw error;
    }
  }

  private async closeAllAccounts(closingDate: Date, sendNotifications: boolean): Promise<void> {
    try {
      const accounts = await prisma.account.findMany({
        include: { employee: true }
      });

      const results = await Promise.allSettled(
        accounts.map(account => this.closeAccount(account.id, closingDate, sendNotifications))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`Bulk close completed: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason);
        
        logger.error('Some accounts failed to close:', errors);
      }
    } catch (error) {
      logger.error('Error in bulk close:', error);
      throw error;
    }
  }

  private async sendClosingNotification(phoneNumber: string, employeeName: string, periodData: any): Promise<void> {
    try {
      const templateMessage = WHATSAPP_COPYS.TEMPLATES.CUENTA_LISTO
        .replace('{{1}}', employeeName)
        .replace('{{2}}', formatDate(periodData.start))
        .replace('{{3}}', formatDate(periodData.end));

      // Enviar mensaje con botones
      await this.whatsappClient.sendButtons(
        phoneNumber,
        templateMessage,
        [
          { id: 'NOTIF_VIEW_SUMMARY', title: 'Ver resumen' },
          { id: 'NOTIF_GET_PDF', title: 'Recibir PDF' }
        ]
      );

      logger.info(`Closing notification sent to ${phoneNumber}`);
    } catch (error) {
      logger.error(`Error sending notification to ${phoneNumber}:`, error);
    }
  }

  async scheduleMonthlyClose(closingDate: Date, sendNotifications: boolean = false): Promise<void> {
    // Este método sería llamado desde el QueueManager para programar el job
    logger.info(`Monthly close scheduled for ${closingDate.toISOString()}`);
  }

  async getClosingStats(closingDate: Date): Promise<{
    totalAccounts: number;
    closedAccounts: number;
    pendingAccounts: number;
    totalTransactions: number;
    totalAmount: number;
  }> {
    try {
      const totalAccounts = await prisma.account.count();
      
      const closedAccounts = await prisma.account.count({
        where: {
          lastClosingAt: {
            gte: new Date(closingDate.getFullYear(), closingDate.getMonth(), 1),
            lte: closingDate
          }
        }
      });

      const pendingAccounts = totalAccounts - closedAccounts;

      // Estadísticas de transacciones del período
      const startOfMonth = new Date(closingDate.getFullYear(), closingDate.getMonth(), 1);
      const transactions = await prisma.transaction.findMany({
        where: {
          postedAt: {
            gte: startOfMonth,
            lte: closingDate
          }
        }
      });

      const totalTransactions = transactions.length;
      const totalAmount = transactions.reduce((sum, t) => sum + t.amountCents, 0);

      return {
        totalAccounts,
        closedAccounts,
        pendingAccounts,
        totalTransactions,
        totalAmount
      };
    } catch (error) {
      logger.error('Error getting closing stats:', error);
      throw error;
    }
  }
}
