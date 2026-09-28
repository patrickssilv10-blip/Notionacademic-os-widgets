/**
 * Academic OS Widgets — núcleo compartido
 * Reutilizado por: reloj, pomodoro, progreso del tiempo.
 *
 * Sin dependencias ni conexiones externas.
 */

/**
 * Lee opciones de la URL (?theme=dark&bg=solid...) con valores por defecto.
 * @param {Record<string, string>} defaults
 * @returns {Record<string, string>}
 */
export function readOptions(defaults = {}) {
  const params = new URLSearchParams(window.location.search);
  const options = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = params.get(key);
    if (value !== null && value !== '') options[key] = value.toLowerCase();
  }
  return options;
}

/**
 * Aplica tema y fondo al documento.
 *   theme: "auto" (sigue al sistema) | "light" | "dark"
 *   bg:    "transparent" | "solid"
 */
export function applyAppearance({ theme = 'auto', bg = 'transparent' } = {}) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  root.dataset.bg = bg === 'solid' ? 'solid' : 'transparent';
}

/**
 * Ejecuta `callback(now)` alineado con el inicio de cada segundo del reloj real.
 * - No acumula desfase: cada tic se reprograma a partir de Date.now().
 * - Al volver a una pestaña oculta (el navegador frena los temporizadores),
 *   se actualiza inmediatamente.
 * @param {(now: Date) => void} callback
 * @returns {() => void} función para detener el ticker
 */
export function startSecondTicker(callback) {
  let timer = null;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    const now = new Date();
    callback(now);
    timer = window.setTimeout(run, 1000 - now.getMilliseconds() + 5);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      window.clearTimeout(timer);
      run();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  run();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/** Rellena con ceros a la izquierda. */
export const pad2 = (n) => String(n).padStart(2, '0');

/** Pone en mayúscula la primera letra (p. ej., "jueves" → "Jueves"). */
export const capitalize = (text) => text.charAt(0).toLocaleUpperCase('es-ES') + text.slice(1);
