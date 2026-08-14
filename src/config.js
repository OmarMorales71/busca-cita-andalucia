import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = (name, fallback = '') => process.env[name] ?? fallback;
const int = (name, fallback) => {
  const value = Number(env(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
};

export const config = {
  idServicio: env('ID_SERVICIO', '180'),
  idCliente: env('ID_CLIENTE', '4'),
  numSolicitantes: env('NUM_SOLICITANTES', '1'),
  fechaDesde: env('FECHA_DESDE', '2026-09-16'),
  fechaHasta: env('FECHA_HASTA', '2026-09-18'),
  pollMinMs: int('POLL_MIN_MS', 45000),
  pollMaxMs: int('POLL_MAX_MS', 90000),
  ntfyTopicUrl: env('NTFY_TOPIC_URL'),
  reminderInterval: int('REMINDER_INTERVAL_MINUTES', 12) * 60 * 1000,
  notificationTtl: int('NOTIFICATION_TTL_HOURS', 24) * 60 * 60 * 1000,
  twilio: {
    sid: env('TWILIO_ACCOUNT_SID'),
    token: env('TWILIO_AUTH_TOKEN'),
    whatsappFrom: env('TWILIO_WHATSAPP_FROM'),
    whatsappTo: env('WHATSAPP_TO'),
    voiceFrom: env('TWILIO_VOICE_FROM'),
    voiceTo: env('VOICE_TO'),
    voiceTwimlUrl: env('TWILIO_VOICE_TWIML_URL')
  }
};

export function buildUrl(fecha) {
  const params = new URLSearchParams({
    idServicio: config.idServicio,
    fecha,
    numSolicitantesCalendario: config.numSolicitantes,
    buscarPrimerHuecoLibre: 'true',
    idCliente: config.idCliente
  });
  return `https://www.juntadeandalucia.es/justicia/citaprevia/cita/calendarioServicio?${params}`;
}
