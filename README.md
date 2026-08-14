# busca-cita-andalucia

Vigila el endpoint `calendarioServicio` del portal de citas previas de la Junta de Andalucía y
notifica por Mac, iPhone (ntfy) y WhatsApp cuando aparece un hueco libre en un rango de fechas.

## Cómo funciona

1. Cada ciclo construye una consulta al endpoint:
   `https://www.juntadeandalucia.es/justicia/citaprevia/cita/calendarioServicio?idServicio=180&fecha=...&numSolicitantesCalendario=1&buscarPrimerHuecoLibre=true&idCliente=4`
2. Rota el parámetro `fecha` entre las fechas objetivo (`FECHA_DESDE`..`FECHA_HASTA`).
3. Analiza la respuesta JSON de forma segura frente a `null`:
   - `calendario`, `dias`, `franjas` o `huecosLibres` ausentes/nulos se tratan como "sin citas".
4. Si algún día del rango tiene `huecosLibres > 0`, notifica una vez por hueco (fecha+hora)
   por todos los canales y sigue vigilando.
5. Si no hay huecos, espera el intervalo configurado y vuelve a intentar.

## Instalación

```bash
cd busca-cita-andalucia
npm install
cp .env.example .env
```

Configura en `.env`:

- `FECHA_DESDE` / `FECHA_HASTA`: rango a vigilar (ej. 2026-09-16 / 2026-09-18).
- `NTFY_TOPIC_URL`: tu topic de ntfy para el iPhone (opcional).
- `TWILIO_*`: credenciales para WhatsApp y llamada (opcional).

## Ejecución

```bash
./run.sh
```

O sin `caffeinate`:

```bash
npm start
```

## Notificaciones

- **Mac**: notificación del sistema + aviso sonoro (siempre).
- **iPhone**: vía ntfy (requiere `NTFY_TOPIC_URL` y la app ntfy).
- **WhatsApp y llamada**: vía Twilio (requiere credenciales). Si falla un canal, el resto sigue.
