# Academic OS · Widgets

Widgets ligeros para incrustar en el dashboard **My Academic OS** de Notion.
HTML, CSS y JavaScript puros: sin librerías, sin CDNs, sin conexiones externas, sin claves.

| Widget | Ruta | Estado |
|---|---|---|
| Reloj | `widgets/clock/` | ✅ Listo |
| Pomodoro | `widgets/pomodoro/` | Pendiente |
| Progreso del tiempo | `widgets/progress/` | Pendiente |

## Estructura

```
.
├── index.html            # Índice de widgets
├── .nojekyll             # GitHub Pages sirve los archivos tal cual
├── shared/
│   ├── base.css          # Paleta de Notion (claro/oscuro), fondo transparente, reset
│   └── widget.js         # Opciones por URL, tema y temporizador sin desfase
└── widgets/
    └── clock/
        ├── index.html
        ├── clock.css
        └── clock.js
```

Cada widget nuevo es una carpeta en `widgets/` que reutiliza `shared/`.

## Ejecutar en local

Los widgets usan módulos de JavaScript, así que necesitan un servidor (no basta con abrir el archivo):

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000/widgets/clock/
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
