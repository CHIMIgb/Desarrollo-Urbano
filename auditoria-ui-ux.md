# Auditoría UI/UX — UrbanPlan 3D

> Fecha: 2026-07-19 | 65 problemas encontrados en 8 categorías

---

## 🔴 CRÍTICO — Seguridad + Accesibilidad

### XSS (Cross-Site Scripting)

Los datos del servidor se inyectan en el DOM sin sanitizar, permitiendo ejecución de código arbitrario.

| Archivo | Línea | Problema |
|---|---|---|
| `src/ui/toolbar.js` | 169-171 | `renderProjectsList` usa `item.innerHTML` con `p.name` sin escape. Un nombre como `<img onerror=alert(1)>` ejecuta código |
| `src/ui/properties.js` | 23 | `showPropsPanel` inyecta `p.name` en `value="${p.name}"`. Un nombre con `"` rompe el atributo |
| `src/ui/search.js` | 36-39 | Nombres de resultados de búsqueda se inyectan vía innerHTML sin sanitización |
| `src/ui/stats.js` | 223-266 | `renderLotBreakdown` inyecta `lot.name` via innerHTML |

**Fix:** Crear función `escapeHTML(str)` que reemplace `<`, `>`, `"`, `'`, `&` y usarla en todos los puntos de inyección.

### Focus Traps en Modales

Ningún modal captura el foco. El usuario puede navegar con Tab hacia contenido de fondo.

| Modal | Archivo | Problemas |
|---|---|---|
| Login | `index.html:30-85` | Sin `role="dialog"`, sin `aria-modal`, sin focus trap |
| Confirmar | `index.html:478-489` | Sin focus trap, sin Escape, sin `aria-labelledby` |
| Proyectos | `index.html:492-503` | Sin focus trap, sin Escape |

**Fix:** Implementar función `trapFocus(modal)` que intercepte Tab y Cycling y Escape para cerrar.

### Accesibilidad de Controles

| Problema | Ubicación | Fix |
|---|---|---|
| Toggle switches sin `role="switch"` ni `aria-checked` | `panels.css:57-71`, `index.html:311-338` | Agregar atributos ARIA + `focus-visible` ring |
| Toolbar sin `role="toolbar"`, botones sin `aria-pressed` | `index.html:148-251` | Agregar roles ARIA |
| Botones undo/redo solo con `title`, sin `aria-label` | `index.html:116-120` | Agregar `aria-label` |
| Logo sin accessible name | `index.html:23, 92` | Agregar `aria-label="UrbanPlan 3D"` |
| Stats dashboard sin `role="region"` ni `aria-label` | `index.html:404-473` | Agregar roles |
| Project name `contenteditable` sin `role="textbox"` | `index.html:95` | Agregar role + aria-label |

### Contraste Insuficiente

