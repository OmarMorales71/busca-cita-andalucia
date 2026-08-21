# busca-cita-andalucia

Vigila el portal de citas previas de la Junta de Andalucía
(<https://www.juntadeandalucia.es/justicia/citaprevia/?idCliente=4>) y te avisa en cuanto aparece
un hueco libre en el rango de fechas que elijas. Solo tienes que indicar tu oficina y trámite con
nombres normales ("Registro Civil de Granada", "Juras de nacionalidad") y el programa hace el resto.

> **Importante**: esta herramienta solo busca citas entre las que se ofrecen en el portal indicado
> arriba. No puede reservar por ti ni acceder a trámites que no estén publicados ahí.

## Cómo funciona

1. Le dices qué oficina y qué trámite quieres (por ejemplo "Registro Civil de Granada" y
   "Juras de nacionalidad"). El programa los busca y localiza automáticamente en la web de la Junta.
2. Le dices entre qué fechas quieres la cita.
3. El programa revisa cada pocos minutos si hay huecos libres en esas fechas, dentro de las citas
   que se ofrecen en <https://www.juntadeandalucia.es/justicia/citaprevia/?idCliente=4>.
4. Si aparece un hueco, te avisa en el ordenador y, si lo configuraste, en el móvil (ntfy) o por
   WhatsApp.
5. Si no hay nada, espera un rato y vuelve a revisar, sin que tengas que hacer nada.

## Cómo funciona por dentro (para desarrolladores)

Es una app de línea de comandos escrita en Node.js (ESM) sin dependencias externas salvo
[`dotenv`](https://www.npmjs.com/package/dotenv). Requiere **Node.js 18 o superior**.

Flujo:

1. **Resolución de oficina y servicio.** Al arrancar, lee `OFICINA` y `SERVICIO` y los traduce a
   los IDs que usa el portal: hace un `GET` a la página principal (`/?idCliente=4`) para extraer
   el `idOficina` del `<select id="comboOficinas">`, y después un `GET` a
   `cita/comboServicios?idOficina=...` para obtener el `idServicio` desde el JSON de servicios.
   El matching es tolerante a mayúsculas y tildes, y coincide por fragmento único.
2. **Sondeo.** Entra en un bucle infinito y consulta el endpoint de calendario rotando las fechas
   del rango `FECHA_DESDE`..`FECHA_HASTA`, con un intervalo aleatorio configurable
   (`POLL_MIN_MS`..`POLL_MAX_MS`).
3. **Parseo defensivo.** La respuesta JSON se analiza de forma null-safe: si falta
   `calendario`, `dias`, `franjas` o `huecosLibres`, se interpreta como "sin citas".
4. **Notificación.** Si un día tiene `huecosLibres > 0`, notifica una vez por hueco
   (fecha + hora) por todos los canales configurados y, si el hueco reaparece tras un intervalo,
   envía recordatorios. Los canales son independientes: si uno falla, los demás siguen.

Qué debes esperar de la herramienta:

- **Te avisa, no reserva.** En cuanto detecta un hueco (con una latencia de hasta el intervalo de
  sondeo, ~45-90 s) te envía la notificación, pero **es tu responsabilidad entrar al sitio y
  reservar lo antes posible**. Los huecos de cita previa suelen agotarse en segundos.
- Sigue vigilando después de notificar, por si liberas el hueco o aparece otro.
- Si la oficina o el servicio que escribiste no existe (o coincide con varios), se detiene al
  arrancar con un mensaje que lista las opciones disponibles.

## Requisitos

- [Node.js](https://nodejs.org/) **18 o superior**.

## Instalación

```bash
cd busca-cita-andalucia
npm install
cp .env.example .env
```

## Configuración mínima (lo mínimo para correr)

Edita el archivo `.env` que acabas de crear. Con estas cuatro líneas ya funciona (las
notificaciones del ordenador salen solas en macOS):

```env
OFICINA=Registro Civil de Granada
SERVICIO=Juras de nacionalidad
FECHA_DESDE=2026-09-16
FECHA_HASTA=2026-09-18
```

- `OFICINA` y `SERVICIO`: nombres en lenguaje humano. No importan las mayúsculas ni las tildes, y
  un fragmento vale si es único (por ejemplo `juras` en lugar del nombre completo).
- `FECHA_DESDE` / `FECHA_HASTA`: rango de fechas a vigilar (inclusive), formato `YYYY-MM-DD`.

El resto de variables son opcionales (ntfy, Twilio, intervalos). Si un nombre no existe o coincide
con varios, el programa se detiene y te muestra la lista de opciones disponibles.

## Ejecutar

### macOS

```bash
npm install
cp .env.example .env   # edita .env con tus datos
./run.sh               # mantiene el equipo despierto mientras vigila
```

También puedes usar `npm start` sin mantener el equipo despierto.

### Linux

```bash
npm install
cp .env.example .env   # edita .env con tus datos
npm start
```

> En Linux la notificación de escritorio aún no está implementada; configura ntfy o Twilio (abajo).

### Windows

```powershell
npm install
copy .env.example .env   # edita .env con tus datos
npm start
```

> En Windows la notificación de escritorio aún no está implementada; configura ntfy o Twilio (abajo).

## Notificaciones

Puedes recibir los avisos por varios canales a la vez. Si uno falla, los demás siguen funcionando.

- **Ordenador (por defecto)**: notificación del sistema + aviso sonoro. Solo está implementada en
  **macOS**.
- **ntfy** (recomendado, el más fácil de configurar): envía el aviso al móvil con la app
  [ntfy](https://ntfy.sh/). Solo tienes que crear un *topic* y poner su URL en `NTFY_TOPIC_URL`.
  Más info: <https://ntfy.sh/> y <https://docs.ntfy.sh/>.
- **WhatsApp vía Twilio**: requiere una cuenta de Twilio y credenciales
  (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, etc.). Guía oficial:
  <https://www.twilio.com/docs/whatsapp/quickstart>.

> **Windows y Linux**: la notificación de escritorio no está implementada todavía. En esos casos
> configura al menos **ntfy** o **Twilio** para no perderte los avisos.

## Tests

```bash
npm test
```

Verifica la resolución de oficina/servicio, el parser de HTML, el matching tolerante a tildes y los
casos de error (oficina inexistente, servicio ambiguo), usando un `fetch` falso.

## Estructura del proyecto

```
busca-cita-andalucia/
├── src/
│   ├── index.js      # Punto de entrada: bucle de sondeo y orquestación
│   ├── config.js     # Carga de .env y construcción de URLs
│   ├── resolve.js    # Resolución de nombres → IDs (oficina y servicio)
│   ├── api.js        # Consulta del calendario y extracción de huecos libres
│   └── notify.js     # Canales de notificación (ordenador, ntfy, Twilio)
├── test/
│   └── resolve.test.js  # Tests con node --test
├── .env.example      # Plantilla de configuración
├── run.sh            # Script de arranque para macOS
└── package.json      # Scripts (start, test, check) y dependencias
```
