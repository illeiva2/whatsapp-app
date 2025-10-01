import { Job } from 'bullmq';
import { prisma } from '../db/client';
import { EmployeeService } from '../domain/employees/EmployeeService';
import { TransactionService } from '../domain/transactions/TransactionService';
import { TransactionType } from '@prisma/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import csv from 'csv-parser';

export interface ImportJobData {
  filePath: string;
  fileType: 'employees' | 'transactions';
  batchSize?: number;
}

export interface ImportResult {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: string[];
}

export class ImportJob {
  private employeeService: EmployeeService;
  private transactionService: TransactionService;

  constructor() {
    this.employeeService = new EmployeeService();
    this.transactionService = new TransactionService();
  }

  async process(job: Job<ImportJobData>): Promise<ImportResult> {
    const { filePath, fileType, batchSize = 100 } = job.data;

    try {
      logger.info(`Starting import job for ${fileType} from ${filePath}`);

      if (fileType === 'employees') {
        return await this.importEmployees(filePath, batchSize);
      } else if (fileType === 'transactions') {
        return await this.importTransactions(filePath, batchSize);
      } else {
        throw new Error(`Unknown file type: ${fileType}`);
      }
    } catch (error) {
      logger.error(`Error in import job:`, error);
      throw error;
    }
  }

  private async importEmployees(filePath: string, batchSize: number): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: []
    };

    const batch: any[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row: any) => {
          result.totalRows++;
          batch.push(row);

          if (batch.length >= batchSize) {
            await this.processEmployeeBatch(batch, result);
            batch.length = 0;
          }
        })
        .on('end', async () => {
          try {
            // Procesar último batch
            if (batch.length > 0) {
              await this.processEmployeeBatch(batch, result);
            }

            logger.info(`Employee import completed: ${result.successfulRows}/${result.totalRows} successful`);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private async processEmployeeBatch(batch: any[], result: ImportResult): Promise<void> {
    for (const row of batch) {
      try {
        // Validar datos requeridos
        if (!row.employeeCode || !row.fullName || !row.dni || !row.phoneE164) {
          result.failedRows++;
          result.errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          continue;
        }

        // Normalizar teléfono a E.164
        const phoneE164 = this.normalizePhoneNumber(row.phoneE164);

        // Verificar si el empleado ya existe
        const existingEmployee = await this.employeeService.getEmployeeByCode(row.employeeCode);
        
        if (existingEmployee) {
          // Actualizar empleado existente
          await this.employeeService.updateEmployee(existingEmployee.id, {
            fullName: row.fullName,
            dni: row.dni,
            phoneE164: phoneE164
          });
        } else {
          // Crear nuevo empleado
          await this.employeeService.createEmployee({
            fullName: row.fullName,
            dni: row.dni,
            phoneE164: phoneE164,
            employeeCode: row.employeeCode
          });
        }

        result.successfulRows++;
      } catch (error) {
        result.failedRows++;
        result.errors.push(`Error processing row ${JSON.stringify(row)}: ${error}`);
        logger.error(`Error processing employee row:`, error);
      }
    }
  }

  private async importTransactions(filePath: string, batchSize: number): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: []
    };

    const batch: any[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row: any) => {
          result.totalRows++;
          batch.push(row);

          if (batch.length >= batchSize) {
            await this.processTransactionBatch(batch, result);
            batch.length = 0;
          }
        })
        .on('end', async () => {
          try {
            // Procesar último batch
            if (batch.length > 0) {
              await this.processTransactionBatch(batch, result);
            }

            logger.info(`Transaction import completed: ${result.successfulRows}/${result.totalRows} successful`);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private async processTransactionBatch(batch: any[], result: ImportResult): Promise<void> {
    for (const row of batch) {
      try {
        // Validar datos requeridos
        if (!row.employeeCode || !row.postedAt || !row.type || !row.description || !row.amountARS) {
          result.failedRows++;
          result.errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          continue;
        }

        // Buscar empleado por código
        const employee = await this.employeeService.getEmployeeByCode(row.employeeCode);
        if (!employee) {
          result.failedRows++;
          result.errors.push(`Employee not found: ${row.employeeCode}`);
          continue;
        }

        // Obtener cuenta del empleado
        const account = await prisma.account.findUnique({
          where: { employeeId: employee.id }
        });

        if (!account) {
          result.failedRows++;
          result.errors.push(`Account not found for employee: ${row.employeeCode}`);
          continue;
        }

        // Validar tipo de transacción
        if (!Object.values(TransactionType).includes(row.type)) {
          result.failedRows++;
          result.errors.push(`Invalid transaction type: ${row.type}`);
          continue;
        }

        // Convertir monto a centavos
        const amountCents = Math.round(parseFloat(row.amountARS) * 100);

        // Crear transacción
        await this.transactionService.createTransaction({
          accountId: account.id,
          type: row.type,
          description: row.description,
          amountCents: amountCents,
          postedAt: new Date(row.postedAt),
          sourceRef: `import-${Date.now()}`
        });

        result.successfulRows++;
      } catch (error) {
        result.failedRows++;
        result.errors.push(`Error processing row ${JSON.stringify(row)}: ${error}`);
        logger.error(`Error processing transaction row:`, error);
      }
    }
  }

  private normalizePhoneNumber(phone: string): string {
    // Remover espacios y caracteres especiales
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si no empieza con +, agregar código de país argentino
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('54')) {
        normalized = '+' + normalized;
      } else if (normalized.startsWith('9')) {
        normalized = '+54' + normalized;
      } else {
        normalized = '+549' + normalized;
      }
    }
    
    return normalized;
  }

  async validateImportFile(filePath: string, fileType: 'employees' | 'transactions'): Promise<{
    isValid: boolean;
    errors: string[];
    rowCount: number;
  }> {
    const errors: string[] = [];
    let rowCount = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: any) => {
          rowCount++;
          
          if (fileType === 'employees') {
            if (!row.employeeCode || !row.fullName || !row.dni || !row.phoneE164) {
              errors.push(`Row ${rowCount}: Missing required fields`);
            }
          } else if (fileType === 'transactions') {
            if (!row.employeeCode || !row.postedAt || !row.type || !row.description || !row.amountARS) {
              errors.push(`Row ${rowCount}: Missing required fields`);
            }
            
            if (row.type && !Object.values(TransactionType).includes(row.type)) {
              errors.push(`Row ${rowCount}: Invalid transaction type: ${row.type}`);
            }
            
            if (row.amountARS && isNaN(parseFloat(row.amountARS))) {
              errors.push(`Row ${rowCount}: Invalid amount: ${row.amountARS}`);
            }
          }
        })
        .on('end', () => {
          resolve({
            isValid: errors.length === 0,
            errors,
            rowCount
          });
        })
        .on('error', (error: any) => {
          resolve({
            isValid: false,
            errors: [`File read error: ${error.message}`],
            rowCount: 0
          });
        });
    });
  }
}
