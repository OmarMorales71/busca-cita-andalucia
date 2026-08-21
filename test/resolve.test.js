import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalize,
  parseOfficeOptions,
  findByName,
  resolveServiceId,
  ResolutionError
} from '../src/resolve.js';

const SAMPLE_HTML = `
<html><body>
<select title="Oficinas" name="chk|idOficina|combo|x|x|true" id="comboOficinas" tabindex="10" class="combo">
  <option value="">--- Seleccionar ---</option>
  <option value="21" tieneNivelesServicio="false">REGISTRO CIVIL DE GRANADA</option>
  <option value="15" tieneNivelesServicio="false">REGISTRO CIVIL EXCLUSIVO DE MÁLAGA</option>
  <option value="25" tieneNivelesServicio="false">REGISTRO CIVIL EXCLUSIVO N.º 1 DE SEVILLA</option>
</select>
</body></html>`;

const SAMPLE_SERVICES = {
  servicios: [
    { idServicio: 180, auxServicio: 'JURAS DE NACIONALIDAD' },
    { idServicio: 157, auxServicio: 'EXPEDIENTE DE NACIONALIDAD ' },
    { idServicio: 156, auxServicio: 'FE DE VIDA Y ESTADO CIVIL' }
  ],
  codigocorrecto: 0,
  label: 'Tr&aacute;mite'
};

test('normalize quita tildes, mayúsculas y espacios extra', () => {
  assert.equal(normalize('REGISTRO CIVIL DE GRANADA'), 'registro civil de granada');
  assert.equal(normalize('  MÁLAGA '), 'malaga');
  assert.equal(normalize('JURAS   DE  NACIONALIDAD'), 'juras de nacionalidad');
});

test('parseOfficeOptions extrae id y nombre del select', () => {
  const offices = parseOfficeOptions(SAMPLE_HTML);
  assert.deepEqual(offices, [
    { id: '21', nombre: 'REGISTRO CIVIL DE GRANADA' },
    { id: '15', nombre: 'REGISTRO CIVIL EXCLUSIVO DE MÁLAGA' },
    { id: '25', nombre: 'REGISTRO CIVIL EXCLUSIVO N.º 1 DE SEVILLA' }
  ]);
});

test('parseOfficeOptions devuelve [] sin select', () => {
  assert.deepEqual(parseOfficeOptions('<html>sin combo</html>'), []);
});

test('findByName encuentra por match exacto ignorando tildes', () => {
  const offices = parseOfficeOptions(SAMPLE_HTML);
  assert.equal(findByName(offices, 'registro civil de granada', 'oficina').id, '21');
});

test('findByName encuentra por substring único', () => {
  const services = SAMPLE_SERVICES.servicios.map((s) => ({ id: String(s.idServicio), nombre: s.auxServicio }));
  assert.equal(findByName(services, 'juras', 'servicio').id, '180');
});

test('findByName lanza error listando opciones si no hay match', () => {
  const offices = parseOfficeOptions(SAMPLE_HTML);
  assert.throws(
    () => findByName(offices, 'vigo', 'oficina'),
    (err) => err instanceof ResolutionError && /Opciones disponibles/.test(err.message) && /GRANADA/.test(err.message)
  );
});

test('findByName lanza error si el match es ambiguo', () => {
  const services = SAMPLE_SERVICES.servicios.map((s) => ({ id: String(s.idServicio), nombre: s.auxServicio }));
  assert.throws(
    () => findByName(services, 'nacionalidad', 'servicio'),
    (err) => err instanceof ResolutionError && /coincide con varias/.test(err.message)
  );
});

test('resolveServiceId resuelve oficina y servicio vía fetch inyectado', async () => {
  const fakeFetch = async (url) => {
    if (url.includes('/comboServicios')) {
      return { ok: true, json: async () => SAMPLE_SERVICES };
    }
    return { ok: true, text: async () => SAMPLE_HTML };
  };

  const result = await resolveServiceId({
    oficina: 'granada',
    servicio: 'juras de nacionalidad',
    idCliente: '4',
    fetchImpl: fakeFetch
  });

  assert.equal(result.idOficina, '21');
  assert.equal(result.idServicio, '180');
  assert.equal(result.oficinaNombre, 'REGISTRO CIVIL DE GRANADA');
  assert.equal(result.servicioNombre, 'JURAS DE NACIONALIDAD');
});

test('resolveServiceId lanza ResolutionError si la oficina no existe', async () => {
  const fakeFetch = async () => ({ ok: true, text: async () => SAMPLE_HTML });

  await assert.rejects(
    () => resolveServiceId({ oficina: 'zaragoza', servicio: 'juras', idCliente: '4', fetchImpl: fakeFetch }),
    (err) => err instanceof ResolutionError && /No se encontró "zaragoza"/.test(err.message)
  );
});
