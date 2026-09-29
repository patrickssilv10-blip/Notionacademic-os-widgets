/**
 * Pomodoro — Academic OS Widgets
 *
 * Opciones por URL:
 *   ?theme=auto|light|dark          (por defecto: auto → prefers-color-scheme)
 *   ?bg=transparent|solid           (por defecto: transparent)
 *   ?layout=auto|stack|row|compact  (por defecto: auto)
 *   ?work=25  ?short=5  ?long=15    (minutos; admite decimales)
 *   ?cycles=4                       (ciclos de trabajo antes del descanso largo)
 *   ?auto=1|0                       (la fase siguiente arranca sola; por defecto 1)
 *   ?sound=1|0                      (señal sonora al terminar una fase; por defecto 1)
 *
 * La cuenta atrás se calcula siempre a partir de una marca de tiempo de fin (endAt),
 * nunca restando segundos: al volver de una pestaña en segundo plano o tras recargar,
 * el tiempo mostrado es el real. El estado se guarda en localStorage.
 */
import { readOptions, applyAppearance, pad2 } from '../../shared/widget.js';

const options = readOptions({
  theme: 'auto',
  bg: 'transparent',
  layout: 'auto',
  work: '25',
  short: '5',
  long: '15',
  cycles: '4',
  auto: '1',
  sound: '1',
});
applyAppearance(options);

// ---------- Configuración ----------
const MINUTE = 60 * 1000;
const toMinutes = (value, fallback) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 0.05), 600) : fallback;
};
const toInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

const CONFIG = {
  cycles: toInt(options.cycles, 1, 12, 4),
  autoStart: options.auto !== '0',
  sound: options.sound !== '0',
};

const PHASES = {
  work:  { label: 'Trabajo',        duration: Math.round(toMinutes(options.work, 25) * MINUTE) },
  short: { label: 'Descanso corto', duration: Math.round(toMinutes(options.short, 5) * MINUTE) },
  long:  { label: 'Descanso largo', duration: Math.round(toMinutes(options.long, 15) * MINUTE) },
};

// Una clave por configuración: dos embeds con duraciones distintas no se pisan,
// y dos embeds iguales comparten sesión.
const STORAGE_KEY = [
  'aos.pomodoro.v1',
  PHASES.work.duration, PHASES.short.duration, PHASES.long.duration,
  CONFIG.cycles, CONFIG.autoStart ? 'a' : 'm',
].join(':');

// Solo se suena si la fase terminó hace poco (no al abrir una sesión caducada horas después).
const CHIME_WINDOW = 90 * 1000;
const ALERT_DURATION = 6000;

// ---------- Estado ----------
/**
 * @typedef {{ phase: 'work'|'short'|'long', cycle: number,
 *             status: 'idle'|'running'|'paused', endAt: number|null, remaining: number }} State
 */

/** @returns {State} */
const initialState = () => ({
  phase: 'work',
  cycle: 1,
  status: 'idle',
  endAt: null,
  remaining: PHASES.work.duration,
});

const nextPhaseOf = ({ phase, cycle }) => {
  if (phase === 'work') return { phase: cycle >= CONFIG.cycles ? 'long' : 'short', cycle };
  if (phase === 'short') return { phase: 'work', cycle: cycle + 1 };
  return { phase: 'work', cycle: 1 };
};

const remainingOf = (s, now) => (s.status === 'running' ? Math.max(0, s.endAt - now) : s.remaining);

function isValid(s) {
  if (!s || typeof s !== 'object' || !PHASES[s.phase]) return false;
  if (!Number.isInteger(s.cycle) || s.cycle < 1 || s.cycle > CONFIG.cycles) return false;
  if (s.status === 'running') return Number.isFinite(s.endAt);
  if (s.status !== 'idle' && s.status !== 'paused') return false;
  return Number.isFinite(s.remaining) && s.remaining >= 0 && s.remaining <= PHASES[s.phase].duration;
}

/**
 * Avanza las fases que ya han terminado según el reloj real.
 * Con auto-inicio, cada fase nueva empieza exactamente cuando acabó la anterior
 * (endAt + duración), así una ausencia larga se reconstruye sin desfase.
 * @returns {{ state: State, endedAt: number|null }}
 */
