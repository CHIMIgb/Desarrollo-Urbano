# Urban Planning 3D (Modular & Secure Edition)

Urban Planning 3D es una herramienta profesional de modelado y diseño urbano construida con **Vanilla JavaScript (ES Modules)** y un potente backend en **Node.js**. Esta edición incluye un sistema de autenticación seguro respaldado por **PostgreSQL 16**.

Utiliza **MapLibre GL JS** para el renderizado tridimensional y cálculos matemáticos avanzados para la precisión en la planificación urbana, integrando ahora persistencia de usuarios y seguridad mediante JWT.

---

## 🏗️ Arquitectura del Proyecto

El proyecto se divide en una estructura clara de Frontend y Backend:

### 📦 Organización de Archivos

| Directorio | Responsabilidad |
| :--- | :--- |
| **`server/`** | **Backend**: Servidor Express, autenticación JWT, conexión a Postgres (`db.js`) y lógica de seguridad (`auth.js`). |
| **`src/`** | **Frontend Modular**: Lógica del mapa, herramientas de dibujo, modelos 3D y componentes de UI. |
| **`data/`** | **Base de Datos**: Esquemas SQL (`schema.sql`) para la inicialización del sistema. |
| **`app.js`** | Punto de entrada del cliente que orquesta la carga de los módulos frontend. |
| **`.env`** | Variables de entorno (Credenciales de DB, Secretos JWT). |

---

## 🚀 Características Principales

### Autenticación y Seguridad
- **Sistema de Login**: Acceso restringido mediante credenciales seguras.
- **PostgreSQL 16**: Almacenamiento persistente de usuarios con campos para correo, nombre y contraseñas hasheadas (`bcrypt`).
- **Sesiones JWT**: Manejo de sesiones mediante tokens de seguridad.

### Modelado Procedimental 3D
- **Sistemas de Edificación**: Generación dinámica de casas y edificios corporativos con fachadas detalladas.
- **Ecosistema Urbano**: Biblioteca completa de árboles y mobiliario urbano.

### Herramientas de Planificación
- **Infraestructura**: Trazado de carreteras y vías con curvas suavizadas.
- **Zonificación**: Definición de parques y áreas de agua con cálculo de volumen.
- **Mediciones**: Cálculos exactos de área y perímetro en tiempo real.

---

## 💻 Instrucciones de Instalación y Ejecución

### 1. Requisitos Previos
- **Node.js** instalado.
- **PostgreSQL 16** instalado y corriendo.

### 2. Configuración de Base de Datos
1. Crea una base de datos (ej. `urbanplan_db`).
2. Ejecuta el script en `data/schema.sql` para crear las tablas necesarias.
3. Configura tus credenciales en el archivo `.env`.

### 3. Instalación de Dependencias
```bash
npm install
```

### 4. Crear Usuario Administrador (Opcional)
Para tener un acceso rápido inicial (`admin` / `admin123`):
```bash
node server/seed.js
```

### 5. Iniciar la Aplicación
```bash
node server/index.js
```
Accede a la aplicación en: **http://localhost:3000**

---

## ⌨️ Atajos de Teclado y Controles

- **Mover Cámara**: Click derecho + Arrastrar.
- **Z / R / P**: Herramientas de Zona, Carretera o Parque.
- **S / H / B**: Selección, Casa o Edificio.
- **Ctrl + Z / Ctrl + Y**: Deshacer/Rehacer.
- **Del (Supr)**: Eliminar objeto seleccionado.

---

*Desarrollado para la planificación urbana inteligente y visualización interactiva de ciudades.*