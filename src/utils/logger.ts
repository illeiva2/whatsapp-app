import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-accounts' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Helper para anonimizar datos sensibles en logs
export const sanitizeForLog = (data: any): any => {
  if (typeof data === 'string') {
    // Anonimizar DNI (mantener últimos 3 dígitos)
    if (/^\d{7,8}$/.test(data)) {
      return `***${data.slice(-3)}`;
    }
    // Anonimizar teléfonos (mantener últimos 4 dígitos)
    if (/^\+?\d{10,15}$/.test(data)) {
      return `***${data.slice(-4)}`;
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForLog);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('dni') || key.toLowerCase().includes('phone')) {
        sanitized[key] = sanitizeForLog(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return data;
};
