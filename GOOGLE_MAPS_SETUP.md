# 🗺️ Configuración Completa de Google Maps APIs para Holy Tacos

Este documento proporciona instrucciones detalladas para configurar todas las APIs de Google Maps necesarias para el sistema de tracking GPS en tiempo real.

## 📋 APIs Requeridas

Para el funcionamiento completo del sistema de tracking GPS, necesitas habilitar las siguientes APIs en Google Cloud Console:

### 1. Maps JavaScript API
- **Propósito:** Mostrar mapas interactivos en el frontend
- **Uso en código:** Componente `MapTracker` para renderizar mapas

### 2. Directions API
- **Propósito:** Calcular rutas y direcciones entre dos puntos
- **Uso en código:** Calcular ruta óptima desde ubicación del driver hasta dirección de entrega

### 3. Geocoding API
- **Propósito:** Convertir direcciones de texto a coordenadas lat/lng
- **Uso en código:** Convertir direcciones del restaurante y cliente a coordenadas GPS

## 🚀 Guía Paso a Paso

### Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Si no tienes una cuenta, crea una gratuita
3. Haz clic en "Seleccionar un proyecto" (arriba a la izquierda)
4. Haz clic en "Nuevo proyecto"
5. Nombra tu proyecto (ej: "holy-tacos-delivery")
6. Selecciona la organización (o deja en "Sin organización")
7. Haz clic en "Crear"

### Paso 2: Habilitar APIs

1. En el menú lateral izquierdo, ve a "APIs y servicios" → "Biblioteca"
2. Busca y habilita cada una de las siguientes APIs:

#### Maps JavaScript API
- Busca: "Maps JavaScript API"
- Haz clic en el resultado
- Haz clic en "Habilitar"

#### Directions API
- Busca: "Directions API"
- Haz clic en el resultado
- Haz clic en "Habilitar"

#### Geocoding API
- Busca: "Geocoding API"
- Haz clic en el resultado
- Haz clic en "Habilitar"

### Paso 3: Crear Credenciales (Clave API)

1. En el menú lateral, ve a "APIs y servicios" → "Credenciales"
2. Haz clic en "Crear credenciales" (arriba)
3. Selecciona "Clave API"
4. **IMPORTANTE:** Google generará una clave API. **Cópiala inmediatamente** ya que no podrás verla de nuevo.

### Paso 4: Configurar Restricciones de Seguridad

**⚠️ IMPORTANTE:** Nunca uses una clave API sin restricciones en producción. Esto puede generar costos elevados.

1. En la página de "Credenciales", haz clic en el nombre de tu clave API (termina en "...")
2. En la sección "Restricciones de aplicaciones":
   - Selecciona "Sitios web (para uso desde navegadores web)"
   - En "Sitios web" agrega:
     - `http://localhost:3000` (desarrollo)
     - `http://localhost:5000` (desarrollo)
     - Agrega también tu dominio de producción cuando esté listo

3. En la sección "Restricciones de API":
   - Selecciona "Restringir clave"
   - Marca solo estas 3 APIs:
     - Maps JavaScript API
     - Directions API
     - Geocoding API

4. Haz clic en "Guardar"

### Paso 5: Configurar Variables de Entorno

1. En tu proyecto Holy Tacos, abre el archivo `backend/.env`
2. Agrega la siguiente línea:
```env
REACT_APP_GOOGLE_MAPS_API_KEY=tu_clave_api_aqui
```
(Reemplaza `tu_clave_api_aqui` con tu clave API real)

### Paso 6: Verificar la Configuración

1. Reinicia tus servidores:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm start
```

2. Abre http://localhost:3000 en tu navegador

3. Crea un pedido de prueba y asígnalo a un driver

4. Cambia el estado del pedido a "picked_up"

5. Ve a la página de tracking del cliente (`/orders/:orderId`) o del driver (`/driver/orders/:orderId`)

6. Deberías ver:
   - Mapa centrado en la zona de entrega
   - Marcadores para restaurante (🏪), cliente (🏠) y driver (🚗)
   - Ruta azul calculada automáticamente
   - Información de ETA y distancia

## 💰 Costos y Límites

### Límites Gratuitos (por mes):
- **Maps JavaScript API:** 28,500 cargas de mapa
- **Directions API:** 40,000 solicitudes
- **Geocoding API:** 40,000 solicitudes

### Costos aproximados (después del límite gratuito):
- **Maps JavaScript API:** $7 por cada 1,000 cargas adicionales
- **Directions API:** $5 por cada 1,000 solicitudes adicionales
- **Geocoding API:** $5 por cada 1,000 solicitudes adicionales

### Optimizaciones implementadas:
- ✅ Geocoding solo cuando es necesario (cache implícito en el componente)
- ✅ Solicitudes de Directions solo cuando el pedido está en tránsito
- ✅ Actualización de ubicación del driver cada 8 segundos (no sobrecarga)
- ✅ Rooms de Socket.io para broadcasting eficiente

## 🔧 Solución de Problemas

### Error: "This API project is not authorized to use this API"
- Verifica que hayas habilitado todas las 3 APIs requeridas
- Confirma que la clave API no tenga restricciones incorrectas

### Error: "The provided key is not a valid Google API Key"
- Verifica que la clave API esté correctamente copiada en el archivo `.env`
- Asegúrate de que no haya espacios extra o caracteres invisibles

### Mapa no se carga
- Verifica que las restricciones de dominio incluyan `localhost:3000`
- Confirma que todas las APIs estén habilitadas
- Revisa la consola del navegador para errores específicos

### Geocoding falla
- Verifica que la dirección esté bien formateada
- Algunas direcciones pueden no tener coordenadas exactas
- Considera usar coordenadas manuales para testing

### GPS del driver no funciona
- El navegador debe tener permisos de ubicación
- Solo funciona en HTTPS en producción
- Algunos navegadores bloquean geolocalización por defecto

## 📱 Testing en Dispositivos Móviles

Para probar el GPS en dispositivos móviles:

1. **Desarrollo local:**
   - Conecta tu dispositivo móvil a la misma red WiFi que tu computadora
   - Encuentra la IP local de tu computadora (`ipconfig` en Windows)
   - Cambia las restricciones de la clave API para incluir tu IP local
   - Accede desde el navegador móvil: `http://tu-ip-local:3000`

2. **Producción:**
   - Implementa HTTPS (requerido para geolocalización)
   - Configura las restricciones de dominio para tu dominio de producción

## 🎯 Funcionalidades del Sistema

### Para Clientes:
- Ver mapa en tiempo real de la ubicación del conductor
- Recibir notificaciones cuando cambia el estado del pedido
- Ver ETA y distancia estimada
- Visualizar la ruta calculada automáticamente

### Para Conductores:
- Compartir ubicación GPS automáticamente cada 8 segundos
- Ver mapa con ruta óptima hacia el destino
- Actualizar estado del pedido (aceptado → en preparación → listo → en camino → entregado)
- Recibir nuevos pedidos asignados en tiempo real

### Para Administradores:
- Asignar pedidos a conductores disponibles
- Ver estadísticas de pedidos en tiempo real
- Gestionar toda la plataforma desde un dashboard centralizado

## 🔐 Seguridad

- ✅ Claves API restringidas por dominio
- ✅ Autenticación JWT para todas las operaciones
- ✅ Control de roles (cliente/driver/admin)
- ✅ Validación de permisos para ver/compartir ubicaciones
- ✅ Rooms de Socket.io para aislamiento de datos

¡El sistema de tracking GPS está listo para usar! 🚀</contents>
</xai:function_call">Wrote contents to GOOGLE_MAPS_SETUP.md