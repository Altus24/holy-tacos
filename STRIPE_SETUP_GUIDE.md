# 🚀 Guía Completa de Configuración de Stripe para Holy Tacos

Esta guía te ayudará a configurar completamente Stripe para procesar pagos en la plataforma Holy Tacos.

## 📋 Requisitos Previos

- Cuenta de Holy Tacos funcionando
- Node.js y npm instalados
- Conocimientos básicos de terminal/comandos

## 🔧 Paso 1: Crear Cuenta en Stripe

### 1.1 Registrarse en Stripe
1. Ve a [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Crea una cuenta nueva (o inicia sesión si ya tienes una)
3. Completa la información de tu negocio:
   - **Tipo de negocio**: Individual/Compañía
   - **País**: México (o tu país)
   - **Nombre del negocio**: Holy Tacos
   - **Sitio web**: `http://localhost:3000` (para desarrollo)
   - **Industria**: Food & Dining / Restaurant

### 1.2 Verificar tu cuenta
1. Stripe te enviará un email de verificación
2. Completa la verificación de identidad (puede tomar 24-48 horas para aprobación completa)
3. **IMPORTANTE**: Para desarrollo, puedes usar el modo "test" sin verificación completa

## 🛠️ Paso 2: Configurar Claves API



## 🌐 Paso 3: Configurar Webhooks

Los webhooks permiten que Stripe notifique a tu servidor cuando ocurren eventos de pago.

### 3.1 Crear webhook endpoint
1. En el Dashboard de Stripe, ve a **Developers** → **Webhooks**
2. Haz clic en **"Add endpoint"**
3. Configura:
   - **Endpoint URL**: `http://localhost:5000/api/payment/webhook`
   - **Events to listen for**:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

### 3.2 Obtener el webhook secret
1. Después de crear el webhook, copia el **Signing secret** (whsec_...)
2. Pégalo en tu archivo `.env` del backend:
```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

## 🚀 Paso 4: Probar la Integración

### 4.1 Iniciar los servidores
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 4.2 Probar un pago
1. Ve a `http://localhost:3000`
2. Inicia sesión como cliente
3. Agrega productos al carrito
4. Ve al checkout
5. Completa la dirección de entrega
6. Haz clic en "Proceder al Pago Seguro"
7. Serás redirigido a Stripe
8. Usa tarjetas de prueba:
   - **Número**: `4242 4242 4242 4242`
   - **Fecha**: Cualquier fecha futura (MM/YY)
   - **CVC**: `123`
   - **Nombre**: Cualquier nombre
9. Haz clic en "Pagar"
10. Serás redirigido a la página de éxito

### 4.3 Verificar en el dashboard
1. Ve al Dashboard de Stripe → **Payments**
2. Deberías ver el pago completado en modo "test"

### 4.4 Verificar que el webhook actualiza la orden (paymentStatus = 'paid')
1. Tras completar un pago con tarjeta `4242 4242 4242 4242`, revisa la terminal del backend.
2. Deberías ver: `Webhook recibido: checkout.session.completed` y `✅ Pago completado para orden <id>`.
3. Si no aparece: en desarrollo, usa **Stripe CLI** para reenviar eventos a tu localhost:
   ```bash
   stripe listen --forward-to localhost:5000/api/payment/webhook
   ```
   Copia el `whsec_...` que muestra y ponlo en tu `.env` como `STRIPE_WEBHOOK_SECRET`.
4. Prueba con: `stripe trigger checkout.session.completed` (o crea un pago real desde la app).

### 4.5 Verificar que el panel admin solo muestra órdenes pagadas
1. Crea una orden y **no** completes el pago (cierra la ventana de Stripe o cancela).
2. Entra al panel admin → Gestión de Órdenes. Esa orden **no** debe aparecer en "Pendientes" ni "Activas".
3. Haz clic en la pestaña **"Pendientes de pago"**: ahí debe aparecer la orden sin pagar.
4. Completa el pago con Stripe (tarjeta 4242...) y vuelve a Gestión de Órdenes. La orden debe aparecer en "Pendientes" (lista para asignar driver).

## 🎯 Funcionalidades Implementadas

### Backend
- ✅ **Payment Intents API** con Checkout Sessions
- ✅ **Webhook handling** para eventos de pago
- ✅ **Actualización automática** del estado de órdenes
- ✅ **Validación de usuarios** y permisos
- ✅ **Manejo de errores** completo

### Frontend
- ✅ **Stripe Checkout** (sin manejo de tarjetas en frontend)
- ✅ **Redirección segura** a Stripe
- ✅ **Página de éxito** después del pago
- ✅ **Validación de formularios**
- ✅ **Manejo de estados** de carga y error

## 🔒 Seguridad Implementada

- ✅ **Claves API restringidas** por dominio
- ✅ **Webhook signatures** verificadas
- ✅ **Autenticación JWT** requerida
- ✅ **Validación de usuarios** en cada endpoint
- ✅ **No storage de datos de tarjetas** (Stripe los maneja)

## 💰 Costos y Límites

### Modo Test (Gratuito)
- Sin límites de transacciones
- Sin costos
- Solo para desarrollo/pruebas

### Modo Live (Producción)
- **Pagos exitosos**: 2.9% + $2.50 MXN por transacción
- **Transferencias**: Sin costo adicional (Stripe maneja automáticamente)
- **Webhooks**: Sin costo
- **Soporte**: Incluido básico

## 🔧 Solución de Problemas

### Error: "Invalid API Key"
- Verifica que las claves en `.env` sean correctas
- Asegúrate de usar claves de TEST, no LIVE

### Error: "Webhook signature verification failed"
- Verifica que el `STRIPE_WEBHOOK_SECRET` sea correcto (el que te da Stripe CLI o el Dashboard para ese endpoint).
- El endpoint del webhook debe recibir el **body en bruto** (sin parsear como JSON). En esta app está registrado en `server.js` **antes** de `express.json()` para que la firma sea válida.
- En local, usa Stripe CLI: `stripe listen --forward-to localhost:5000/api/payment/webhook` y usa el secret que muestra.

### Error: "No such payment_intent"
- Verifica que el webhook esté configurado correctamente
- Revisa los logs del servidor para eventos webhook

### Pago no se completa
- Verifica que el servidor esté corriendo en el puerto 5000
- Revisa la consola del navegador para errores
- Verifica que las URLs de éxito/cancelación sean correctas

## 📊 Monitoreo y Logs

### Ver logs de Stripe
1. Dashboard → **Developers** → **Logs**
2. Filtra por "Payment Intents" o "Checkout Sessions"

### Ver logs del servidor
```bash
# Los logs aparecerán en la terminal donde corre el backend
# Busca mensajes como:
# 💳 Sesión de checkout creada...
# ✅ Pago completado para orden...
```

## 🎉 Próximos Pasos

Una vez configurado y probado:

1. **Configurar dominio de producción**
2. **Actualizar URLs de webhook** para producción
3. **Obtener claves LIVE** (reemplazar las de TEST)
4. **Configurar transferencias** a tu cuenta bancaria
5. **Implementar reintentos** de pago fallidos
6. **Agregar notificaciones** por email/SMS

## 📞 Soporte

- **Documentación de Stripe**: [https://stripe.com/docs](https://stripe.com/docs)
- **Dashboard de soporte**: Dashboard → Help
- **Comunidad**: [https://stripe.com/community](https://stripe.com/community)

¡Tu integración de Stripe está lista! 🎊</contents>
</xai:function_call">Wrote contents to STRIPE_SETUP_GUIDE.md