import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface WhatsAppButton {
  id: string;
  title: string;
}

// Formato requerido por la API de WhatsApp para botones interactivos
interface WhatsAppInteractiveButtonItem {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'interactive';
  text?: {
    body: string;
  };
  interactive?: {
    type: 'button' | 'list';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      // La API espera botones en formato { type: 'reply', reply: { id, title } }
      buttons?: WhatsAppInteractiveButtonItem[];
      button?: string;
      sections?: WhatsAppListSection[];
    };
  };
}

export interface WhatsAppDocument {
  messaging_product: 'whatsapp';
  to: string;
  type: 'document';
  document: {
    link: string;
    filename: string;
    caption?: string;
  };
}

export class WhatsAppClient {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/v23.0/${this.phoneNumberId}/messages`,
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private normalizePhone(recipient: string): string {
    // Mantener solo dígitos (E.164 sin '+')
    const digitsOnly = (recipient || '').replace(/\D+/g, '');
    return digitsOnly;
  }

  private logAxiosError(action: string, to: string, error: any): void {
    const status = error?.response?.status;
    const err = error?.response?.data?.error;
    const code = err?.code;
    const message = err?.message || error?.message;
    const details = err?.error_data?.details;

    if (code === 100 && typeof message === 'string' && message.includes("Unexpected key \"id\"") ) {
      // Parámetros de botones mal formados (API espera { type: 'reply', reply: { id, title } })
      logger.error(
        `[WA ${action}] 100 Invalid param → Formato de botones inválido. Usa { type: 'reply', reply: { id, title } } en interactive.action.buttons. to=${to}`,
        { status, code, message, details }
      );
    }

    if (code === 131030) {
      // Número no autorizado en entorno de pruebas
      // Mensaje guiado para diagnóstico rápido
      logger.error(
        `[WA ${action}] 131030 Recipient not in allowed list → Agrega el número en Getting Started > Add recipients. to=${to}`,
        { status, code, message, details }
      );
    }

    if (code === 10) {
      // Permisos insuficientes (token o app)
      logger.error(
        `[WA ${action}] 10 Permission error → Revisa: (1) WHATSAPP_TOKEN vigente, (2) que la app tenga whatsapp_business_messaging, (3) WHATSAPP_PHONE_NUMBER_ID correcto, (4) en modo prueba agrega el destinatario en Add recipients. to=${to}`,
        { status, code, message, details }
      );
    }

    logger.error(`[WA ${action}] error sending to ${to}`, { status, code, message, details });
  }

  async sendText(to: string, body: string): Promise<boolean> {
    try {
      const recipient = this.normalizePhone(to);
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body }
      };

      await this.client.post('', message);
      logger.info(`WhatsApp text sent to ${recipient}`);
      return true;
    } catch (error) {
      this.logAxiosError('sendText', to, error);
      return false;
    }
  }

  async sendButtons(
    to: string, 
    body: string, 
    buttons: WhatsAppButton[],
    header?: string,
    footer?: string
  ): Promise<boolean> {
    try {
      const recipient = this.normalizePhone(to);
      // Adaptar botones simples {id, title} al formato esperado por la API
      const apiButtons: WhatsAppInteractiveButtonItem[] = (buttons || []).map(b => ({
        type: 'reply',
        reply: { id: b.id, title: b.title }
      }));
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: { buttons: apiButtons }
        }
      };

      if (header) {
        message.interactive!.header = { type: 'text', text: header };
      }

      if (footer) {
        message.interactive!.footer = { text: footer };
      }

      await this.client.post('', message);
      logger.info(`WhatsApp buttons sent to ${recipient}`);
      return true;
    } catch (error) {
      this.logAxiosError('sendButtons', to, error);
      return false;
    }
  }

  async sendList(
    to: string,
    body: string,
    sections: WhatsAppListSection[],
    header?: string,
    footer?: string
  ): Promise<boolean> {
    try {
      const recipient = this.normalizePhone(to);
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: { sections }
        }
      };

      if (header) {
        message.interactive!.header = { type: 'text', text: header };
      }

      if (footer) {
        message.interactive!.footer = { text: footer };
      }

      await this.client.post('', message);
      logger.info(`WhatsApp list sent to ${recipient}`);
      return true;
    } catch (error) {
      this.logAxiosError('sendList', to, error);
      return false;
    }
  }

  async sendDocument(
    to: string,
    url: string,
    filename: string,
    caption?: string
  ): Promise<boolean> {
    try {
      const recipient = this.normalizePhone(to);
      const message: WhatsAppDocument = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'document',
        document: {
          link: url,
          filename,
          caption: caption || undefined
        }
      };

      await this.client.post('', message);
      logger.info(`WhatsApp document sent to ${recipient}: ${filename}`);
      return true;
    } catch (error) {
      this.logAxiosError('sendDocument', to, error);
      return false;
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'es',
    components?: any[]
  ): Promise<boolean> {
    try {
      const recipient = this.normalizePhone(to);
      const message = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components
        }
      };

      await this.client.post('', message);
      logger.info(`WhatsApp template sent to ${recipient}: ${templateName}`);
      return true;
    } catch (error) {
      this.logAxiosError('sendTemplate', to, error);
      return false;
    }
  }
}