function advanceExpired(s, now) {
  let next = s;
  let endedAt = null;
  let guard = 0;
  while (next.status === 'running' && next.endAt <= now) {
    if (guard++ > 1000) return { state: initialState(), endedAt: null }; // sesión olvidada
    endedAt = next.endAt;
    const { phase, cycle } = nextPhaseOf(next);
    const duration = PHASES[phase].duration;
    next = CONFIG.autoStart
      ? { phase, cycle, status: 'running', endAt: endedAt + duration, remaining: duration }
      : { phase, cycle, status: 'idle', endAt: null, remaining: duration };
  }
  return { state: next, endedAt };
}

// ---------- Persistencia (localStorage puede no estar disponible) ----------
function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!isValid(s)) return null;
    const { phase, cycle, status, endAt, remaining } = s;
    // Si el reloj del sistema retrocedió, no mostrar más tiempo que la fase completa
    const max = PHASES[phase].duration;
    const safeEndAt = status === 'running' ? Math.min(endAt, Date.now() + max) : null;
    return { phase, cycle, status, endAt: safeEndAt, remaining };
  } catch {
    return null;
  }
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento: el widget sigue funcionando en memoria */
  }
}

let state = load() ?? initialState();

// ---------- Elementos ----------
const root = document.querySelector('.pomo');
const phaseEl = root.querySelector('.pomo__phase');
const dotsEl = root.querySelector('.pomo__dots');
const cycleTextEl = root.querySelector('.pomo__cycle-text');
const timeEl = root.querySelector('.pomo__time');
const arcEl = root.querySelector('.pomo__arc');
const barFillEl = root.querySelector('.pomo__bar-fill');
const toggleBtn = root.querySelector('[data-action="toggle"]');

// Puntos de ciclo (solo si caben con holgura)
const dots = [];
if (CONFIG.cycles <= 8) {
  for (let i = 0; i < CONFIG.cycles; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'pomo__dot';
    dotsEl.appendChild(dot);
    dots.push(dot);
  }
}

// ---------- Disposición: automática según el tamaño del embed ----------
const FIXED_LAYOUTS = new Set(['stack', 'row', 'compact']);
function applyLayout() {
  if (FIXED_LAYOUTS.has(options.layout)) {
    root.dataset.layout = options.layout;
    return;
  }
  const { innerWidth: w, innerHeight: h } = window;
  // En horizontal, el anillo (≤150px) + separación + fase y botones (~170px) deben caber a lo ancho
  const rowFits = w >= Math.min(h - 12, 150) + 182;
  if (w / h >= 1.8 && h < 220 && h >= 96 && rowFits) root.dataset.layout = 'row';
  else if (h < 170) root.dataset.layout = 'compact';
  else root.dataset.layout = 'stack';
}
applyLayout();
window.addEventListener('resize', applyLayout);

// ---------- Pintado ----------
const TOGGLE_LABELS = { idle: 'Iniciar', running: 'Pausar', paused: 'Reanudar' };
const formatTime = (ms) => {
  const secs = Math.ceil(ms / 1000);
  return `${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`;
};

function render(now = Date.now()) {
  const { phase, cycle, status } = state;
  const { label, duration } = PHASES[phase];
  const left = remainingOf(state, now);
  const time = formatTime(left);
  const elapsed = Math.min(1, Math.max(0, 1 - left / duration));

  root.dataset.phase = phase;
  root.dataset.status = status;

  if (phaseEl.textContent !== label) phaseEl.textContent = label;
  cycleTextEl.textContent = `${cycle}/${CONFIG.cycles}`;
  cycleTextEl.title = `Ciclo ${cycle} de ${CONFIG.cycles}`;

  const completed = phase === 'work' ? cycle - 1 : cycle;
  dots.forEach((dot, i) => {
    dot.classList.toggle('pomo__dot--done', i < completed);
    dot.classList.toggle('pomo__dot--current', phase === 'work' && i === cycle - 1);
  });

  if (timeEl.textContent !== time) timeEl.textContent = time;
  arcEl.style.strokeDashoffset = String(-elapsed * 100);
  barFillEl.style.width = `${(1 - elapsed) * 100}%`;

  const toggleLabel = TOGGLE_LABELS[status];
  if (toggleBtn.textContent !== toggleLabel) toggleBtn.textContent = toggleLabel;

  document.title = status === 'idle' ? 'Pomodoro · Academic OS' : `${time} · ${label}`;
}

