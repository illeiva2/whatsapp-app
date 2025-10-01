import { prisma } from '@/db/client';
import { Account, Transaction, TransactionType } from '@prisma/client';
import { logger } from '@/utils/logger';

export interface AccountSummary {
  account: Account;
  currentBalance: number;
  lastClosingDate?: Date;
  lastClosingBalance?: number;
  openPeriodTransactions: Transaction[];
  categoryTotals: Record<TransactionType, number>;
}

export interface PeriodData {
  start: Date;
  end: Date;
  transactions: Transaction[];
  openingBalance: number;
  closingBalance: number;
  categoryTotals: Record<TransactionType, number>;
}

export class AccountService {
  async getAccountByEmployeeId(employeeId: string): Promise<Account | null> {
    try {
      return await prisma.account.findUnique({
        where: { employeeId },
        include: {
          employee: true,
          transactions: {
            orderBy: { postedAt: 'desc' }
          },
          statements: {
            orderBy: { periodEnd: 'desc' }
          }
        }
      });
    } catch (error) {
      logger.error(`Error getting account for employee ${employeeId}:`, error);
      throw error;
    }
  }

  async getAccountSummary(employeeId: string): Promise<AccountSummary | null> {
    try {
      const account = await this.getAccountByEmployeeId(employeeId);
      if (!account) return null;

      // Obtener período abierto
      const openPeriod = this.getOpenPeriod(account);
      
      // Obtener transacciones del período abierto
      const openPeriodTransactions = await prisma.transaction.findMany({
        where: {
          accountId: account.id,
          postedAt: {
            gte: openPeriod.start,
            lte: openPeriod.end
          }
        },
        orderBy: { postedAt: 'desc' }
      });

      // Calcular saldo actual
      const currentBalance = openPeriodTransactions.reduce(
        (sum, transaction) => sum + transaction.amountCents,
        0
      );

      // Calcular totales por categoría
      const categoryTotals = openPeriodTransactions.reduce((totals, transaction) => {
        totals[transaction.type] = (totals[transaction.type] || 0) + transaction.amountCents;
        return totals;
      }, {} as Record<TransactionType, number>);

      // Obtener último cierre
      const statements = await prisma.statement.findMany({
        where: { accountId: account.id },
        orderBy: { periodEnd: 'desc' },
        take: 1
      });
      const lastStatement = statements[0];

      return {
        account,
        currentBalance,
        lastClosingDate: lastStatement?.periodEnd,
        lastClosingBalance: lastStatement?.closingBalanceCents,
        openPeriodTransactions,
        categoryTotals
      };
    } catch (error) {
      logger.error(`Error getting account summary for employee ${employeeId}:`, error);
      throw error;
    }
  }

  getOpenPeriod(account: Account): { start: Date; end: Date } {
    const now = new Date();
    
    if (account.lastClosingAt) {
      // Período abierto desde el último cierre
      return {
        start: account.lastClosingAt,
        end: now
      };
    } else {
      // Sin transacciones, período actual
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now
      };
    }
  }

  async getPeriodData(accountId: string, startDate: Date, endDate: Date): Promise<PeriodData> {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          accountId,
          postedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { postedAt: 'asc' }
      });

      // Calcular saldo de apertura (suma de transacciones anteriores)
      const openingBalance = await this.computeBalance(accountId, startDate);
      
      // Calcular saldo de cierre
      const closingBalance = openingBalance + transactions.reduce(
        (sum, transaction) => sum + transaction.amountCents,
        0
      );

      // Calcular totales por categoría
      const categoryTotals = transactions.reduce((totals, transaction) => {
        totals[transaction.type] = (totals[transaction.type] || 0) + transaction.amountCents;
        return totals;
      }, {} as Record<TransactionType, number>);

      return {
        start: startDate,
        end: endDate,
        transactions,
        openingBalance,
        closingBalance,
        categoryTotals
      };
    } catch (error) {
      logger.error(`Error getting period data for account ${accountId}:`, error);
      throw error;
    }
  }

  async computeBalance(accountId: string, untilDate?: Date): Promise<number> {
    try {
      const whereClause: any = { accountId };
      if (untilDate) {
        whereClause.postedAt = { lte: untilDate };
      }

      const result = await prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amountCents: true }
      });

      return result._sum.amountCents || 0;
    } catch (error) {
      logger.error(`Error computing balance for account ${accountId}:`, error);
      throw error;
    }
  }

  async getTransactionsByCategory(
    accountId: string, 
    category: TransactionType, 
    limit: number = 10
  ): Promise<Transaction[]> {
    try {
      return await prisma.transaction.findMany({
        where: {
          accountId,
          type: category
        },
        orderBy: { postedAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error(`Error getting transactions by category for account ${accountId}:`, error);
      throw error;
    }
  }

  async updateClosingDay(accountId: string, closingDay: number): Promise<Account> {
    try {
      const account = await prisma.account.update({
        where: { id: accountId },
        data: { closingDay }
      });

      logger.info(`Closing day updated for account ${accountId}: ${closingDay}`);
      return account;
    } catch (error) {
      logger.error(`Error updating closing day for account ${accountId}:`, error);
      throw error;
    }
  }

  async closePeriod(accountId: string, closingDate: Date): Promise<void> {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Obtener datos del período
      const openPeriod = this.getOpenPeriod(account);
      const periodData = await this.getPeriodData(accountId, openPeriod.start, closingDate);

      // Crear statement
      await prisma.statement.create({
        data: {
          accountId,
          periodStart: periodData.start,
          periodEnd: periodData.end,
          closingBalanceCents: periodData.closingBalance
        }
      });

      // Actualizar fecha de último cierre
      await prisma.account.update({
        where: { id: accountId },
        data: { lastClosingAt: closingDate }
      });

      logger.info(`Period closed for account ${accountId} on ${closingDate}`);
    } catch (error) {
      logger.error(`Error closing period for account ${accountId}:`, error);
      throw error;
    }
  }
}
