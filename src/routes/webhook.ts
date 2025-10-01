import { Router, Request, Response } from 'express';
import { ConversationFlow } from '../services/ConversationFlow';
import { logger } from '../utils/logger';
import { sanitizeForLog } from '../utils/logger';

const router = Router();
const conversationFlow = new ConversationFlow();

// Verificación del webhook (GET)
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// Manejo de mensajes entrantes (POST)
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Verificar que es un webhook de WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      logger.warn('Invalid webhook object:', body.object);
      return res.status(400).send('Invalid webhook object');
    }

    // Procesar cada entrada
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              await processMessages(change.value);
            }
          }
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return res.status(500).send('Internal Server Error');
  }
});

async function processMessages(value: any): Promise<void> {
  try {
    const messages = value.messages;
    const contacts = value.contacts;

    if (!messages || !Array.isArray(messages)) {
      return;
    }

    for (const message of messages) {
      await processMessage(message, contacts);
    }
  } catch (error) {
    logger.error('Error processing messages:', error);
  }
}

async function processMessage(message: any, contacts: any[]): Promise<void> {
  try {
    const from = message.from;
    const messageType = message.type;
    const timestamp = message.timestamp;

    // Buscar contacto
    const contact = contacts?.find(c => c.wa_id === from);
    const phoneNumber = contact?.wa_id || from;

    logger.info(`Processing message from ${phoneNumber}, type: ${messageType}`);

    // Procesar según el tipo de mensaje
    switch (messageType) {
      case 'text':
        await handleTextMessage(phoneNumber, message.text.body, timestamp);
        break;

      case 'interactive':
        await handleInteractiveMessage(phoneNumber, message.interactive, timestamp);
        break;

      case 'button':
        await handleButtonMessage(phoneNumber, message.button, timestamp);
        break;

      default:
        logger.info(`Unsupported message type: ${messageType}`);
        break;
    }
  } catch (error) {
    logger.error('Error processing individual message:', error);
  }
}

async function handleTextMessage(phoneNumber: string, text: string, timestamp: string): Promise<void> {
  try {
    logger.info(`Text message from ${phoneNumber}: ${sanitizeForLog(text)}`);
    await conversationFlow.handleMessage(phoneNumber, text, 'text');
  } catch (error) {
    logger.error(`Error handling text message from ${phoneNumber}:`, error);
  }
}

async function handleInteractiveMessage(phoneNumber: string, interactive: any, timestamp: string): Promise<void> {
  try {
    let messageText = '';

    if (interactive.type === 'button_reply') {
      messageText = interactive.button_reply.id;
    } else if (interactive.type === 'list_reply') {
      messageText = interactive.list_reply.id;
    }

    logger.info(`Interactive message from ${phoneNumber}: ${messageText}`);
    await conversationFlow.handleMessage(phoneNumber, messageText, 'interactive');
  } catch (error) {
    logger.error(`Error handling interactive message from ${phoneNumber}:`, error);
  }
}

async function handleButtonMessage(phoneNumber: string, button: any, timestamp: string): Promise<void> {
  try {
    const messageText = button.payload || button.text;
    logger.info(`Button message from ${phoneNumber}: ${messageText}`);
    await conversationFlow.handleMessage(phoneNumber, messageText, 'button');
  } catch (error) {
    logger.error(`Error handling button message from ${phoneNumber}:`, error);
  }
}

export default router;
