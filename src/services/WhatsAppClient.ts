import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface WhatsAppButton {
  id: string;
  title: string;
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
      buttons?: WhatsAppButton[];
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

  async sendText(to: string, body: string): Promise<boolean> {
    try {
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body }
      };

      await this.client.post('', message);
      logger.info(`WhatsApp text sent to ${to}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send WhatsApp text to ${to}:`, error);
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
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: { buttons }
        }
      };

      if (header) {
        message.interactive!.header = { type: 'text', text: header };
      }

      if (footer) {
        message.interactive!.footer = { text: footer };
      }

      await this.client.post('', message);
      logger.info(`WhatsApp buttons sent to ${to}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send WhatsApp buttons to ${to}:`, error);
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
      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        to,
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
      logger.info(`WhatsApp list sent to ${to}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send WhatsApp list to ${to}:`, error);
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
      const message: WhatsAppDocument = {
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: {
          link: url,
          filename,
          caption: caption || undefined
        }
      };

      await this.client.post('', message);
      logger.info(`WhatsApp document sent to ${to}: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send WhatsApp document to ${to}:`, error);
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
      const message = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components
        }
      };

      await this.client.post('', message);
      logger.info(`WhatsApp template sent to ${to}: ${templateName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send WhatsApp template to ${to}:`, error);
      return false;
    }
  }
}
