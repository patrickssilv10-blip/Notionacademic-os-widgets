/**
 * Progreso del tiempo — Academic OS Widgets
 *
 * Opciones por URL:
 *   ?theme=auto|light|dark          (por defecto: auto → prefers-color-scheme)
 *   ?bg=transparent|solid           (por defecto: transparent)
 *
 * Cada repintado calcula el progreso desde cero con la hora actual y los límites
 * reales del periodo en hora local. El temporizador solo decide cuándo repintar:
 * nunca acumula progreso, así que tras perder el foco, suspender el equipo o
 * recargar, el valor mostrado es siempre el correcto.
 */
import { readOptions, applyAppearance, startSecondTicker } from '../../shared/widget.js';

const options = readOptions({ theme: 'auto', bg: 'transparent' });
applyAppearance(options);

const weekdayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const monthFormat = new Intl.DateTimeFormat('es-ES', { month: 'long' });

/**
 * Límites [inicio, fin) de cada periodo en hora local.
 * Se construyen con campos de calendario (día + 1, mes + 1, año + 1), nunca sumando
 * milisegundos fijos: así un día de 23 o 25 h (cambio de hora), un mes de 28–31 días
 * o un año bisiesto tienen su duración real. Date normaliza los desbordes
 * (p. ej., día 0 → último día del mes anterior).
 */
const PERIODS = {
  day: {
    bounds: (y, m, d) => [new Date(y, m, d), new Date(y, m, d + 1)],
    detail: (now) => weekdayFormat.format(now),
  },
  week: {
    // Semana de lunes a lunes: getDay() devuelve 0 = domingo … 6 = sábado
    bounds: (y, m, d, weekday) => {
      const monday = d - ((weekday + 6) % 7);
      return [new Date(y, m, monday), new Date(y, m, monday + 7)];
    },
    detail: (now) => `sem. ${isoWeek(now)}`,
  },
  month: {
    bounds: (y, m) => [new Date(y, m, 1), new Date(y, m + 1, 1)],
    detail: (now) => monthFormat.format(now),
  },
  year: {
    bounds: (y) => [new Date(y, 0, 1), new Date(y + 1, 0, 1)],
    detail: (now) => String(now.getFullYear()),
  },
};

/** Semana ISO 8601: la semana 1 es la que contiene el primer jueves del año. */
function isoWeek(now) {
  const DAY = 24 * 60 * 60 * 1000;
  const thursday = (date) => {
    const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
    return t;
  };
  const current = thursday(now);
  const first = thursday(new Date(current.getUTCFullYear(), 0, 4));
  return 1 + Math.round((current - first) / (7 * DAY));
}

/** Fracción transcurrida, siempre un número finito entre 0 y 1. */
function elapsedFraction(now, start, end) {
  const fraction = (now - start) / (end - start);
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * Décimas de porcentaje redondeadas hacia abajo (0–1000): nunca se muestra
 * 100 % antes de que el periodo acabe de verdad (99,96 % → 99,9 %).
 */
const tenthsOf = (fraction) => Math.min(1000, Math.floor(fraction * 1000 + 1e-9));

/** Tiempo restante compacto: "3 d 4 h", "5 h 12 min", "8 min". */
function remainingText(ms) {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return 'menos de 1 min';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d >= 10) return `${d} d`;
  if (d >= 1) return h ? `${d} d ${h} h` : `${d} d`;
  if (h >= 1) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

// ---------- Elementos ----------
const items = [...document.querySelectorAll('.tp__item')].map((el) => ({
  period: PERIODS[el.dataset.period],
  int: el.querySelector('.tp__int'),
  dec: el.querySelector('.tp__dec'),
  detail: el.querySelector('.tp__detail'),
  left: el.querySelector('.tp__left'),
  bar: el.querySelector('.tp__bar'),
  fill: el.querySelector('.tp__fill'),
  last: {},
}));

/** Escribe en el DOM solo cuando el valor cambia. */
function update(item, key, value, write) {
  if (item.last[key] === value) return;
  item.last[key] = value;
  write(value);
}

// ---------- Pintado ----------
function render(now) {
  // Una sola lectura de la hora para que los cuatro periodos sean coherentes
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const weekday = now.getDay();

  for (const item of items) {
    const [start, end] = item.period.bounds(y, m, d, weekday);
    const fraction = elapsedFraction(now, start, end);
    const tenths = tenthsOf(fraction);
    const pct = `${Math.floor(tenths / 10)},${tenths % 10}`;
    const remaining = remainingText(end - now);

    update(item, 'int', String(Math.floor(tenths / 10)), (v) => { item.int.textContent = v; });
    update(item, 'dec', `,${tenths % 10}`, (v) => { item.dec.textContent = v; });
    update(item, 'left', `quedan ${remaining}`, (v) => { item.left.textContent = v; });
    update(item, 'detail', item.period.detail(now), (v) => { item.detail.textContent = v; });
    update(item, 'width', `${(fraction * 100).toFixed(2)}%`, (v) => { item.fill.style.width = v; });
    update(item, 'aria', `${pct} % transcurrido, quedan ${remaining}`, (v) => {
      item.bar.setAttribute('aria-valuenow', String(tenths / 10));
      item.bar.setAttribute('aria-valuetext', v);
    });
  }
}

// Único mecanismo de actualización: el ticker compartido (el mismo del reloj).
// Se alinea con cada segundo real, se reprograma desde la hora actual y, al volver
// a la pestaña, repinta al instante.
startSecondTicker(render);
