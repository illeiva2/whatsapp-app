import { prisma } from '../db/client';
import { WhatsAppClient } from './WhatsAppClient';
import { WHATSAPP_COPYS, formatCurrency, formatDate } from '../domain/whatsapp/copy';
import { TransactionType, TicketTopic } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ConversationState {
  phoneNumber: string;
  state: string;
  data?: any;
  lastActivity: Date;
}

export class ConversationFlow {
  private whatsappClient: WhatsAppClient;

  constructor() {
    this.whatsappClient = new WhatsAppClient();
  }

  async handleMessage(phoneNumber: string, messageText: string, messageType: string): Promise<void> {
    try {
      // Obtener o crear estado de conversación
      const state = await this.getOrCreateConversationState(phoneNumber);
      
      // Procesar mensaje según el estado actual
      await this.processMessage(state, messageText, messageType);
      
    } catch (error) {
      logger.error(`Error handling message from ${phoneNumber}:`, error);
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
    }
  }

  private async getOrCreateConversationState(phoneNumber: string): Promise<ConversationState> {
    // Buscar empleado por teléfono
    const employee = await prisma.employee.findUnique({
      where: { phoneE164: phoneNumber },
      include: { account: true }
    });

    if (employee) {
      return {
        phoneNumber,
        state: WHATSAPP_COPYS.CONVERSATION_STATES.MAIN_MENU,
        data: { employeeId: employee.id },
        lastActivity: new Date()
      };
    }

    // Empleado no encontrado, iniciar proceso de identificación
    return {
      phoneNumber,
      state: WHATSAPP_COPYS.CONVERSATION_STATES.NEW_OR_UNIDENTIFIED,
      data: {},
      lastActivity: new Date()
    };
  }

  private async processMessage(state: ConversationState, messageText: string, messageType: string): Promise<void> {
    const { phoneNumber, state: currentState, data } = state;

    switch (currentState) {
      case WHATSAPP_COPYS.CONVERSATION_STATES.NEW_OR_UNIDENTIFIED:
        await this.handleNewUser(phoneNumber, messageText, messageType);
        break;

      case WHATSAPP_COPYS.CONVERSATION_STATES.MAIN_MENU:
        await this.handleMainMenu(phoneNumber, messageText, data);
        break;

      case WHATSAPP_COPYS.CONVERSATION_STATES.SUMMARY:
        await this.showSummary(phoneNumber, data.employeeId);
        break;

      case WHATSAPP_COPYS.CONVERSATION_STATES.DETAIL_BY_CATEGORY:
        await this.showCategorySelection(phoneNumber, data.employeeId);
        break;

      case WHATSAPP_COPYS.CONVERSATION_STATES.DISPUTE_CHARGE:
        await this.handleDispute(phoneNumber, messageText, data);
        break;

      default:
        await this.showMainMenu(phoneNumber, data.employeeId);
    }
  }

  private async handleNewUser(phoneNumber: string, messageText: string, messageType: string): Promise<void> {
    // Si viene de un botón interactivo, procesar confirmación de identidad
    if (messageType === 'interactive') {
      if (messageText?.startsWith('CONFIRM_YES:')) {
        const employeeId = messageText.split(':')[1];
        if (!employeeId) {
          await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
          return;
        }
        // Verificar que el empleado no tenga teléfono asignado (seguridad)
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, phoneE164: true }
        });

