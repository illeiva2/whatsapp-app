import PDFDocument from 'pdfkit';
import { StatementWithAccount } from '@/domain/statements/StatementService';
import { formatCurrency, formatDate } from '@/domain/whatsapp/copy';
import { logger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class PDFGenerator {
  private storagePath: string;

  constructor() {
    this.storagePath = process.env.PDF_STORAGE_PATH || './storage/statements';
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async generateStatementPDF(statement: StatementWithAccount): Promise<string> {
    try {
      const fileName = `${statement.account.employee.employeeCode}-${statement.periodEnd.toISOString().split('T')[0]}.pdf`;
      const filePath = path.join(this.storagePath, fileName);
      
      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      // Pipe to file
      doc.pipe(fs.createWriteStream(filePath));

      // Generar contenido del PDF
      await this.generatePDFContent(doc, statement);

      // Finalizar documento
      doc.end();

      // Esperar a que se complete la escritura
      await new Promise<void>((resolve, reject) => {
        doc.on('end', () => resolve());
        doc.on('error', reject);
      });

      // Retornar URL pública (en producción sería una URL real)
      const publicUrl = `/storage/statements/${fileName}`;
      
      logger.info(`PDF generated: ${filePath}`);
      return publicUrl;
    } catch (error) {
      logger.error('Error generating PDF:', error);
      throw error;
    }
  }

  private async generatePDFContent(doc: any, statement: StatementWithAccount): Promise<void> {
    const { account, periodStart, periodEnd, closingBalanceCents } = statement;
    const { employee } = account;
    const companyName = process.env.COMPANY_NAME || 'Tu Empresa';

    // Obtener transacciones del período
    const transactions = await this.getTransactionsForPeriod(account.id, periodStart, periodEnd);

    // Encabezado
    doc.fontSize(20).text(companyName, { align: 'center' });
    doc.fontSize(16).text('Extracto de Cuenta Corriente', { align: 'center' });
    doc.moveDown();

    // Información del empleado
    doc.fontSize(12);
    doc.text(`Empleado: ${employee.fullName}`);
    doc.text(`Legajo: ${employee.employeeCode}`);
    doc.text(`Teléfono: ${employee.phoneE164}`);
    doc.text(`Período: ${formatDate(periodStart)} - ${formatDate(periodEnd)}`);
    doc.moveDown();

    // Saldo de cierre
    doc.fontSize(14).text(`Saldo de Cierre: ${formatCurrency(closingBalanceCents)}`, { align: 'right' });
    doc.moveDown();

    // Tabla de transacciones
    this.generateTransactionsTable(doc, transactions);

    // Pie de página
    doc.fontSize(10);
    doc.text(`Generado el: ${formatDate(new Date())}`, { align: 'center' });
  }

  private generateTransactionsTable(doc: any, transactions: any[]): void {
    const tableTop = doc.y;
    const itemHeight = 20;
    const pageHeight = doc.page.height;
    const pageMargin = 50;
    const tableWidth = doc.page.width - (pageMargin * 2);

    // Encabezados de tabla
    doc.fontSize(10);
    doc.text('Fecha', pageMargin, tableTop);
    doc.text('Rubro', pageMargin + 80, tableTop);
    doc.text('Descripción', pageMargin + 150, tableTop);
    doc.text('Importe', pageMargin + 350, tableTop, { align: 'right' });

    // Línea separadora
    doc.moveTo(pageMargin, tableTop + 15)
       .lineTo(pageMargin + tableWidth, tableTop + 15)
       .stroke();

    let currentY = tableTop + 25;

    // Filas de transacciones
    for (const transaction of transactions) {
      // Verificar si necesitamos nueva página
      if (currentY + itemHeight > pageHeight - pageMargin) {
        doc.addPage();
        currentY = pageMargin;
      }

      doc.text(formatDate(transaction.postedAt), pageMargin, currentY);
      doc.text(transaction.type, pageMargin + 80, currentY);
      doc.text(transaction.description, pageMargin + 150, currentY, { width: 200 });
      doc.text(formatCurrency(transaction.amountCents), pageMargin + 350, currentY, { align: 'right' });

      currentY += itemHeight;
    }

    // Línea final
    doc.moveTo(pageMargin, currentY)
       .lineTo(pageMargin + tableWidth, currentY)
       .stroke();
  }

  private async getTransactionsForPeriod(accountId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const { prisma } = await import('@/db/client');
    
    return await prisma.transaction.findMany({
      where: {
        accountId,
        postedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { postedAt: 'asc' }
    });
  }

  async generateBulkStatementsPDF(statements: StatementWithAccount[]): Promise<string> {
    try {
      const fileName = `extractos-${new Date().toISOString().split('T')[0]}.pdf`;
      const filePath = path.join(this.storagePath, fileName);
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      doc.pipe(fs.createWriteStream(filePath));

      for (let i = 0; i < statements.length; i++) {
        if (i > 0) {
          doc.addPage();
        }
        await this.generatePDFContent(doc, statements[i]!);
      }

      doc.end();

      await new Promise<void>((resolve, reject) => {
        doc.on('end', () => resolve());
        doc.on('error', reject);
      });

      const publicUrl = `/storage/statements/${fileName}`;
      logger.info(`Bulk PDF generated: ${filePath}`);
      return publicUrl;
    } catch (error) {
      logger.error('Error generating bulk PDF:', error);
      throw error;
    }
  }

  async deletePDF(fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`PDF deleted: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Error deleting PDF ${fileName}:`, error);
      throw error;
    }
  }

  getPDFUrl(fileName: string): string {
    return `/storage/statements/${fileName}`;
  }
}
