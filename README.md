# 🍕 Holy Tacos - Plataforma de Delivery de Comida

Una plataforma full-stack MERN para delivery de comida, similar a Pedidos Ya, **con seguimiento GPS en tiempo real**.

## 🚚 Sistema de Tracking GPS en Tiempo Real

### Funcionalidades implementadas:
- ✅ **Seguimiento GPS en tiempo real** con Socket.io
- ✅ **Mapas interactivos** con Google Maps API
- ✅ **Geolocalización automática** del conductor
- ✅ **Rutas calculadas** con Directions API
- ✅ **Tiempo estimado de llegada (ETA)**
- ✅ **Notificaciones en tiempo real** de actualizaciones
- ✅ **Control de permisos** por roles (cliente/driver/admin)

### Rutas principales:
- **Cliente:** `/orders/:orderId` - Ver tracking del pedido
- **Driver:** `/driver/orders/:orderId` - Gestionar entrega con GPS
- **Admin:** `/admin/dashboard` - Asignar drivers y ver estadísticas

## ⚙️ Configuración de Google Maps APIs

### 1. Crear proyecto en Google Cloud Console
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - **Maps JavaScript API**
   - **Directions API**
   - **Geocoding API**
   - **Places API** (para el autocompletado de direcciones)
   - *Opcional:* **Maps Static API** solo si quieres miniaturas de mapa estático (la app usa placeholders por defecto para evitar 403).

### 2. Crear clave API
1. Ve a "Credenciales" en el menú lateral
2. Haz clic en "Crear credenciales" → "Clave API"
3. Copia la clave generada
4. **IMPORTANTE:** Restringe la clave API:
   - Ve a "Credenciales" → selecciona tu clave
   - En "Restricciones de aplicaciones" → selecciona "Sitios web (referrers)"
   - Agrega `http://localhost:*`, `http://127.0.0.1:*` y tus dominios de producción (ej. `https://tudominio.com/*`)
   - En "Restricciones de API" → selecciona Maps JavaScript API, Directions API, Geocoding API y Places API

### 3. Configurar variables de entorno
En **frontend** creá `frontend/.env` (podés copiar de `frontend/.env.example`):
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_GOOGLE_MAPS_API_KEY=tu_clave_api_aqui
```

### 4. Verificar configuración
- Abre http://localhost:3000 en tu navegador
- Ve a un pedido en estado "picked_up"
- Deberías ver el mapa con marcadores y rutas

## 🚀 Tecnologías Utilizadas

### Backend
- **Node.js** con **Express.js** - Servidor web
- **MongoDB** con **Mongoose** - Base de datos
- **JWT** - Autenticación
- **bcrypt** - Encriptación de contraseñas
- **CORS** - Compartir recursos entre dominios
- **express-validator** - Validación de entradas
- **express-rate-limit** - Límite de peticiones
- **Pino** - Logger estructurado

### Frontend
- **React** - Framework de JavaScript
- **React Router** - Enrutamiento
- **Axios** - Cliente HTTP
- **Tailwind CSS** - Framework de CSS

## 📁 Estructura del Proyecto

```
holy-tacos/
├── .env.example             # Variables de entorno (copiar a .env)
├── .github/workflows/ci.yml # CI (tests + build)
├── docker-compose.yml       # Backend + Frontend + MongoDB
├── backend/
│   ├── server.js
│   ├── logger.js
│   ├── middleware/          # auth, rateLimit, validateAuth, upload
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   ├── tests/               # Jest + Supertest
│   ├── Dockerfile
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── config/api.js    # REACT_APP_API_URL centralizado
    │   ├── context/
    │   ├── components/      # ErrorBoundary, LoadingSpinner, ...
    │   └── pages/
    ├── Dockerfile
    ├── nginx.conf
    └── .env.example
```

## 🛠️ Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- MongoDB (local o Atlas)
- npm

### Variables de entorno
- Copiá `.env.example` a `.env` en la raíz (opcional) y en **backend** y **frontend**.
- **Backend** (`backend/.env`): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `STRIPE_*`.
- **Frontend** (`frontend/.env`): `REACT_APP_API_URL=http://localhost:5000`, `REACT_APP_GOOGLE_MAPS_API_KEY`.

### Desarrollo local

**Backend**
```bash
cd backend
npm install
npm run dev   # nodemon
```

**Frontend**
```bash
cd frontend
npm install
npm start     # http://localhost:3000
```

### Con Docker
```bash
# Levantar backend + frontend + MongoDB
docker-compose up --build
# Backend: http://localhost:5000  Frontend: http://localhost:3000
```

### Tests
```bash
cd backend
npm install
npm run test   # Jest + Supertest (auth API)
```
MongoDB debe estar corriendo (local o `MONGODB_URI_TEST`).

## 🌐 Uso

- **Backend:** `http://localhost:5000`
- **Frontend:** `http://localhost:3000`

### Endpoints de API disponibles:
- `GET /` - Página de bienvenida
- `GET /api/estado` - Estado del servidor

## 🚀 Deploy (Vercel + backend en otro servicio)

**Frontend en Vercel** (sí). **Backend en Vercel** (no): Express + Socket.io necesitan un servidor Node que corra todo el tiempo; Vercel es serverless y no mantiene conexiones WebSocket así. Subí el backend a **Railway** o **Render** (gratis) y el front a Vercel.

### Frontend en Vercel
1. [vercel.com](https://vercel.com) → Import Project → conectá tu repo.
2. **Root Directory**: elegí `frontend` (importante en monorepos).
3. **Environment Variables** (en el proyecto de Vercel):
   - `REACT_APP_API_URL` = URL de tu backend en producción (ej. `https://tu-api.railway.app`).
   - `REACT_APP_GOOGLE_MAPS_API_KEY` = tu clave de Google Maps.
4. Deploy. Vercel te da una URL (ej. `https://holy-tacos.vercel.app`).

### Backend en Railway o Render
- **Railway**: New Project → Deploy from GitHub → seleccioná este repo y en Settings poné **Root Directory** = `backend`. Agregá variables: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` = URL de Vercel (ej. `https://holy-tacos.vercel.app`), y las de Stripe si usás.
- **Render**: New → Web Service → repo, **Root Directory** = `backend`, Build = `npm install`, Start = `npm start`. Mismas variables de entorno. En **FRONTEND_URL** poné la URL de Vercel.

Después del primer deploy del backend, copiá su URL y actualizá en Vercel la variable `REACT_APP_API_URL` y volvé a desplegar el front si hace falta. En Google Cloud (Maps) agregá la URL de Vercel en restricciones de la API key.

## 📝 CI (GitHub Actions)
En cada push/PR a `main` o `master` se ejecuta:
- Tests del backend (Jest + Supertest)
- Build del frontend
Requerís MongoDB en el job (el workflow ya lo incluye).

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

---

¡Disfruta desarrollando con Holy Tacos! 🍕🚀