| Elemento | Color actual | Ratio estimado | Requerido |
|---|---|---|---|
| Tool group labels | `--text-muted` (#5a6577) on `--bg-800` | ~2.8:1 | 4.5:1 |
| Coordinate display | `--text-muted` on glass-bg | ~2.5:1 | 4.5:1 |
| Precision hints (opacity 0.6) | `--text-muted` × 0.6 | ~1.7:1 | 4.5:1 |

**Fix:** Usar `--text-secondary` (#8b95a5) para texto funcional. Reservar `--text-muted` solo para decorativo.

---

## 🟠 ALTO IMPACTO — UX Core

### Sin Indicador de Cambios sin Guardar

No hay ningún indicador visual de que el proyecto tiene cambios pendientes. El usuario puede perder trabajo al:
- Cerrar el tab
- Navegar a otro proyecto
- Hacer import
- Cerrar sesión

**Fix:** Agregar clase `.dirty` al project-name con un dot naranja, y `beforeunload` event.

### Sin Ctrl+S

El botón "Guardar" es el primary action pero no tiene atajo de teclado.

**Fix:** Agregar listener `document.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); } })`.

### Undo/Redo Siempre Activos

Los botones nunca se deshabilitan aunque no haya historial.

| Botón | Condición de deshabilitado |
|---|---|
| Undo | `state.history.length <= 1` |
| Redo | `state.future.length === 0` |

**Fix:** Escuchar eventos `HISTORY_PUSH`/`HISTORY_POP` y toggle clase `.disabled` + `aria-disabled`.

### Empty States Genéricos

| Ubicación | Texto actual | Mejora sugerida |
|---|---|---|
| `stats.js:218` | "No hay terrenos definidos" (opacity 0.5) | Texto + icono + CTA "Dibuja un terreno" |
| `toolbar.js:157-159` | Texto plano sin guía | Ilustración + "Crea tu primer proyecto" |
| `stats.js:219` | Inline style `font-size:11px; opacity:0.5` | Clase CSS `.empty-state` |

### Loading States Frágiles

| Archivo | Problema |
|---|---|
| `io.js:83-136` | Spinner vía innerHTML destruye event listeners |
| `auth.js:46-47` | Mismo patrón frágil |
| `io.js:140-159` | Sin timeout — si el server cuelga, loading infinito |

**Fix:** Usar `disabled` + clase `.loading` en el botón en vez de reemplazar innerHTML.

### Errores Silenciados

| Archivo | Línea | Problema |
|---|---|---|
| `src/ui/search.js` | 56 | `catch (e) {}` — error de búsqueda completamente ignorado |
| `src/ui/io.js` | 130-131 | Toast muestra error interno del server al usuario |
| `src/ui/auth.js` | 68-70 | Login falla pero no limpia campos |

**Fix:** Mostrar toast de error genérico en search, sanitizar mensajes de error, limpiar form en error.

---

## 🟡 LAYOUT Y ESTRUCTURA

### Toolbar Sin Colapsar

19 botones siempre visibles. En pantallas pequeñas, los tools de abajo quedan fuera de vista sin scroll visible.

**Fix:** Botón de colapsar toolbar a iconos-only (48px), o accordion por grupos.

### Panel Derecho Fijo 300px

Sin resize ni collapse. En laptops 1366px, el mapa solo recibe ~976px.

**Fix:** Agregar handle de resize o botón de colapsar panel. Considerar `--panel-w` como variable que se ajuste.

### Responsive Minimalista

Solo 1 breakpoint: bloque total a < 1024px. No hay puntos intermedios para:
- 1280px (laptops pequeñas)
- 1366px (laptops estándar)
- 1600px+ (monitores grandes)

**Fix:** Agregar breakpoints en 1280px y 1600px. Considerar panel colapsable en 1280px.

### Header Min-Width Fijo

`.header-left` y `.header-right` tienen `min-width: 260px` cada uno = 520px antes del search.

**Fix:** Usar `flex-shrink` y permitir que el search box se comprima.

### Dashboard Posición Hardcodeada

`left: 100px` en `measurement.css:117` asume toolbar de 90px. Si cambia el toolbar, se rompe.

**Fix:** Usar `left: var(--toolbar-w)` o posicionar relativo al mapa.

---

## 🔵 POLISH VISUAL Y MICRO-INTERACCIONES

### Tooltips Nativos

Los `title` attributes tienen ~500ms delay del browser, sin estilo, sin soporte mobile.

**Fix:** Implementar componente tooltip custom con `data-tooltip` attribute, posicionamiento dinámico, y animación de fade-in.

### Project Name Sin Affordance Edit

`contenteditable` parece texto estático. Solo un borde sutil en hover indica que es editable.

**Fix:** Agregar icono de lápiz pequeño, o `border-bottom: 1px dashed` en hover.

### Transiciones Compiten (Toasts)

`toast.css` define `@keyframes toastIn`, pero `notifications.js` también setea inline styles con `setTimeout`. Los dos sistemas se pelean.

**Fix:** Usar solo CSS animations. Remover el `setTimeout` del JS y usar `animationend` event para limpiar.

### Collapse Sin Animación

`.precision-panel.collapsed` usa `display: none` que no se puede animar.

**Fix:** Usar `max-height: 0; overflow: hidden; opacity: 0` con transición, o `grid-template-rows: 0fr` (CSS moderno).

### Hover States Inconsistentes

| Botón | Hover | Active |
|---|---|---|
| `btn-primary` | `accent-hover` + shadow | `scale(0.97)` |
| `btn-ghost` | `surface-hover` | Ninguno |
| `btn-secondary` | `bg-500` | Ninguno |
| `btn-locate-lot` | `scale(1.05)` | `scale(0.95)` |

**Fix:** Unificar a `scale(0.97)` en active para todos los botones interactivos.

### Dashed Divider Contradictorio

`options-bar.css:33-35` tiene `background: var(--border)` y luego `background: transparent`. La segunda gana, pero `border-left: 1px dashed` persiste.

**Fix:** Limpiar a solo `border-left: 1px dashed var(--border)` sin background.

---

## ⬜ FEATURES ESTÁNDAR QUE FALTAN

| # | Feature | Esfuerzo | Prioridad |
|---|---|---|---|
| 23 | **Drag-and-drop** para importar JSON | Medio | Alta |
| 24 | **Skeleton loaders** en stats y properties | Alto | Media |
| 25 | **Badges de conteo** en toolbar (ej: "Casa: 5") | Medio | Media |
| 26 | **Zoom-to-fit / Fit all** | Bajo | Alta |
| 27 | **Autosave** con indicador "Guardado hace 2 min" | Medio | Alta |

---

## 📊 Resumen

| Categoría | Severidad | Cantidad |
|---|---|---|
| Seguridad (XSS) | Crítica | 4 |
| Accesibilidad (WCAG) | Alta | 14 |
| UX Friction | Alta | 12 |
| Layout & Responsiveness | Media | 6 |
| Visual Polish | Baja | 7 |
| Features Faltantes | Media | 5 |
| Performance | Media | 3 |
| Code Quality | Baja | 8 |
| **Total** | | **65** |

### Orden de Implementación Sugerido

1. **Fase 1 — Seguridad** (2h): XSS fixes con `escapeHTML()`
2. **Fase 2 — Accesibilidad Core** (3h): Focus traps, ARIA roles, contraste
3. **Fase 3 — UX Core** (2h): Ctrl+S, undo/redo disabled, empty states, error handling
4. **Fase 4 — Layout** (4h): Panel colapsable, toolbar responsive, breakpoints
5. **Fase 5 — Polish** (3h): Tooltips, animaciones, hover consistente
6. **Fase 6 — Features** (4h): Drag-drop, skeleton loaders, zoom-to-fit
