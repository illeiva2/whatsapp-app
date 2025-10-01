import request from 'supertest';
import app from '@/index';

describe('WhatsApp Webhook', () => {
  describe('GET /webhook/whatsapp', () => {
    it('should verify webhook with correct token', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'test-challenge'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('test-challenge');
    });

    it('should reject webhook with incorrect token', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'test-challenge'
        });

      expect(response.status).toBe(403);
    });

    it('should reject webhook with wrong mode', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'test-challenge'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook/whatsapp', () => {
    it('should process text message', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: '123456789'
                  },
                  contacts: [
                    {
                      profile: {
                        name: 'Juan Perez'
                      },
                      wa_id: '+5491123456789'
                    }
                  ],
                  messages: [
                    {
                      from: '+5491123456789',
                      id: 'wamid.123456789',
                      timestamp: '1640995200',
                      text: {
                        body: 'Hola'
                      },
                      type: 'text'
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    it('should process interactive message', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: '123456789'
                  },
                  contacts: [
                    {
                      profile: {
                        name: 'Juan Perez'
                      },
                      wa_id: '+5491123456789'
                    }
                  ],
                  messages: [
                    {
                      from: '+5491123456789',
                      id: 'wamid.123456789',
                      timestamp: '1640995200',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'MENU_SUMMARY',
                          title: 'Ver resumen'
                        }
                      },
                      type: 'interactive'
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    it('should reject invalid webhook object', async () => {
      const webhookPayload = {
        object: 'invalid_object',
        entry: []
      };

      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload);

      expect(response.status).toBe(400);
    });

    it('should handle empty messages array', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: '123456789'
                  },
                  contacts: [],
                  messages: []
                }
              }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });
  });
});
