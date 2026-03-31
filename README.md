# Urban Planning - 3D Intelligence Platform

**Urban Planning** es una plataforma profesional de nivel de ingeniería diseñada para arquitectos, planificadores urbanos y gobiernos locales. Permite construir, analizar y gestionar gemelos digitales de entornos urbanos directamente en el navegador de forma paramétrica y procedural, fusionando la libertad del diseño 3D con la precisión de los Sistemas de Información Geográfica (GIS).

Arquitectura sin frameworks frontend (Vanilla JS / ES Modules reactivos) para un rendimiento superior, respaldada por un backend robusto en **Node.js, Express y PostgreSQL 16 (Supabase)**.

---

## 🚀 Visión General y Contexto

A diferencia de las herramientas tradicionales de CAD o GIS puro que suelen ser aisladas y de alta fricción, **Urban Planning** democratiza la concepción de proyectos urbanos mediante:
1. **Contexto Dinámico Global:** Integración nativa con la API de OpenStreetMap (OSM) y Overpass, permitiendo importar manzanas, edificios y vialidades reales de cualquier parte del mundo en 1 solo clic y transformarlas en geometría 3D editable.
2. **Medición de Grado de Ingeniería:** Un motor matemático que no solo calcula métricas (Área, Volumen, Alturas), sino que permite el desplazamiento geográfico exacto de objetos y vértices usando coordenadas o vectores polares (distancia y rumbo).
3. **Gestión Documental y Proyectos en la Nube:** Sistema de persistencia por cuenta de usuario (Autenticación JWT), donde se guardan no sólo los objetos, sino los estados exactos de visualización de la cámara (pitch, bearing, zoom).

---

## ✨ Características Principales

### 🏙️ Modelado Paramétrico y Procedimental
- Generación automática de casas, rascacielos personalizables, zonas de agua (cálculo de profundidad), áreas verdes y polígonos irregulares.
- Sistema de **Calles y Vías Férreas** paramétricas con algoritmos de curvas suaves (Catmull-Rom), ajustables por ancho y número de carriles.
- **Colocación en Serie (Linear Placement):** Distribución matemática y en masa de mobiliario urbano (árboles, bancas, luminarias) siguiendo el contorno de aceras o linderos.

### 📐 Panel de Edición Precisa Integral
- Edición inteligente a nivel de sub-geometría (Vértice a Vértice).
- Mover elementos y nodos con medidas exactas métricas (ej. "mover 15.5m con rumbo 90°").
- Actualización dinámica de parámetros paramétricos (alturas, usos de suelo, grosores y colores temáticos).

### 📊 Análisis de Datos y Estadísticas
- Panel de Control (Dashboard) de auditoría que evalúa métricas totales de la ciudad: Densidad, conteo estructural, longitud de vías.
- Vista de **Lotes y Terrenos individuales**: Estadísticas de ocupación de huella de construcción y áreas libres.

---

## 🏗️ Stack Tecnológico y Arquitectura

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend UI** | Vanilla JS (ES Modules reactivos), HTML5, CSS3 | Interfaz "Glassmorphism" asíncrona y estructurada en componentes. |
| **GIS & 3D Engine** | MapLibre GL JS, Turf.js | Renderizado WebGL de mapas base interactivos y operaciones espaciales matemáticas. |
| **Backend API** | Node.js, Express.js | API REST, middleware de procesamiento y mitigación CORS. |
| **Seguridad** | JSON Web Tokens (JWT), Bcrypt | Sesiones de usuario, hasheo de credenciales de un solo sentido. |
| **Base de Datos** | PostgreSQL 16 (on Supabase/RDS) | Almacenamiento JSONB de infraestructura urbana, proyectos y perfiles. |

---

## 💻 Instalación y Despliegue Local

### 1. Requisitos Previos
- **Node.js** (v18+ recomendado).
- **PostgreSQL 16** instalado o una base remota como Supabase lista para recibir conexiones (`postgres://`).

### 2. Configuración del Entorno
1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```
2. Inicializa la estructura en tu Base de Datos usando el script provisto en `data/schema.sql`.
3. Renombra `.env.example` a `.env` y llena los parámetros:
   ```env
   DATABASE_URL=postgres://usuario:password@localhost:5432/bd
   JWT_SECRET=tu_clave_super_secreta_jwt
   PORT=3000
   ```

### 3. Crear Usuario Administrador (Opcional pero recomendado)
La aplicación cuenta con un seeder para crear listas blancas iniciales o darte un acceso rápido (`admin` / `admin123`):
```bash
node server/seed.js
```

### 4. Iniciar la Aplicación
**Entorno de Desarrollo:**
```bash
npm run dev
```

**Entorno de Producción (Cloud - Vercel, Render, Heroku, etc.):**
```bash
npm start
```

Accede a la plataforma vía navegador web moderno (Edge/Chrome/Safari) en **http://localhost:3000** 🟢.

---

## 🔒 Consideraciones de Seguridad en Producción
La plataforma cuenta con Middleware robusto contra intrusiones:
* Bloqueo nativo del sistema de ficheros de backend (`/server`, `.env`, `package.json`).
* Limitadores de carga espacial (`MAX_PAYLOAD_SIZE`).
* Aislamiento de sesiones en DB, prohibiendo a usuarios auditar o visualizar proyectos de otros arquitectos.

---

## ⌨️ Atajos de Productividad (Hotkeys)
- **Mover Cámara en 3D:** Clic derecho firme + Arrastrar ratón.
- **Herramientas de Construcción:** `C` (Silueta 3D Libre), `B` (Edificio Bloque), `H` (Casa).
- **Herramientas de Terreno:** `Z` (Zona/Distrito), `P` (Parque), `M` (Mar/Agua), `S` (Selección de Vértices).
- **Control de Tiempo (Historial):** `Ctrl+Z` (Deshacer), `Ctrl+Y` (Rehacer).
- **Administración Espacial:** `Delete / Backspace` tras selección borra el objeto activo.

---

*Desarrollado y conceptualizado para impulsar el diseño de las Smart Cities del mañana.*