        if (!employee) {
          await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_NOT_FOUND);
          return;
        }

        if (employee.phoneE164 && employee.phoneE164 !== phoneNumber) {
          // El empleado ya tiene otro teléfono asignado
          await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_ALREADY_LINKED);
          return;
        }

        // Vincular teléfono al empleado y continuar al menú
        await prisma.employee.update({
          where: { id: employeeId },
          data: { phoneE164: phoneNumber }
        });
        await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.IDENTITY_CONFIRMED);
        await this.showMainMenu(phoneNumber, employeeId);
        return;
      }
      if (messageText === 'CONFIRM_NO') {
        await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.IDENTITY_DENIED);
        return;
      }
      // Si es interactivo pero no es confirmación reconocida, pedir DNI nuevamente
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_INVALID_DNI);
      return;
    }

    // Para texto libre: esperar DNI de 7-8 dígitos
    const dni = messageText.trim();
    if (!/^\d{7,8}$/.test(dni)) {
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_INVALID_DNI);
      return;
    }

    // Buscar empleado por DNI
    const employee = await prisma.employee.findUnique({
      where: { dni },
      select: { id: true, fullName: true, dni: true, phoneE164: true }
    });

    if (!employee) {
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_NOT_FOUND);
      return;
    }

    // Verificar que el empleado no tenga teléfono asignado (seguridad)
    if (employee.phoneE164 && employee.phoneE164 !== phoneNumber) {
      // El empleado ya tiene otro teléfono asignado
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_ALREADY_LINKED);
      return;
    }

    // Confirmar identidad
    const confirmText = WHATSAPP_COPYS.CONFIRM_IDENTITY
      .replace('{{fullName}}', employee.fullName)
      .replace('{{dniLast3}}', employee.dni.slice(-3));

    await this.whatsappClient.sendButtons(
      phoneNumber,
      confirmText,
      [
        { id: `CONFIRM_YES:${employee.id}`, title: WHATSAPP_COPYS.CONFIRM_YES },
        { id: 'CONFIRM_NO', title: WHATSAPP_COPYS.CONFIRM_NO }
      ]
    );
  }

  private async handleMainMenu(phoneNumber: string, messageText: string, data: any): Promise<void> {
    const employeeId = data.employeeId;

    // Procesar respuestas del menú interactivo
    if (messageText === 'MENU_SUMMARY' || messageText.toLowerCase().includes('resumen')) {
      await this.showSummary(phoneNumber, employeeId);
    } else if (messageText === 'MENU_DETAIL' || messageText.toLowerCase().includes('detalle')) {
      await this.showCategorySelection(phoneNumber, employeeId);
    } else if (messageText === 'MENU_DISPUTE' || messageText.toLowerCase().includes('disputar')) {
      await this.startDispute(phoneNumber, employeeId);
    } else if (messageText === 'MENU_HANDOVER' || messageText.toLowerCase().includes('hablar')) {
      await this.handoverToHR(phoneNumber, employeeId);
    } else if (messageText === 'CAT_PANADERIA' || messageText.toLowerCase().includes('panader')) {
      await this.showCategoryDetail(phoneNumber, employeeId, 'PANADERIA');
      await this.showMainMenu(phoneNumber, employeeId);
    } else if (messageText === 'CAT_CARNICERIA' || messageText.toLowerCase().includes('carnicer')) {
      await this.showCategoryDetail(phoneNumber, employeeId, 'CARNICERIA');
      await this.showMainMenu(phoneNumber, employeeId);
    } else if (messageText === 'CAT_PROVEEDORES' || messageText.toLowerCase().includes('proveedor')) {
      await this.showCategoryDetail(phoneNumber, employeeId, 'PROVEEDORES');
      await this.showMainMenu(phoneNumber, employeeId);
    } else if (messageText === 'CAT_ADELANTO' || messageText.toLowerCase().includes('adelanto')) {
      await this.showCategoryDetail(phoneNumber, employeeId, 'ADELANTO');
      await this.showMainMenu(phoneNumber, employeeId);
    } else {
      // Mostrar menú principal
      await this.showMainMenu(phoneNumber, employeeId);
    }
  }

  private async showMainMenu(phoneNumber: string, employeeId: string): Promise<void> {
    const sections = [{
      title: 'Opciones',
      rows: [
        { id: 'MENU_SUMMARY', title: WHATSAPP_COPYS.MENU_OPTIONS.SUMMARY },
        { id: 'MENU_DETAIL', title: WHATSAPP_COPYS.MENU_OPTIONS.DETAIL },
        { id: 'MENU_DISPUTE', title: WHATSAPP_COPYS.MENU_OPTIONS.DISPUTE },
        { id: 'MENU_HANDOVER', title: WHATSAPP_COPYS.MENU_OPTIONS.HANDOVER }
      ]
    }];

    await this.whatsappClient.sendList(
      phoneNumber,
      WHATSAPP_COPYS.MAIN_MENU_BODY,
      sections,
      WHATSAPP_COPYS.MAIN_MENU_TITLE
    );
  }

  private async showSummary(phoneNumber: string, employeeId: string): Promise<void> {
    try {
      const account = await prisma.account.findUnique({
        where: { employeeId },
        include: {
          employee: true,
          transactions: true,
          statements: {
            orderBy: { periodEnd: 'desc' },
            take: 1
          }
        }
      });

      if (!account) {
        await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_NOT_FOUND);
        return;
      }

      // Calcular saldo actual general (todas las transacciones)
      const currentBalance = account.transactions.reduce((sum, t) => sum + t.amountCents, 0);
      const lastStatement = account.statements[0];

      let summaryText = WHATSAPP_COPYS.SUMMARY_HEADER + '\n\n';
      
      if (lastStatement) {
        summaryText += WHATSAPP_COPYS.SUMMARY_LAST_CLOSING
          .replace('{{lastClosingDate}}', formatDate(lastStatement.periodEnd))
          .replace('{{closingBalance}}', formatCurrency(lastStatement.closingBalanceCents)) + '\n';
      }

      summaryText += WHATSAPP_COPYS.SUMMARY_OPEN_PERIOD
        .replace('{{periodStart}}', formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
        .replace('hoy', formatDate(new Date())) + '\n';

      summaryText += WHATSAPP_COPYS.SUMMARY_CURRENT
        .replace('{{currentBalance}}', formatCurrency(currentBalance));

      await this.whatsappClient.sendText(phoneNumber, summaryText);

    } catch (error) {
      logger.error(`Error showing summary for ${phoneNumber}:`, error);
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
    }
  }

  private async showCategorySelection(phoneNumber: string, employeeId: string): Promise<void> {
    const buttons = [
      { id: 'CAT_PANADERIA', title: WHATSAPP_COPYS.CATEGORY_OPTIONS.PANADERIA },
      { id: 'CAT_CARNICERIA', title: WHATSAPP_COPYS.CATEGORY_OPTIONS.CARNICERIA },
      { id: 'CAT_PROVEEDORES', title: WHATSAPP_COPYS.CATEGORY_OPTIONS.PROVEEDORES },
      { id: 'CAT_ADELANTO', title: WHATSAPP_COPYS.CATEGORY_OPTIONS.ADELANTO }
    ];

    await this.whatsappClient.sendButtons(
      phoneNumber,
      WHATSAPP_COPYS.CATEGORY_SELECT,
      buttons
    );
  }

  private async showCategoryDetail(
    phoneNumber: string,
    employeeId: string,
    category: 'PANADERIA' | 'CARNICERIA' | 'PROVEEDORES' | 'ADELANTO'
  ): Promise<void> {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          account: { employeeId },
          type: category as any
        },
        orderBy: { postedAt: 'desc' },
        take: 20
      });

      if (!transactions.length) {
        await this.whatsappClient.sendText(
          phoneNumber,
          WHATSAPP_COPYS.CATEGORY_DETAIL_TOTAL
            .replace('{{category}}', WHATSAPP_COPYS.CATEGORY_OPTIONS[category])
            .replace('{{total}}', formatCurrency(0))
        );
        return;
      }

      const header = WHATSAPP_COPYS.CATEGORY_DETAIL_HEADER
        .replace('{{category}}', WHATSAPP_COPYS.CATEGORY_OPTIONS[category]);

      const lines = transactions.map(t =>
        WHATSAPP_COPYS.CATEGORY_DETAIL_ITEM
          .replace('{{date}}', formatDate(t.postedAt))
          .replace('{{desc}}', t.description || 'Movimiento')
          .replace('{{amount}}', formatCurrency(t.amountCents))
      );

      const total = transactions.reduce((sum, t) => sum + t.amountCents, 0);
      const footer = WHATSAPP_COPYS.CATEGORY_DETAIL_TOTAL
        .replace('{{category}}', WHATSAPP_COPYS.CATEGORY_OPTIONS[category])
        .replace('{{total}}', formatCurrency(total));

      const body = [header, ...lines, '', footer].join('\n');
      await this.whatsappClient.sendText(phoneNumber, body);
    } catch (error) {
      logger.error(`Error showing ${category} detail for ${phoneNumber}:`, error);
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
    }
  }

  private async sendStatementPDF(phoneNumber: string, employeeId: string): Promise<void> {
    try {
      const statement = await prisma.statement.findFirst({
        where: { account: { employeeId } },
        orderBy: { periodEnd: 'desc' }
      });

      if (!statement || !statement.pdfUrl) {
        await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_NOT_FOUND);
        return;
      }

      const caption = WHATSAPP_COPYS.PDF_SENDING
        .replace('{{periodEnd}}', formatDate(statement.periodEnd));

      await this.whatsappClient.sendDocument(
        phoneNumber,
        statement.pdfUrl,
        `extracto-${statement.periodEnd.toISOString().split('T')[0]}.pdf`,
        caption
      );

    } catch (error) {
      logger.error(`Error sending PDF to ${phoneNumber}:`, error);
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
    }
  }

  private async startDispute(phoneNumber: string, employeeId: string): Promise<void> {
    // Guardar estado temporal de disputa en memoria (simple, por teléfono)
    ConversationFlowTempState.setDisputeAwaitingText(phoneNumber, { employeeId });
    await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.DISPUTE_REQUEST);
  }

  private async handleDispute(phoneNumber: string, messageText: string, data: any): Promise<void> {
    try {
      // Si no hay estado temporal (usuario escribió 'disputar' y luego texto fuera de flujo), intentar recuperar
      const pending = ConversationFlowTempState.getDisputeAwaitingText(phoneNumber) || { employeeId: data?.employeeId };
      if (!pending?.employeeId) {
        await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
        return;
      }
      // Crear ticket de disputa
      const ticket = await prisma.ticket.create({
        data: {
          employeeId: pending.employeeId,
          topic: TicketTopic.DISPUTA,
          lastMessage: messageText
        }
      });

      const confirmText = WHATSAPP_COPYS.DISPUTE_CONFIRMED
        .replace('{{ticketId}}', ticket.id);

      await this.whatsappClient.sendText(phoneNumber, confirmText);
      ConversationFlowTempState.clearDisputeAwaitingText(phoneNumber);

    } catch (error) {
      logger.error(`Error creating dispute ticket for ${phoneNumber}:`, error);
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
    }
  }

  private async handoverToHR(phoneNumber: string, employeeId: string): Promise<void> {
    try {
      // Crear ticket para RR. HH.
      const ticket = await prisma.ticket.create({
        data: {
          employeeId,
          topic: TicketTopic.CONSULTA,
          status: 'DERIVADO_RRHH'
        }
      });

      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.HANDOVER_MESSAGE);

    } catch (error) {
      logger.error(`Error creating HR ticket for ${phoneNumber}:`, error);
      await this.whatsappClient.sendText(phoneNumber, WHATSAPP_COPYS.ERROR_GENERAL);
    }
  }
}

// Estado temporal en memoria (por simplicidad). En producción conviene Redis/DB.
const ConversationFlowTempState = {
  disputeAwaitingByPhone: new Map<string, { employeeId: string }>(),
  setDisputeAwaitingText(phone: string, data: { employeeId: string }) {
    this.disputeAwaitingByPhone.set(phone, data);
  },
  getDisputeAwaitingText(phone: string) {
    return this.disputeAwaitingByPhone.get(phone);
  },
  clearDisputeAwaitingText(phone: string) {
    this.disputeAwaitingByPhone.delete(phone);
  }
};
