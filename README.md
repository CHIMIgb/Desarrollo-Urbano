# Urban Planning 3D (Vanilla Version)

Urban Planning 3D es un prototipo avanzado de modelado y planificación urbana construido enteramente con tecnologías web nativas (**Vanilla JavaScript, HTML5 y CSS3**) sin necesidad de frameworks pesados, empaquetadores o dependencias de servidor.

Este proyecto utiliza **MapLibre GL JS** para renderizar un entorno tridimensional de alto rendimiento donde arquitectos, urbanistas y diseñadores pueden esbozar infraestructuras urbanas, medir terrenos y previsualizar volumetrías directamente en el navegador.

## 🚀 Características Principales

### Modelado Procesal 3D
- **Generación de Edificios**: Creación de casas (con techos a dos aguas) y edificios (con ventanas simuladas) de manera procedimental usando capas de `fill-extrusion`.
- **Mobiliario Urbano y Naturaleza**: Disposición de postes, faroles, semáforos y diferentes tipos de árboles (pinos, abetos, robles) renderizados en 3D puro mediante geometría *low-poly* en tiempo real.
- **Parametrización Interactiva**: Configuración en tiempo real del ancho, largo, rotación y altura de los volúmenes arquitectónicos construidos.

### Herramientas de Planificación
- **Trazado de Infraestructura**: Herramientas integradas para trazar carreteras (con curvas suavizadas mediante spline *Catmull-Rom* y anchos personalizados) y vías férreas.
- **Zonificación y Terrenos**: Dibujo de polígonos irregulares para limitar zonas de terreno, parques, cuerpos de agua (con cálculo de profundidad y volumen) y zonas de uso de suelo.
- **Análisis de Espacio**: Herramienta de Isócronas/Radios de influencia para analizar el alcance peatonal o vehicular desde un punto central.
- **Mediciones en Tiempo Real**: Cálculo en vivo de áreas (m²/ha), distancias (m/km) y perímetros usando la fórmula de *Haversine* y el teorema de *Shoelace*.

### Experiencia de Usuario (UI/UX)
- **Cero Dependencias de Construcción**: Usa CDNs para importar MapLibre y tipografías.
- **Gestión de Estado**: Sistema robusto de *Deshacer/Rehacer* (Undo/Redo) e historial en memoria.
- **Edición Geométrica**: Nodos de redimensionamiento y movimiento para modificar carreteras y polígonos después de haber sido dibujados.
- **Importar / Exportar**: Guarda tu progreso descargando un archivo `.json` y retoma el proyecto importándolo más adelante.
- **Persistencia Local**: La posición de la cámara (zoom, rotación, inclinación) se guarda en el `localStorage` del navegador.

## 🛠️ Tecnologías Empleadas

- **MapLibre GL JS (v4.7.1)**: Motor de renderizado principal para el lienzo del mapa y los modelos 3D extrusionados.
- **Vanilla JavaScript**: Toda la lógica matemática, generación de polígonos, curvas *Catmull-Rom*, gestión de interacción y manejo del DOM está escrita en un único archivo (`app.js`).
- **HTML5 & Vanilla CSS**: Interfaz limpia, responsiva y temática oscura diseñada desde cero (`style.css` y `index.html`).
- **Fuentes de Mapas**: Integración con mosaicos de mapa base (*tiles*) libres u open-data (OpenStreetMap, Esri World Imagery, AWS Elevation Tiles).

## 📥 Estructura del Código

```text
/
├── index.html   # La interfaz de usuario, los paneles flotantes y menús.
├── style.css    # Estilo oscuro moderno, scrollbars y animaciones.
└── app.js       # Toda la lógica geoespacial, el estado y el controlador de MapLibre.
```

## 💻 Instrucciones de Ejecución

Dado que esta es la versión "Vanilla", ejecutar y desplegar este proyecto localmente es extremadamente sencillo. Simplemente necesitas levantar un servidor web estático en la raíz del proyecto para evitar problemas de CORS.

Puedes desplegarlo usando cualquiera de estos comandos en tu terminal (en la carpeta del proyecto):

**Opción 1: Usando Python (Recomendado)**
```bash
python -m http.server 8080
```
*Luego abre tu navegador en: http://localhost:8080*

**Opción 2: Usando Node.js (npx)**
```bash
npx serve .
```

**Opción 3: Usando PHP**
```bash
php -S localhost:8080
```

- **Click Izquierdo**: Dibujar / Seleccionar un objeto.
- **Click Derecho**: Cerrar polígono / Terminar línea (o arrastrar el mapa para girar la cámara usando el mouse).
- **Mantener Shift + Click**: Selección múltiple.
- **Ctrl + Z**: Deshacer última acción.
- **Ctrl + Y**: Rehacer.
- **Supr (Del)**: Eliminar los objetos seleccionados.
