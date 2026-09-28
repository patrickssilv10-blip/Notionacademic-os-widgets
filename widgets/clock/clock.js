/**
 * Reloj — Academic OS Widgets
 *
 * Opciones por URL:
 *   ?theme=auto|light|dark          (por defecto: auto → prefers-color-scheme)
 *   ?bg=transparent|solid           (por defecto: transparent)
 *   ?layout=auto|stack|row|analog|digital   (por defecto: auto)
 *   ?seconds=1|0                    (segundero y segundos digitales; por defecto 1)
 *   ?date=1|0                       (fecha; por defecto 1)
 */
import { readOptions, applyAppearance, startSecondTicker, pad2, capitalize } from '../../shared/widget.js';

const options = readOptions({
  theme: 'auto',
  bg: 'transparent',
  layout: 'auto',
  seconds: '1',
  date: '1',
});
applyAppearance(options);

const root = document.querySelector('.clock');
const face = root.querySelector('.clock__face');
const ticks = root.querySelector('.clock__ticks');
const hourHand = root.querySelector('.clock__hand--hour');
const minuteHand = root.querySelector('.clock__hand--minute');
const secondHand = root.querySelector('.clock__hand--second');
const timeEl = root.querySelector('.clock__time');
const dateEl = root.querySelector('.clock__date');

const showSeconds = options.seconds !== '0';
const showDate = options.date !== '0';
if (!showSeconds) secondHand.remove();
if (!showDate) dateEl.remove();

// ---------- Marcas de la esfera (60, cada 5 más marcadas) ----------
const SVG_NS = 'http://www.w3.org/2000/svg';
for (let i = 0; i < 60; i += 1) {
  const major = i % 5 === 0;
  const tick = document.createElementNS(SVG_NS, 'line');
  tick.setAttribute('x1', '0');
  tick.setAttribute('x2', '0');
  tick.setAttribute('y1', major ? '-40' : '-42.5');
  tick.setAttribute('y2', '-46');
  tick.setAttribute('class', major ? 'clock__tick clock__tick--major' : 'clock__tick');
  tick.setAttribute('transform', `rotate(${i * 6})`);
  ticks.appendChild(tick);
}

// ---------- Disposición: automática según el tamaño del embed ----------
const FIXED_LAYOUTS = new Set(['stack', 'row', 'analog', 'digital']);
function applyLayout() {
  if (FIXED_LAYOUTS.has(options.layout)) {
    root.dataset.layout = options.layout;
    return;
  }
  const { innerWidth: w, innerHeight: h } = window;
  root.dataset.layout = w / h >= 1.6 && h < 220 ? 'row' : 'stack';
}
applyLayout();
window.addEventListener('resize', applyLayout);

// ---------- Formato en español ----------
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

let lastDateText = '';
let lastLabelMinute = -1;

function render(now) {
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  hourHand.setAttribute('transform', `rotate(${(h % 12) * 30 + m * 0.5})`);
  minuteHand.setAttribute('transform', `rotate(${m * 6 + s * 0.1})`);
  if (showSeconds) secondHand.setAttribute('transform', `rotate(${s * 6})`);

  timeEl.textContent = showSeconds
    ? `${pad2(h)}:${pad2(m)}:${pad2(s)}`
    : `${pad2(h)}:${pad2(m)}`;

  if (showDate) {
    const dateText = capitalize(dateFormat.format(now));
    if (dateText !== lastDateText) {
      dateEl.textContent = dateText;
      lastDateText = dateText;
    }
  }

  // Etiqueta accesible: una vez por minuto, sin ruido para lectores de pantalla
  if (m !== lastLabelMinute) {
    face.setAttribute('aria-label', `Reloj analógico: son las ${pad2(h)}:${pad2(m)}`);
    lastLabelMinute = m;
  }
}

startSecondTicker(render);
