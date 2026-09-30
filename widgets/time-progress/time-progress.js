/**
 * Progreso del tiempo — Academic OS Widgets
 *
 * Opciones por URL:
 *   ?theme=auto|light|dark          (por defecto: auto → prefers-color-scheme)
 *   ?bg=transparent|solid           (por defecto: transparent)
 *   ?periods=day,week,month,year    (periodos a mostrar; por defecto todos)
 *
 * El porcentaje se calcula en cada actualización a partir de la hora actual y de
 * los límites reales del periodo en la hora local (semana de lunes a lunes).
 * El temporizador solo decide cuándo repintar; nunca acumula progreso.
 */
import { readOptions, applyAppearance, startSecondTicker } from '../../shared/widget.js';

const options = readOptions({
  theme: 'auto',
  bg: 'transparent',
  periods: 'day,week,month,year',
});
applyAppearance(options);

// ---------- Límites de cada periodo: [inicio, fin) en hora local ----------
// Se construyen con el calendario (día + 1, mes + 1…), no sumando milisegundos:
// así los días de 23/25 h por cambio de hora, los meses de 28–31 días y los años
// bisiestos tienen su duración real.
const PERIODS = {
  day: {
    bounds: (n) => [
      new Date(n.getFullYear(), n.getMonth(), n.getDate()),
      new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1),
    ],
    detail: (n) => weekdayFormat.format(n),
  },
  week: {
    bounds: (n) => {
      const sinceMonday = (n.getDay() + 6) % 7; // lunes = 0 … domingo = 6
      const d = n.getDate() - sinceMonday;
      return [
        new Date(n.getFullYear(), n.getMonth(), d),
        new Date(n.getFullYear(), n.getMonth(), d + 7),
      ];
    },
    detail: (n) => `sem. ${isoWeek(n)}`,
  },
  month: {
    bounds: (n) => [
      new Date(n.getFullYear(), n.getMonth(), 1),
      new Date(n.getFullYear(), n.getMonth() + 1, 1),
    ],
    detail: (n) => monthFormat.format(n),
  },
  year: {
    bounds: (n) => [
      new Date(n.getFullYear(), 0, 1),
      new Date(n.getFullYear() + 1, 0, 1),
    ],
    detail: (n) => String(n.getFullYear()),
  },
};

const weekdayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const monthFormat = new Intl.DateTimeFormat('es-ES', { month: 'long' });

/** Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves). */
function isoWeek(date) {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7)); // jueves de esta semana
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  return 1 + Math.round((t - firstThursday) / (7 * 24 * 60 * 60 * 1000));
}

/** Fracción transcurrida, siempre finita y dentro de [0, 1]. */
function fractionOf(now, start, end) {
  const f = (now - start) / (end - start);
  if (!Number.isFinite(f)) return 0;
  return Math.min(1, Math.max(0, f));
}

/**
 * Porcentaje redondeado hacia abajo: nunca muestra 100 % antes de que el periodo
 * termine de verdad (99,96 % se muestra 99,9 %, no 100,0 %).
 */
function percentText(fraction, decimals) {
  const scale = 10 ** decimals;
  const value = Math.floor(fraction * 100 * scale + 1e-9) / scale;
  return `${value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`;
}

/** Tiempo restante compacto: "3 d 4 h", "5 h 12 min", "8 min". */
function leftText(ms) {
  const totalMin = Math.floor(Math.max(0, ms) / 60000);
  if (totalMin < 1) return 'menos de 1 min';
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d >= 10) return `${d} d`;
  if (d >= 1) return h ? `${d} d ${h} h` : `${d} d`;
  if (h >= 1) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

// ---------- Periodos seleccionados ----------
// Si ?periods= no contiene ningún periodo válido, se muestran todos
const requested = options.periods.split(',').map((key) => key.trim()).filter((key) => PERIODS[key]);
const shown = requested.length ? requested : Object.keys(PERIODS);
const root = document.querySelector('.tp');
const items = [];
for (const el of root.querySelectorAll('.tp__item')) {
  const key = el.dataset.period;
  if (!shown.includes(key)) {
    el.remove();
    continue;
  }
  items.push({
    key,
    el,
    detail: el.querySelector('.tp__detail'),
    left: el.querySelector('.tp__left'),
    pct: el.querySelector('.tp__pct'),
    bar: el.querySelector('.tp__bar'),
    fill: el.querySelector('.tp__fill'),
    cache: {},
  });
}

// ---------- Disposición: automática según el tamaño del embed ----------
// Alturas aproximadas de cada periodo (texto + barra) para decidir qué cabe.
const PADDING = 12;
const LINES = { item: 27, gap: 8 };
const ROWS = { item: 15, gap: 3 };
const heightFor = (n, { item, gap }) => n * item + (n - 1) * gap + PADDING;

const view = { decimals: 1, showLeft: false, showDetail: false };
let layoutSize = '';

function applyLayout() {
  const { innerWidth: w, innerHeight: h } = window;
  layoutSize = `${w}x${h}`;
  const lines = w >= 140 && h >= heightFor(items.length, LINES);
  root.dataset.layout = lines ? 'lines' : 'rows';

  view.decimals = w >= 190 ? 1 : 0;
  view.showLeft = lines ? w >= 230 : w >= 400;
  view.showDetail = lines && w >= 330;
  root.dataset.decimals = String(view.decimals);
  root.toggleAttribute('data-left', view.showLeft);

  // En embeds muy bajos se muestran solo los periodos que caben (en orden)
  const capacity = lines
    ? items.length
    : Math.max(1, Math.floor((h - PADDING + ROWS.gap) / (ROWS.item + ROWS.gap)));
  items.forEach((item, i) => { item.el.hidden = i >= capacity; });

  render(new Date());
}

// ---------- Pintado ----------
const setText = (el, cache, key, text) => {
  if (cache[key] === text) return;
  cache[key] = text;
  el.textContent = text;
};

function render(now) {
  for (const item of items) {
    const period = PERIODS[item.key];
    const [start, end] = period.bounds(now);
    const fraction = fractionOf(now, start, end);
    const pct = percentText(fraction, view.decimals);
    const left = leftText(end - now);
    const { cache } = item;

    setText(item.pct, cache, 'pct', pct);
    setText(item.left, cache, 'left', view.showLeft ? `quedan ${left}` : '');
    setText(item.detail, cache, 'detail', view.showDetail ? period.detail(now) : '');

    const width = `${(fraction * 100).toFixed(2)}%`;
    if (cache.width !== width) {
      cache.width = width;
      item.fill.style.width = width;
    }

    const valueText = `${percentText(fraction, 1)} transcurrido, quedan ${left}`;
    if (cache.valueText !== valueText) {
      cache.valueText = valueText;
      item.bar.setAttribute('aria-valuenow', String(Math.floor(fraction * 1000 + 1e-9) / 10));
      item.bar.setAttribute('aria-valuetext', valueText);
    }
  }
}

applyLayout();
window.addEventListener('resize', applyLayout);

// Un único temporizador (compartido con el reloj): se alinea con cada segundo real,
// se reprograma desde Date.now() y, al volver a la pestaña, repinta al instante.
// Además comprueba el tamaño por si el embed cambió sin emitir "resize"
// (p. ej., un bloque de Notion que se crea plegado a 0×0 y luego se despliega).
startSecondTicker((now) => {
  if (`${window.innerWidth}x${window.innerHeight}` !== layoutSize) applyLayout();
  else render(now);
});
