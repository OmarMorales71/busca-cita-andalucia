const BASE_URL = 'https://www.juntadeandalucia.es/justicia/citaprevia';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/html, */*'
};

const TIMEOUT_MS = 60000;

/**
 * Error de resolución dirigido al usuario final: su mensaje es legible
 * y puede incluir la lista de opciones disponibles.
 */
export class ResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResolutionError';
  }
}

/**
 * Normaliza texto para comparar ignorando mayúsculas, tildes y espacios
 * extra. Ej.: "JURAS DE NACIONALIDAD" === "juras de nacionalidad".
 */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae las oficinas del HTML del portal: [{ id, nombre }].
 * Devuelve [] si no encuentra el select "comboOficinas".
 */
export function parseOfficeOptions(html) {
  const select = html.match(/<select[^>]*id=["']comboOficinas["'][\s\S]*?<\/select>/i);
  if (!select) return [];

  const options = [];
  const regex = /<option\s+value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi;
  let match;
  while ((match = regex.exec(select[0])) !== null) {
    const id = match[1].trim();
    const nombre = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (id && nombre) options.push({ id, nombre });
  }
  return options;
}

function listOptions(items) {
  return items.map((item) => `  - ${item.nombre} (${item.id})`).join('\n');
}

/**
 * Busca un elemento por nombre (tolerante a tildes/mayúsculas):
 * 1. Coincidencia exacta normalizada.
 * 2. Substring único.
 * Lanza ResolutionError con las opciones si no hay match o hay varios.
 */
export function findByName(items, query, kind) {
  const q = normalize(query);
  if (!q) throw new ResolutionError(`Debes indicar el nombre de ${kind === 'oficina' ? 'una oficina' : 'un servicio'}.`);

  const exact = items.filter((item) => normalize(item.nombre) === q);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new ResolutionError(`"${query}" coincide con varias opciones de ${kind}:\n${listOptions(exact)}\nSé más específico.`);
  }

  const matches = items.filter((item) => normalize(item.nombre).includes(q));
  if (matches.length === 0) {
    throw new ResolutionError(`No se encontró "${query}" entre las opciones de ${kind}.\nOpciones disponibles:\n${listOptions(items)}`);
  }
  if (matches.length > 1) {
    throw new ResolutionError(`"${query}" coincide con varias opciones de ${kind}:\n${listOptions(matches)}\nSé más específico.`);
  }
  return matches[0];
}

async function fetchHtml(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} al consultar ${url}`);
  return response.text();
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} al consultar ${url}`);
  return response.json();
}

/**
 * Obtiene la lista de oficinas desde la página principal.
 * fetchImpl es inyectable para tests.
 */
export async function fetchOffices({ fetchImpl = fetch, idCliente } = {}) {
  const url = `${BASE_URL}/?idCliente=${idCliente}`;
  const html = await fetchHtml(url, fetchImpl);
  return parseOfficeOptions(html);
}

/**
 * Obtiene los servicios de una oficina: [{ id, nombre }].
 */
export async function fetchServices(idOficina, { fetchImpl = fetch } = {}) {
  const url = `${BASE_URL}/cita/comboServicios?idOficina=${idOficina}&codServicio=&idioma=es`;
  const data = await fetchJson(url, fetchImpl);
  const servicios = Array.isArray(data?.servicios) ? data.servicios : [];
  return servicios
    .map((s) => ({ id: String(s.idServicio), nombre: String(s.auxServicio ?? '').trim() }))
    .filter((s) => s.id && s.nombre);
}

/**
 * Resuelve los IDs a partir de nombres en lenguaje humano.
 * Devuelve { idOficina, idServicio, oficinaNombre, servicioNombre }.
 */
export async function resolveServiceId({ oficina, servicio, idCliente, fetchImpl = fetch }) {
  const offices = await fetchOffices({ fetchImpl, idCliente });
  if (offices.length === 0) {
    throw new ResolutionError('No se pudo obtener la lista de oficinas del portal (el sitio puede haber cambiado).');
  }

  const office = findByName(offices, oficina, 'oficina');

  const services = await fetchServices(office.id, { fetchImpl });
  if (services.length === 0) {
    throw new ResolutionError(`No se pudo obtener la lista de servicios de la oficina "${office.nombre}".`);
  }

  const svc = findByName(services, servicio, 'servicio');

  return {
    idOficina: office.id,
    idServicio: svc.id,
    oficinaNombre: office.nombre,
    servicioNombre: svc.nombre
  };
}
