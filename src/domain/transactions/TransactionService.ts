import { prisma } from '@/db/client';
import { Transaction, TransactionType } from '@prisma/client';
import { logger } from '@/utils/logger';

export interface CreateTransactionData {
  accountId: string;
  type: TransactionType;
  description: string;
  amountCents: number;
  postedAt: Date;
  sourceRef?: string;
}

export interface TransactionFilters {
  accountId?: string;
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface TransactionSummary {
  totalTransactions: number;
  totalAmount: number;
  categoryTotals: Record<TransactionType, number>;
  averageAmount: number;
}

export class TransactionService {
  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          accountId: data.accountId,
          type: data.type,
          description: data.description,
          amountCents: data.amountCents,
          postedAt: data.postedAt,
          sourceRef: data.sourceRef
        }
      });

      logger.info(`Transaction created: ${transaction.id} for account ${data.accountId}`);
      return transaction;
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw error;
    }
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    try {
      return await prisma.transaction.findUnique({
        where: { id },
        include: { account: { include: { employee: true } } }
      });
    } catch (error) {
      logger.error(`Error getting transaction ${id}:`, error);
      throw error;
    }
  }

  async getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
    try {
      const whereClause: any = {};

      if (filters.accountId) {
        whereClause.accountId = filters.accountId;
      }

      if (filters.type) {
        whereClause.type = filters.type;
      }

      if (filters.startDate || filters.endDate) {
        whereClause.postedAt = {};
        if (filters.startDate) {
          whereClause.postedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.postedAt.lte = filters.endDate;
        }
      }

      return await prisma.transaction.findMany({
        where: whereClause,
        include: { account: { include: { employee: true } } },
        orderBy: { postedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      });
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw error;
    }
  }

  async getTransactionsByAccount(accountId: string, limit: number = 50): Promise<Transaction[]> {
    try {
      return await prisma.transaction.findMany({
        where: { accountId },
        orderBy: { postedAt: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error(`Error getting transactions for account ${accountId}:`, error);
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

  async getTransactionSummary(filters: TransactionFilters = {}): Promise<TransactionSummary> {
    try {
      const whereClause: any = {};

      if (filters.accountId) {
        whereClause.accountId = filters.accountId;
      }

      if (filters.type) {
        whereClause.type = filters.type;
      }

      if (filters.startDate || filters.endDate) {
        whereClause.postedAt = {};
        if (filters.startDate) {
          whereClause.postedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          whereClause.postedAt.lte = filters.endDate;
        }
      }

      const transactions = await prisma.transaction.findMany({
        where: whereClause
      });

      const totalTransactions = transactions.length;
      const totalAmount = transactions.reduce((sum, t) => sum + t.amountCents, 0);
      const averageAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

      const categoryTotals = transactions.reduce((totals, transaction) => {
        totals[transaction.type] = (totals[transaction.type] || 0) + transaction.amountCents;
        return totals;
      }, {} as Record<TransactionType, number>);

      return {
        totalTransactions,
        totalAmount,
        categoryTotals,
        averageAmount
      };
    } catch (error) {
      logger.error('Error getting transaction summary:', error);
      throw error;
    }
  }

  async getRecentTransactions(accountId: string, days: number = 30): Promise<Transaction[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await prisma.transaction.findMany({
        where: {
          accountId,
          postedAt: { gte: startDate }
        },
        orderBy: { postedAt: 'desc' },
        take: 20
      });
    } catch (error) {
      logger.error(`Error getting recent transactions for account ${accountId}:`, error);
      throw error;
    }
  }

  async searchTransactions(query: string, accountId?: string): Promise<Transaction[]> {
    try {
      const whereClause: any = {
        description: { contains: query, mode: 'insensitive' }
      };

      if (accountId) {
        whereClause.accountId = accountId;
      }

      return await prisma.transaction.findMany({
        where: whereClause,
        include: { account: { include: { employee: true } } },
        orderBy: { postedAt: 'desc' },
        take: 20
      });
    } catch (error) {
      logger.error(`Error searching transactions with query "${query}":`, error);
      throw error;
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    try {
      await prisma.transaction.delete({
        where: { id }
      });

      logger.info(`Transaction deleted: ${id}`);
    } catch (error) {
      logger.error(`Error deleting transaction ${id}:`, error);
      throw error;
    }
  }

  async updateTransaction(id: string, data: Partial<CreateTransactionData>): Promise<Transaction> {
    try {
      const transaction = await prisma.transaction.update({
        where: { id },
        data
      });

      logger.info(`Transaction updated: ${id}`);
      return transaction;
    } catch (error) {
      logger.error(`Error updating transaction ${id}:`, error);
      throw error;
    }
  }
}
