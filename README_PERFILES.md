# Sistema de Perfiles de Holy Tacos

## 📋 Descripción

Este documento describe el sistema completo de perfiles implementado para Holy Tacos, que permite gestionar información diferenciada para Clientes, Conductores y Administradores.

## 🏗️ Arquitectura

### Backend

#### Modelo de Usuario Extendido
- **Campos comunes**: `name`, `phone`, `profilePicture`
- **Clientes**: `clientProfile` con direcciones, favoritos y preferencias dietéticas
- **Conductores**: `driverProfile` con vehículo, licencia, documentos y disponibilidad

#### Rutas de API
```
GET    /api/profile              # Obtener perfil completo
PUT    /api/profile              # Actualizar perfil
POST   /api/profile/picture      # Subir foto de perfil
POST   /api/profile/driver/documents  # Subir documentos del conductor
PUT    /api/profile/driver/availability  # Cambiar disponibilidad
PUT    /api/profile/driver/location     # Actualizar ubicación
```

#### Middleware de Upload
- **multer** para manejo de archivos
- **Validación** de tipos y tamaños
- **Almacenamiento** en `backend/uploads/`
- **URLs relativas** para acceso desde el frontend

### Frontend

#### Páginas
- **`/profile`**: Vista completa del perfil
- **`/profile/edit`**: Formulario de edición

#### Componentes
- **ProfileHeader**: Foto, nombre, rol y estado
- **ClientProfileForm**: Direcciones, favoritos, preferencias
- **DriverProfileForm**: Vehículo, licencia, documentos, zonas
- **AddressForm**: Gestión de direcciones (reutilizable)
- **FileUploader**: Upload con preview y validación

## 🚀 Funcionalidades por Rol

### 👤 Cliente
- ✅ **Información personal**: Nombre, teléfono, foto de perfil
- ✅ **Direcciones**: Predeterminada + guardadas adicionales
- ✅ **Restaurantes favoritos**: Lista de preferidos
- ✅ **Preferencias dietéticas**: Vegano, sin gluten, etc.

### 🏍️ Conductor
- ✅ **Información personal**: Nombre, teléfono, foto de perfil
- ✅ **Vehículo**: Tipo, marca, modelo, placa, color
- ✅ **Licencia**: Número y fecha de expiración
- ✅ **Documentos**: Licencia (frente/reverso) + verificación
- ✅ **Zonas de trabajo**: Áreas donde opera
- ✅ **Disponibilidad**: Toggle online/offline
- ✅ **Estadísticas**: Calificación, entregas totales

### 👑 Administrador
- ✅ **Información básica**: Nombre, teléfono, foto de perfil
- ✅ **Acceso especial**: Panel de administración

## 📁 Estructura de Archivos

```
backend/
├── models/User.js                    # Modelo extendido
├── routes/profileRoutes.js          # Rutas de perfil
├── controllers/profileController.js # Lógica de perfiles
├── middleware/upload.js             # Configuración multer
└── uploads/                         # Archivos subidos

frontend/
├── pages/
│   ├── Profile.js                   # Vista de perfil
│   └── EditProfile.js               # Edición de perfil
└── components/
    ├── Profile/
    │   ├── ProfileHeader.js         # Header con foto
    │   ├── ClientProfileForm.js     # Form cliente
    │   └── DriverProfileForm.js     # Form conductor
    ├── AddressForm.js               # Gestión direcciones
    └── FileUploader.js              # Upload archivos
```

## 🔧 Instalación y Configuración

### 1. Backend
```bash
cd backend
npm install multer
mkdir uploads
```

### 2. Variables de Entorno
Asegurarse de que estén configuradas:
```env
FRONTEND_URL=http://localhost:3000
# Otras variables ya existentes
```

### 3. Inicio
```bash
# Backend
cd backend && npm run dev

# Frontend (nueva terminal)
cd frontend && npm start
```

## 📖 Uso

### Acceso a Perfiles
1. **Navegar** a `/profile` (requiere login)
2. **Ver información** completa según rol
3. **Editar** haciendo clic en "Editar Perfil"
4. **Subir archivos** usando los componentes FileUploader
5. **Guardar cambios** con validación automática

### Gestión de Direcciones (Clientes)
- **Agregar**: Botón "+" en "Direcciones guardadas"
- **Editar**: Click en dirección existente
- **Eliminar**: Botón de eliminar en cada dirección
- **Predeterminada**: Checkbox al guardar

### Documentos de Conductores
- **Licencia**: Frente y reverso por separado
- **Verificación**: Foto adicional (selfie/documento)
- **Vista previa**: Imágenes se muestran después de subir
- **Validación**: Solo imágenes, máximo 10MB

## 🔒 Seguridad

- ✅ **Autenticación requerida** para todas las rutas
- ✅ **Validación de propietario** de perfil
- ✅ **Validación de archivos** (tipo, tamaño)
- ✅ **Permisos por rol** en operaciones sensibles

## 🎨 UI/UX

- ✅ **Responsive**: Funciona en móvil y desktop
- ✅ **Dark mode**: Compatible con tema oscuro
- ✅ **Loading states**: Indicadores durante operaciones
- ✅ **Mensajes de error**: Feedback claro al usuario
- ✅ **Validaciones**: En tiempo real con react-hook-form

## 🔄 Próximos Pasos

### Migración a Producción
1. **Cloudinary** para archivos:
   ```javascript
   // En upload.js, reemplazar:
   getFileUrl: (filename) => `https://api.cloudinary.com/v1_1/tu-cuenta/upload`
   ```

2. **Base de datos**: Los campos nuevos se agregan automáticamente

3. **Backup**: Crear script para backup de archivos en uploads/

### Mejoras Futuras
- ✅ **Geolocalización** automática para direcciones
- ✅ **Verificación de documentos** automática con IA
- ✅ **Historial de cambios** en perfiles
- ✅ **Notificaciones** de cambios importantes

## 🐛 Solución de Problemas

### Archivos no se suben
```bash
# Verificar permisos
ls -la backend/uploads/

# Crear directorio si no existe
mkdir -p backend/uploads
```

### Errores de validación
- **Teléfono**: Debe seguir formato internacional (+549123456789)
- **Archivos**: Solo JPEG, PNG, GIF (imágenes) y PDF
- **Tamaño**: Máximo 5MB fotos, 10MB documentos

### Problemas de permisos
- Asegurar que el usuario del servidor pueda escribir en `uploads/`
- En producción, configurar correctamente los permisos del directorio

## 📞 Soporte

Para problemas específicos:
1. **Revisar logs** del backend
2. **Verificar red** entre frontend y backend
3. **Validar tokens** JWT no expirados
4. **Comprobar permisos** de archivos

---

*Sistema implementado con perfiles completos y diferenciados para una experiencia personalizada por rol.* 🎉