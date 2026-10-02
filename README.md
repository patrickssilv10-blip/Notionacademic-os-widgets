# Academic OS · Widgets

Widgets ligeros para incrustar en el dashboard **My Academic OS** de Notion.
HTML, CSS y JavaScript puros: sin librerías, sin CDNs, sin conexiones externas, sin claves.

| Widget | Ruta | Estado |
|---|---|---|
| Reloj | `widgets/clock/` | ✅ Listo |
| Pomodoro | `widgets/pomodoro/` | ✅ Listo |
| Progreso del tiempo | `widgets/time-progress/` | ✅ Listo |

## Estructura

```
.
├── index.html            # Índice de widgets
├── .nojekyll             # GitHub Pages sirve los archivos tal cual
├── shared/
│   ├── base.css          # Paleta de Notion (claro/oscuro), fondo transparente, reset
│   └── widget.js         # Opciones por URL, tema y temporizador sin desfase
└── widgets/
    ├── clock/
    │   ├── index.html
    │   ├── clock.css
    │   └── clock.js
    ├── pomodoro/
    │   ├── index.html
    │   ├── pomodoro.css
    │   └── pomodoro.js
    └── time-progress/
        ├── index.html
        ├── time-progress.css
        └── time-progress.js
```

Cada widget nuevo es una carpeta en `widgets/` que reutiliza `shared/`.

## Ejecutar en local

Los widgets usan módulos de JavaScript, así que necesitan un servidor (no basta con abrir el archivo):

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000/widgets/clock/, /widgets/pomodoro/ o /widgets/time-progress/
```

## Publicar con GitHub Pages

1. En el repositorio: **Settings → Pages**.
2. **Source:** *Deploy from a branch*.
3. **Branch:** `main` · carpeta `/ (root)` → **Save**.
4. Tras 1–2 minutos, el sitio estará en `https://<usuario>.github.io/<repositorio>/`.

## Incrustar en Notion

1. Escribir `/embed` en Notion y pegar la URL del widget:
   `https://<usuario>.github.io/<repositorio>/widgets/clock/`
2. Ajustar la altura del bloque arrastrando su borde inferior.

## Opciones del reloj (parámetros de URL)

| Parámetro | Valores | Por defecto |
|---|---|---|
| `theme` | `auto` · `light` · `dark` | `auto` (sigue al sistema) |
| `bg` | `transparent` · `solid` | `transparent` |
| `layout` | `auto` · `stack` · `row` · `analog` · `digital` | `auto` |
| `seconds` | `1` · `0` | `1` |
| `date` | `1` · `0` | `1` |

Ejemplo — forzar modo oscuro (útil si Notion está en oscuro y el sistema en claro):

```
https://<usuario>.github.io/<repositorio>/widgets/clock/?theme=dark
```

> Un embed no puede leer el tema de Notion; solo el del sistema operativo.
> Si ambos no coinciden, usar `?theme=dark` o `?theme=light`.

## Pomodoro

Trabajo 25 min · descanso corto 5 min · descanso largo 15 min tras 4 ciclos.
Botones: **Iniciar / Pausar / Reanudar** (un mismo botón), **Reiniciar** y **Saltar fase**.

- La cuenta atrás se calcula desde la hora de fin real: es exacta aunque la pestaña
  pase a segundo plano, el equipo se suspenda o se recargue la página.
- El estado se guarda en `localStorage`: una recarga no pierde la sesión, y dos embeds
  con la misma configuración (p. ej., en páginas distintas de Notion) comparten sesión.
- Al terminar una fase pasa sola a la siguiente, con aviso visual y señal sonora
  (el navegador solo permite sonido después de haber pulsado algún botón del widget).
- Se adapta al tamaño del embed: pensado para la columna lateral; en bloques muy bajos
  cambia a una versión compacta, y en bloques anchos y bajos a una horizontal.

URL: `https://<usuario>.github.io/<repositorio>/widgets/pomodoro/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `theme` | `auto` · `light` · `dark` | `auto` (sigue al sistema) |
| `bg` | `transparent` · `solid` | `transparent` |
| `layout` | `auto` · `stack` · `row` · `compact` | `auto` |
| `work` | minutos de trabajo (admite decimales) | `25` |
| `short` | minutos de descanso corto | `5` |
| `long` | minutos de descanso largo | `15` |
| `cycles` | ciclos de trabajo antes del descanso largo (1–12) | `4` |
| `auto` | `1` (la fase siguiente arranca sola) · `0` (queda en espera) | `1` |
| `sound` | `1` · `0` | `1` |

Ejemplo — sesiones de 50/10 en modo oscuro:

```
https://<usuario>.github.io/<repositorio>/widgets/pomodoro/?work=50&short=10&theme=dark
```

## Progreso del tiempo

Cuánto ha transcurrido del **día**, la **semana** (de lunes a lunes), el **mes** y el **año**:
porcentaje, barra y, si cabe, el tiempo restante.

- Cada segundo se recalcula desde la hora actual y los límites reales del periodo en hora local:
  días de 23/25 h por cambio de hora, meses de 28–31 días y años bisiestos incluidos.
- Se redondea hacia abajo (nunca muestra 100 % antes de tiempo) y siempre está entre 0 y 100 %.
- Tras perder el foco, suspender el equipo o recargar, muestra al instante el valor correcto.
- La disposición se adapta al tamaño del embed solo con CSS: en bloques bajos pasa a una línea
  por periodo, en bloques estrechos quita decimales y, si no caben los cuatro, muestra los primeros.

URL: `https://<usuario>.github.io/<repositorio>/widgets/time-progress/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `theme` | `auto` · `light` · `dark` | `auto` (sigue al sistema) |
| `bg` | `transparent` · `solid` | `transparent` |
