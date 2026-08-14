import { buildUrl, config } from './config.js';

/**
 * Lista de fechas dentro del rango [desde, hasta], en orden.
 * Devuelve null si el rango es inválido.
 */
export function targetDates(desde = config.fechaDesde, hasta = config.fechaHasta) {
  const start = new Date(`${desde}T00:00:00`);
  const end = new Date(`${hasta}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Llama al endpoint calendarioServicio y devuelve los huecos libres
 * que caen dentro del rango objetivo.
 *
 * Null-safe: si falta cualquier nivel (calendario, dias, franjas,
 * huecosLibres) se interpreta como "sin citas para esa fecha".
 *
 * Devuelve: [{ fecha, horaInicio, horaFin, huecosLibres }]
 */
export async function fetchHuecosLibres(fecha) {
  const response = await fetch(buildUrl(fecha), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  console.log(`[${new Date().toISOString()}] Respuesta del servicio: ${JSON.stringify(data)}`);
  const wanted = new Set(targetDates() ?? []);
  const found = [];

  const dias = data?.calendario?.dias;
  if (!Array.isArray(dias)) return found;

  for (const dia of dias) {
    if (!dia || typeof dia.fecha !== 'string' || !wanted.has(dia.fecha)) continue;
    const franjas = dia.franjas;
    if (!Array.isArray(franjas)) continue; // franjas: null -> sin citas ese día
    for (const franja of franjas) {
      const libres = franja?.huecosLibres;
      if (typeof libres === 'number' && libres > 0) {
        found.push({
          fecha: dia.fecha,
          horaInicio: franja?.horaInicio ?? '?',
          horaFin: franja?.horaFin ?? '?',
          huecosLibres: libres
        });
      }
    }
  }
  return found;
}