// ---------- Temporizador único ----------
// Un solo setTimeout vivo en todo momento: siempre se cancela el anterior antes de programar
// el siguiente, y solo existe mientras la fase está en marcha. Cada tic se alinea con el
// cambio de segundo de la cuenta atrás (endAt), no con el reloj de pared.
let timer = 0;
function schedule() {
  window.clearTimeout(timer);
  timer = 0;
  if (state.status !== 'running') return;
  const left = state.endAt - Date.now();
  const delay = left <= 0 ? 0 : (left % 1000 || 1000) + 15;
  timer = window.setTimeout(tick, delay);
}

function tick() {
  timer = 0;
  sync();
}

/**
 * Pone el estado al día: adopta cambios de otra pestaña/embed, cierra las fases
 * vencidas (con aviso si ha terminado ahora), pinta y reprograma.
 */
function sync() {
  const now = Date.now();
  state = load() ?? state;
  const { state: advanced, endedAt } = advanceExpired(state, now);
  if (advanced !== state) {
    state = advanced;
    save();
    if (endedAt !== null) signalPhaseEnd(now - endedAt <= CHIME_WINDOW);
  }
  render(now);
  schedule();
}

function commit(next, now = Date.now()) {
  state = next;
  save();
  render(now);
  schedule();
}

// ---------- Acciones ----------
function start(now) {
  if (state.status === 'running') return;
  commit({ ...state, status: 'running', endAt: now + state.remaining }, now);
}

function pause(now) {
  if (state.status !== 'running') return;
  commit({ ...state, status: 'paused', endAt: null, remaining: remainingOf(state, now) }, now);
}

function reset(now) {
  clearAlert();
  commit(initialState(), now);
}

function skip(now) {
  const { phase, cycle } = nextPhaseOf(state);
  const duration = PHASES[phase].duration;
  const running = state.status === 'running';
  commit({
    phase,
    cycle,
    status: running ? 'running' : 'idle',
    endAt: running ? now + duration : null,
    remaining: duration,
  }, now);
  signalPhaseEnd(false);
}

const ACTIONS = {
  toggle: (now) => (state.status === 'running' ? pause(now) : start(now)),
  reset,
  skip,
};

root.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  unlockAudio();
  sync(); // partir siempre del estado real (otra pestaña, fase vencida…)
  ACTIONS[button.dataset.action]?.(Date.now());
});

// ---------- Aviso al terminar una fase ----------
let alertTimer = 0;
function clearAlert() {
  window.clearTimeout(alertTimer);
  alertTimer = 0;
  delete root.dataset.alert;
}

function signalPhaseEnd(withSound) {
  clearAlert();
  void root.offsetWidth; // reinicia la animación si ya estaba activa
  root.dataset.alert = '';
  alertTimer = window.setTimeout(clearAlert, ALERT_DURATION);
  if (withSound) chime(state.phase);
}

// ---------- Sonido (Web Audio, sin archivos) ----------
// Los navegadores solo permiten audio tras una interacción: el contexto se crea
// en el primer clic dentro del widget.
let audio = null;
function unlockAudio() {
  if (!CONFIG.sound) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    if (!audio) audio = new AudioCtx();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

function chime(phase) {
  if (!CONFIG.sound || !audio || audio.state !== 'running') return;
  // Descanso → notas descendentes; vuelta al trabajo → ascendentes
  const notes = phase === 'work' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
  const start = audio.currentTime + 0.02;
  notes.forEach((freq, i) => {
    const t = start + i * 0.18;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });

// ---------- Sincronización ----------
// Al volver a la pestaña (los navegadores frenan los temporizadores en segundo plano),
// al restaurarla desde caché y cuando otra pestaña/embed cambia la misma sesión.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sync();
});
window.addEventListener('pageshow', sync);
window.addEventListener('focus', sync);
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) sync();
});

sync();
