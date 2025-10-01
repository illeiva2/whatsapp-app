import { prisma } from '@/db/client';
import { Statement } from '@prisma/client';
import { logger } from '@/utils/logger';
import { PDFGenerator } from '@/services/PDFGenerator';

export interface CreateStatementData {
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  closingBalanceCents: number;
  pdfUrl?: string;
}

export interface StatementWithAccount extends Statement {
  account: {
    id: string;
    employee: {
      id: string;
      fullName: string;
      employeeCode: string;
      phoneE164: string;
    };
  };
}

export class StatementService {
  private pdfGenerator: PDFGenerator;

  constructor() {
    this.pdfGenerator = new PDFGenerator();
  }

  async createStatement(data: CreateStatementData): Promise<Statement> {
    try {
      const statement = await prisma.statement.create({
        data: {
          accountId: data.accountId,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          closingBalanceCents: data.closingBalanceCents,
          pdfUrl: data.pdfUrl || null
        }
      });

      logger.info(`Statement created: ${statement.id} for account ${data.accountId}`);
      return statement;
    } catch (error) {
      logger.error('Error creating statement:', error);
      throw error;
    }
  }

  async getStatementById(id: string): Promise<StatementWithAccount | null> {
    try {
      return await prisma.statement.findUnique({
        where: { id },
        include: {
          account: {
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  phoneE164: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      logger.error(`Error getting statement ${id}:`, error);
      throw error;
    }
  }

  async getStatementsByAccount(accountId: string): Promise<Statement[]> {
    try {
      return await prisma.statement.findMany({
        where: { accountId },
        orderBy: { periodEnd: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting statements for account ${accountId}:`, error);
      throw error;
    }
  }

  async getLatestStatement(accountId: string): Promise<Statement | null> {
    try {
      return await prisma.statement.findFirst({
        where: { accountId },
        orderBy: { periodEnd: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting latest statement for account ${accountId}:`, error);
      throw error;
    }
  }

  async generateStatementPDF(statementId: string): Promise<string> {
    try {
      const statement = await this.getStatementById(statementId);
      if (!statement) {
        throw new Error(`Statement ${statementId} not found`);
      }

      // Generar PDF
      const pdfUrl = await this.pdfGenerator.generateStatementPDF(statement);

      // Actualizar statement con URL del PDF
      await prisma.statement.update({
        where: { id: statementId },
        data: { pdfUrl }
      });

      logger.info(`PDF generated for statement ${statementId}: ${pdfUrl}`);
      return pdfUrl;
    } catch (error) {
      logger.error(`Error generating PDF for statement ${statementId}:`, error);
      throw error;
    }
  }

  async getStatementsByPeriod(startDate: Date, endDate: Date): Promise<StatementWithAccount[]> {
    try {
      return await prisma.statement.findMany({
        where: {
          periodStart: { gte: startDate },
          periodEnd: { lte: endDate }
        },
        include: {
          account: {
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  phoneE164: true
                }
              }
            }
          }
        },
        orderBy: { periodEnd: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting statements by period:`, error);
      throw error;
    }
  }

  async getStatementsByEmployee(employeeId: string): Promise<StatementWithAccount[]> {
    try {
      return await prisma.statement.findMany({
        where: {
          account: { employeeId }
        },
        include: {
          account: {
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  phoneE164: true
                }
              }
            }
          }
        },
        orderBy: { periodEnd: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting statements for employee ${employeeId}:`, error);
      throw error;
    }
  }

  async deleteStatement(id: string): Promise<void> {
    try {
      await prisma.statement.delete({
        where: { id }
      });

      logger.info(`Statement deleted: ${id}`);
    } catch (error) {
      logger.error(`Error deleting statement ${id}:`, error);
      throw error;
    }
  }

  async updateStatement(id: string, data: Partial<CreateStatementData>): Promise<Statement> {
    try {
      const statement = await prisma.statement.update({
        where: { id },
        data
      });

      logger.info(`Statement updated: ${id}`);
      return statement;
    } catch (error) {
      logger.error(`Error updating statement ${id}:`, error);
      throw error;
    }
  }

  async getStatementStats(): Promise<{
    totalStatements: number;
    totalAccounts: number;
    averageBalance: number;
    statementsThisMonth: number;
  }> {
    try {
      const totalStatements = await prisma.statement.count();
      const totalAccounts = await prisma.account.count();
      
      const avgResult = await prisma.statement.aggregate({
        _avg: { closingBalanceCents: true }
      });

      const thisMonth = new Date();
      thisMonth.setDate(1);
      
      const statementsThisMonth = await prisma.statement.count({
        where: {
          periodEnd: { gte: thisMonth }
        }
      });

      return {
        totalStatements,
        totalAccounts,
        averageBalance: avgResult._avg.closingBalanceCents || 0,
        statementsThisMonth
      };
    } catch (error) {
      logger.error('Error getting statement stats:', error);
      throw error;
    }
  }
}
