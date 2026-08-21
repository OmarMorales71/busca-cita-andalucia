import { config } from './config.js';
import { fetchHuecosLibres, targetDates } from './api.js';
import { notifyAll } from './notify.js';
import { resolveServiceId } from './resolve.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min, max) => Math.floor(min + Math.random() * (max - min + 1));


const wanted = targetDates();
if (!wanted) {
  console.error('Rango de fechas inválido en .env (FECHA_DESDE / FECHA_HASTA).');
  process.exit(1);
}

// Ciclo sobre las fechas objetivo para el parámetro `fecha` de la consulta.
function nextQueryDate(index) {
  return wanted[index % wanted.length];
}

// Resuelve el idServicio: OFICINA+SERVICIO vía HTTP, o ID_SERVICIO como atajo de desarrollador.
async function resolveTargetService() {
  if (config.oficina && config.servicio) {
    const resolved = await resolveServiceId({
      oficina: config.oficina,
      servicio: config.servicio,
      idCliente: config.idCliente
    });
    console.log(`Oficina: ${resolved.oficinaNombre} (${resolved.idOficina})`);
    console.log(`Servicio: ${resolved.servicioNombre} (${resolved.idServicio})`);
    return resolved.idServicio;
  }

  if (config.idServicio) {
    console.log(`Usando ID_SERVICIO directo: ${config.idServicio}`);
    return config.idServicio;
  }

  throw new Error(
    'Falta configuración: define OFICINA y SERVICIO en .env (ej. OFICINA="Granada", SERVICIO="Juras de nacionalidad").\n' +
      'Como alternativa de desarrollador puedes definir ID_SERVICIO directamente.'
  );
}

async function main() {
  const idServicio = await resolveTargetService();
  const notifiedAt = new Map();
  let cycle = 0;

  console.log(`Vigilando huecos libres en ${wanted.join(', ')} (servicio ${idServicio}).`);
  console.log(`Intervalo ${Math.round(config.pollMinMs / 1000)}-${Math.round(config.pollMaxMs / 1000)}s. Ctrl+C para detener.`);

  while (true) {
    try {
      const now = Date.now();
      cleanupExpired(notifiedAt, now);

      const fecha = nextQueryDate(cycle);
      cycle += 1;
      const huecos = await fetchHuecosLibres(fecha, idServicio);
      const nuevos = huecos.filter((h) => {
        const last = notifiedAt.get(`${h.fecha}|${h.horaInicio}`) ?? 0;
        return now - last >= config.reminderInterval;
      });

      if (nuevos.length > 0) {
        for (const h of nuevos) notifiedAt.set(`${h.fecha}|${h.horaInicio}`, Date.now());
        const resumen = nuevos
          .map((h) => `${h.fecha} ${h.horaInicio.slice(0, 5)} (${h.huecosLibres} hueco${h.huecosLibres > 1 ? 's' : ''})`)
          .join('\n');
        const mensaje = `Huecos libres en rango:\n${resumen}\nCorre a por la cita: https://www.juntadeandalucia.es/justicia/citaprevia/?idCliente=${config.idCliente}`;
        console.log(`[${new Date().toISOString()}] CITA DISPONIBLE:\n${resumen}`);
        await notifyAll('Hueco libre en cita previa', mensaje);
      } else if (huecos.length > 0) {
        const mins = Math.round(config.reminderInterval / 60000);
        console.log(`[${new Date().toISOString()}] Hay huecos disponibles (ya notificados). Próximo recordatorio en ~${mins} min. Sigo vigilando.`);
      } else {
        const pollSecs = `${Math.round(config.pollMinMs / 1000)}-${Math.round(config.pollMaxMs / 1000)}s`;
        console.log(`[${new Date().toISOString()}] ${fecha}: sin huecos libres. Sigo buscando en ${wanted.length} fechas (próxima consulta en ${pollSecs}).`);
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Error: ${error.message}`);
    }

    await sleep(randomBetween(config.pollMinMs, config.pollMaxMs));
  }
}

// Elimina registros de notificación con más de 24 horas.
function cleanupExpired(notifiedAt, now) {
  for (const [key, timestamp] of notifiedAt) {
    if (now - timestamp >= config.notificationTtl) notifiedAt.delete(key);
  }
}

main().catch((error) => {
  console.error(`\n${error?.message ?? error}`);
  process.exitCode = 1;
});
