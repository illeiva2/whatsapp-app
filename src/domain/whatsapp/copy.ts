// Textos y mensajes para WhatsApp Business en español (Argentina)

export const WHATSAPP_COPYS = {
  // Saludo y identificación
  GREETING_NEW: "¡Hola! Soy el asistente de RR. HH. de {{companyName}}. Para informarte tu cuenta corriente, necesito confirmar tus datos. Escribí tu DNI (solo números).",
  
  CONFIRM_IDENTITY: "Gracias. ¿Tu nombre completo es {{fullName}}? (DNI *{{dniLast3}})",
  CONFIRM_YES: "Sí, soy yo",
  CONFIRM_NO: "No soy yo",
  
  IDENTITY_CONFIRMED: "¡Perfecto! Ya estás registrado. Ahora podés consultar tu cuenta corriente.",
  IDENTITY_DENIED: "Por favor, contactá a RR. HH. para verificar tus datos.",
  
  // Menú principal
  MAIN_MENU_TITLE: "Tu cuenta corriente",
  MAIN_MENU_BODY: "Elegí una opción 👇",
  
  MENU_OPTIONS: {
    SUMMARY: "Ver resumen",
    DETAIL: "Detalle por categoría", 
    DISPUTE: "Disputar un cargo",
    HANDOVER: "Hablar con RR. HH."
  },
  
  // Resumen de cuenta
  SUMMARY_HEADER: "Resumen de tu cuenta",
  SUMMARY_LAST_CLOSING: "• Último cierre: {{lastClosingDate}} – Saldo cierre: {{closingBalance}}",
  SUMMARY_OPEN_PERIOD: "• Período abierto: {{periodStart}} → hoy",
  SUMMARY_TOTALS: "• Totales: Panadería {{pan}}, Carnicería {{car}}, Proveedores {{prov}}, Adelantos {{adel}}",
  SUMMARY_CURRENT: "Saldo actual estimado: {{currentBalance}}",
  
  // Detalle por categoría
  CATEGORY_SELECT: "Elegí la categoría que querés ver:",
  CATEGORY_OPTIONS: {
    PANADERIA: "Panadería",
    CARNICERIA: "Carnicería", 
    PROVEEDORES: "Proveedores",
    ADELANTO: "Adelantos"
  },
  
  CATEGORY_DETAIL_HEADER: "Movimientos de {{category}}:",
  CATEGORY_DETAIL_ITEM: "{{date}} – {{desc}} – ${{amount}}",
  CATEGORY_DETAIL_TOTAL: "Total {{category}}: ${{total}}",
  
  // PDF
  PDF_SENDING: "Te envío el extracto del último cierre ({{periodEnd}}).",
  
  // Disputa
  DISPUTE_REQUEST: "Contame brevemente qué movimiento querés disputar (fecha, importe, motivo). Lo derivamos a RR. HH. y te respondemos acá.",
  DISPUTE_CONFIRMED: "✅ Abrimos el ticket #{{ticketId}}. Te vamos a contactar. Si necesitás, escribí 'hablar' para hablar directamente con RR. HH.",
  
  // Handover a RR. HH.
  HANDOVER_MESSAGE: "Te estamos derivando con RR. HH.. El asistente deja de responder hasta que el caso se cierre. ¡Gracias!",
  
  // Notificaciones proactivas (templates)
  TEMPLATES: {
    CUENTA_LISTO: "Hola {{1}} 👋. Tu cuenta corriente del período {{2}}–{{3}} ya está lista. ¿Querés ver el resumen o recibir el PDF?",
    RECORDATORIO_DATOS: "Necesitamos confirmar tus datos para poder informarte tu cuenta corriente."
  },
  
  // Errores
  ERROR_GENERAL: "Ocurrió un error. Por favor, intentá de nuevo o contactá a RR. HH.",
  ERROR_NOT_FOUND: "No se encontró información. Verificá que estés registrado o contactá a RR. HH.",
  ERROR_INVALID_DNI: "El DNI debe tener solo números. Intentá de nuevo.",
  ERROR_INVALID_OPTION: "Opción no válida. Elegí una de las opciones disponibles.",
  ERROR_ALREADY_LINKED: "Este empleado ya está vinculado a otro número de WhatsApp. Contactá a RR. HH. para verificar tu acceso.",
  
  // Estados de conversación
  CONVERSATION_STATES: {
    NEW_OR_UNIDENTIFIED: "NEW_OR_UNIDENTIFIED",
    MAIN_MENU: "MAIN_MENU", 
    SUMMARY: "SUMMARY",
    DETAIL_BY_CATEGORY: "DETAIL_BY_CATEGORY",
    SEND_STATEMENT_PDF: "SEND_STATEMENT_PDF",
    DISPUTE_CHARGE: "DISPUTE_CHARGE",
    HANDOVER_TO_HR: "HANDOVER_TO_HR"
  }
} as const;

// Helper para formatear moneda argentina
export const formatCurrency = (amountCents: number): string => {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(amount);
};

// Helper para formatear fecha argentina
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

// Helper para anonimizar DNI en logs
export const anonymizeDni = (dni: string): string => {
  if (dni.length < 3) return dni;
  return `***${dni.slice(-3)}`;
};
