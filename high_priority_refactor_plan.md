# Plan de Implementación: Refactorización de Prioridad Alta (Frontend)

Este plan detalla los pasos técnicos exactos para solucionar la deuda técnica más crítica del frontend: **Estado Global Mutable**, **Dependencias Circulares** y **Lógica de Negocio acoplada en la UI**. 

Se ha dividido en **3 Fases** para garantizar que los cambios se hagan de manera iterativa sin romper la aplicación.

---

## 🏗️ Fase 1: Desacoplamiento mediante un Event Bus (Pub/Sub)
**Objetivo:** Eliminar la dependencia circular entre `map/core.js` y componentes de la UI (como `ui/toolbar.js`).

1. **Crear el Gestor de Eventos (`src/config/events.js`)**
   - Implementar un sistema ligero de publicación/suscripción (Pub/Sub) utilizando `EventTarget` nativo o un objeto simple de listeners.
   - Definir una lista estándar de eventos (ej. `map:ready`, `feature:selected`, `feature:updated`, `state:changed`).

2. **Refactorizar `map/core.js`**
   - Eliminar las importaciones de componentes UI (`import { toast, updateStats } from '../ui/toolbar.js'`).
   - Reemplazar las llamadas directas a la UI por emisiones de eventos: `EventBus.emit('feature:selected', { id: featureId })`.

3. **Refactorizar la Interfaz de Usuario (`ui/toolbar.js`, `ui/properties.js`, etc.)**
   - Suscribir los componentes UI a los eventos del `EventBus` en su inicialización.
   - Ejemplo: `EventBus.on('feature:selected', (data) => abrirPanelPropiedades(data.id))`.

---

## 🔒 Fase 2: Patrón Store para el Estado Global
**Objetivo:** Proteger `state.js` para que nadie pueda mutar el arreglo de geometrías directamente y asegurar que `undo/redo` funcione impecablemente.

1. **Crear el Store Centralizado (`src/config/store.js`)**
   - Migrar las variables de `src/config/state.js` a un estado interno privado.
   - Exponer el estado únicamente como *sólo lectura* (usando un Proxy o clonación superficial `Object.freeze`).

2. **Crear Acciones Controladas (Reducers/Setters)**
   - Escribir funciones específicas para mutar el estado: `addFeature()`, `updateFeature()`, `deleteFeature()`, `undo()`, `redo()`.
   - Modificar estas funciones para que, internamente, cada vez que muten el estado, emitan automáticamente un evento `state:changed` a través del `EventBus`.

3. **Limpiar las mutaciones directas en el código**
   - Buscar en todos los archivos (`tools/`, `models/`, `ui/`) las llamadas tipo `state.features.push(...)` o `state.features[i].properties...`.
   - Reemplazarlas por las nuevas acciones del Store: `Store.addFeature(...)`.

---

## 📐 Fase 3: Separación de Lógica de Negocio y UI
**Objetivo:** Retirar cálculos geométricos complejos de `ui/properties.js`.

1. **Analizar `ui/properties.js`**
   - Identificar funciones como `rebuildGeom()`, `rebuildLine()`, y cualquier otro cálculo matemático espacial que suceda cuando el usuario cambia un input (ej. anchura de un edificio).

2. **Mover Lógica a los Modelos (`src/models/`)**
   - Trasladar las lógicas de reconstrucción al modelo correspondiente (ej. `src/models/buildings.js` o `src/models/roads.js`).
   - Crear funciones puras del estilo: `calculateNewGeometry(oldFeature, newDimensions)`.

3. **Conectar la UI con el Store y los Modelos**
   - Cuando el usuario cambie el "Ancho" en la UI, `ui/properties.js` solo hará lo siguiente:
     1. Llamar a la función del modelo para generar la nueva forma geométrica.
     2. Enviar esa nueva forma al Store: `Store.updateFeature(id, nuevaForma)`.
   - El Store emitirá `state:changed`, y el Mapa se redibujará automáticamente gracias a la Fase 1.

---

## 🚀 Siguientes Pasos
Para comenzar, abordaremos una fase a la vez, comprobando que la aplicación compile y funcione correctamente antes de pasar a la siguiente.
