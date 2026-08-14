import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

/**
 * Envía la notificación por todos los canales configurados.
 * Cada canal es independiente: si uno falla, el resto continúa.
 */
export async function notifyAll(title, message) {
  const jobs = [notifyMac(title, message), notifyNtfy(title, message), notifyWhatsApp(message), notifyCall()];
  const results = await Promise.allSettled(jobs);
  results.forEach((result, i) => {
    if (result.status === 'rejected') console.warn(`Notificación ${i} fallida: ${result.reason?.message ?? result.reason}`);
  });
}

async function notifyMac(title, message) {
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} sound name "Glass"`;
  await execFileAsync('osascript', ['-e', script]);
  await execFileAsync('say', [title]).catch(() => {});
}

async function notifyNtfy(title, message) {
  if (!config.ntfyTopicUrl) return;
  const response = await fetch(config.ntfyTopicUrl, {
    method: 'POST',
    headers: { Title: title, Priority: 'urgent', Tags: 'rotating_light' },
    body: message
  });
  if (!response.ok) throw new Error(`ntfy HTTP ${response.status}`);
}

async function notifyWhatsApp(message) {
  const { sid, token, whatsappFrom, whatsappTo } = config.twilio;
  if (!sid || !token || !whatsappFrom || !whatsappTo) return;
  await twilioPost('/Messages.json', new URLSearchParams({ From: whatsappFrom, To: whatsappTo, Body: message }));
}

async function notifyCall() {
  const { sid, token, voiceFrom, voiceTo, voiceTwimlUrl } = config.twilio;
  if (!sid || !token || !voiceFrom || !voiceTo || !voiceTwimlUrl) return;
  await twilioPost('/Calls.json', new URLSearchParams({ From: voiceFrom, To: voiceTo, Url: voiceTwimlUrl }));
}

async function twilioPost(endpoint, body) {
  const { sid, token } = config.twilio;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error(`Twilio HTTP ${response.status}: ${await response.text()}`);
}
