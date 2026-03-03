// Importación de dependencias necesarias
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const logger = require('./logger');
const { authLimiter, apiLimiter } = require('./middleware/rateLimit');

// Importar modelos
const Restaurant = require('./models/Restaurant');
const User = require('./models/User');
const Order = require('./models/Order');

// Importar rutas
const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const driverRoutes = require('./routes/driverRoutes');

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Crear la aplicación Express
const app = express();

// Crear servidor HTTP para Socket.io
const server = http.createServer(app);

// Normalizar URL del frontend y aceptar con/sin trailing slash (el navegador envía sin barra)
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const allowedOrigins = [frontendOrigin, frontendOrigin + '/'];

// Configurar Socket.io con CORS
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares básicos - permitir origin con o sin trailing slash
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // p. ej. Postman
    const normalized = origin.replace(/\/+$/, '');
    if (normalized === frontendOrigin) return cb(null, true);
    cb(null, false);
  },
  credentials: true
}));
// Rate limit general (después de CORS, antes de rutas)
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// Webhook Stripe: body en bruto para verificar firma (antes de express.json)
const paymentController = require('./controllers/paymentController');
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  paymentController.handleWebhook(req, res);
});
// Parsear JSON en el resto de peticiones
app.use(express.json());

// Middleware para parsear datos de formularios
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Hacer accesible el io desde los controladores (para emitir eventos desde rutas)
app.set('io', io);

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);

// Middleware de autenticación para Socket.io
io.use((socket, next) => {
  try {
    // Obtener token del handshake
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Token de autenticación requerido'));
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adjuntar información del usuario al socket
    socket.userId = decoded.userId;
    socket.userEmail = decoded.email;
    socket.userRole = decoded.role;

    next();
  } catch (error) {
    logger.warn({ err: error.message }, 'Socket auth failed');
    next(new Error('Token inválido'));
  }
});

// Manejo de conexiones Socket.io
io.on('connection', (socket) => {
  logger.info({ email: socket.userEmail, role: socket.userRole }, 'Socket connected');

  // Cada usuario se une a su sala personal para notificaciones dirigidas (por userId)
  socket.join(`user-${socket.userId}`);

  // Los admins se unen a la sala de notificaciones de pedidos
  if (socket.userRole === 'admin') {
    socket.join('admin-orders');
  }

  // Evento para unirse a una sala de pedido específico
  socket.on('joinOrderRoom', (orderId) => {
    try {
      // Verificar que el usuario tenga permisos para este pedido
      const roomName = `order-${orderId}`;
      socket.join(roomName);
      logger.debug({ email: socket.userEmail, room: roomName }, 'Joined order room');
    } catch (error) {
      logger.error({ err: error }, 'Error joining order room');
      socket.emit('error', { message: 'Error al unirse a la sala del pedido' });
    }
  });

  // Evento para actualizar ubicación del driver
  socket.on('updateDriverLocation', async (data) => {
    try {
      const { orderId, lat, lng } = data;

      // Verificar que sea un driver
      if (socket.userRole !== 'driver') {
        socket.emit('error', { message: 'Solo los drivers pueden actualizar ubicación' });
        return;
      }

      // Verificar que el driver esté asignado a este pedido
      const order = await Order.findById(orderId).populate('driverId');
      if (!order || order.driverId._id.toString() !== socket.userId) {
        socket.emit('error', { message: 'No tienes permisos para este pedido' });
        return;
      }

      // Emitir actualización a todos en la sala del pedido
      const roomName = `order-${orderId}`;
      io.to(roomName).emit('driverLocationUpdate', {
        orderId,
        lat,
        lng,
        driverId: socket.userId,
        timestamp: new Date()
      });

      logger.debug({ orderId, lat, lng }, 'Driver location updated');

    } catch (error) {
      logger.error({ err: error }, 'Error updating driver location');
      socket.emit('error', { message: 'Error al actualizar ubicación' });
    }
  });

  // Evento para compartir ubicación en tiempo real (broadcasting general)
  // El driver emite su ubicación periódicamente cuando shareLocation está activo
  socket.on('shareDriverLocation', async (data) => {
    try {
      const { lat, lng } = data;

      // Verificar que sea un driver
      if (socket.userRole !== 'driver') {
        socket.emit('error', { message: 'Solo los drivers pueden compartir ubicación' });
        return;
      }

      // Verificar que el driver tenga shareLocation activado
      const driver = await User.findById(socket.userId).select('driverProfile name phone');
      if (!driver || !driver.driverProfile?.shareLocation) {
        socket.emit('error', { message: 'Compartir ubicación no está activado' });
        return;
      }

      // Actualizar ubicación en la base de datos
      await User.findByIdAndUpdate(socket.userId, {
        'driverProfile.currentLocation': { lat, lng, updatedAt: Date.now() },
        'driverProfile.lastLocationShared': Date.now()
      });

      // Buscar pedidos activos asignados a este driver
      const activeOrders = await Order.find({
        driverId: socket.userId,
        status: { $in: ['assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way'] }
      }).select('_id userId');

      // Payload de ubicación
      const locationPayload = {
        driverId: socket.userId,
        phone: driver.phone || '',
        name: driver.name || '',
        lat,
        lng,
        timestamp: new Date()
      };

      // Emitir a cada sala de pedido activo (los clientes de esos pedidos recibirán la ubicación)
      activeOrders.forEach(order => {
        const roomName = `order-${order._id}`;
        io.to(roomName).emit('driverLocationBroadcast', {
          ...locationPayload,
          orderId: order._id
        });
      });

      // Emitir al canal de admin para monitoreo general
      io.to('admin-tracking').emit('driverLocationBroadcast', locationPayload);

    } catch (error) {
      logger.error({ err: error }, 'Error sharing driver location');
      socket.emit('error', { message: 'Error al compartir ubicación' });
    }
  });

  // Evento para que el admin se una al canal de tracking general
  socket.on('joinAdminTracking', () => {
    if (socket.userRole === 'admin') {
      socket.join('admin-tracking');
      logger.info({ email: socket.userEmail }, 'Admin joined tracking');
    }
  });

  // Evento para salir de una sala
  socket.on('leaveOrderRoom', (orderId) => {
    const roomName = `order-${orderId}`;
    socket.leave(roomName);
    logger.debug({ email: socket.userEmail, room: roomName }, 'Left order room');
  });

  // Manejar desconexión - limpiar shareLocation si el driver se desconecta
  socket.on('disconnect', async () => {
    logger.info({ email: socket.userEmail }, 'Socket disconnected');

    // Si es un driver, desactivar shareLocation automáticamente
    if (socket.userRole === 'driver') {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          'driverProfile.shareLocation': false
        });
      } catch (error) {
        logger.error({ err: error }, 'Error clearing shareLocation on disconnect');
      }
    }
  });
});

// Puerto del servidor (desde variables de entorno o 5000 por defecto)
const PORT = process.env.PORT || 5000;

// Función para conectar a MongoDB
const conectarDB = async () => {
  try {
    // Conectar a MongoDB usando la URI del archivo .env
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');

    // Inicializar datos de prueba
    await inicializarDatos();
  } catch (error) {
    logger.fatal({ err: error.message }, 'MongoDB connection failed');
    // Salir del proceso si no se puede conectar a la base de datos
    process.exit(1);
  }
};

// Función para inicializar datos de prueba (seeds)
const inicializarDatos = async () => {
  try {
    // Verificar si ya existen restaurantes
    const restaurantesExistentes = await Restaurant.countDocuments();

    if (restaurantesExistentes === 0) {
      logger.info('Seeding initial data...');

      // Datos de prueba para restaurantes
      const restaurantesMock = [
        {
          name: 'Taco Loco',
          address: 'Av. Principal 123, Centro',
          phone: '+52 55 1234 5678',
          menu: [
            { name: 'Taco de Carnitas', price: 45, description: 'Taco con carnitas de cerdo, cebolla y cilantro', category: 'plato principal' },
            { name: 'Taco de Pastor', price: 40, description: 'Taco al pastor con piña, cebolla y cilantro', category: 'plato principal' },
            { name: 'Quesadilla', price: 35, description: 'Quesadilla de queso con guacamole', category: 'plato principal' },
            { name: 'Agua de Horchata', price: 20, description: 'Refresco tradicional de arroz', category: 'bebida' },
            { name: 'Churros', price: 25, description: 'Postre tradicional mexicano', category: 'postre' }
          ]
        },
        {
          name: 'Burritos Express',
          address: 'Calle Secundaria 456, Zona Norte',
          phone: '+52 55 9876 5432',
          menu: [
            { name: 'Burrito California', price: 65, description: 'Burrito con carne asada, frijoles y queso', category: 'plato principal' },
            { name: 'Burrito Vegetariano', price: 55, description: 'Burrito con vegetales, frijoles y queso', category: 'plato principal' },
            { name: 'Enchiladas Rojas', price: 50, description: 'Enchiladas con salsa roja y queso', category: 'plato principal' },
            { name: 'Agua de Jamaica', price: 18, description: 'Refresco de flor de jamaica', category: 'bebida' },
            { name: 'Flan Napolitano', price: 30, description: 'Postre de flan tradicional', category: 'postre' }
          ]
        },
        {
          name: 'Pozole Palace',
          address: 'Plaza Mayor 789, Centro Histórico',
          phone: '+52 55 5555 1234',
          menu: [
            { name: 'Pozole Rojo', price: 70, description: 'Pozole tradicional con maíz, carne y condimentos', category: 'plato principal' },
            { name: 'Pozole Verde', price: 75, description: 'Pozole con salsa verde y pollo', category: 'plato principal' },
            { name: 'Tamales de Elote', price: 35, description: 'Tamales dulces de elote', category: 'entrada' },
            { name: 'Atole de Chocolate', price: 22, description: 'Bebida caliente de chocolate', category: 'bebida' },
            { name: 'Pastel de Tres Leches', price: 35, description: 'Pastel tradicional de tres leches', category: 'postre' }
          ]
        }
      ];

      // Insertar restaurantes de prueba
      await Restaurant.insertMany(restaurantesMock);
      logger.info({ count: restaurantesMock.length }, 'Restaurants seeded');

      // Crear usuario administrador de prueba
      const adminExistente = await User.findOne({ role: 'admin' });
      if (!adminExistente) {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await User.create({
          email: 'admin@holy-tacos.com',
          password: hashedPassword,
          role: 'admin'
        });
        logger.info('Admin user created (admin@holy-tacos.com)');
      }

      logger.info('Initial data seeded');
    } else {
      logger.debug({ count: restaurantesExistentes }, 'Restaurants already exist');
    }
  } catch (error) {
    logger.error({ err: error }, 'Seed failed');
  }
};

// Rutas básicas de la API
// Ruta de prueba para verificar que el servidor funciona
app.get('/', (req, res) => {
  res.json({
    mensaje: '🍕 ¡Bienvenido a Holy Tacos API!',
    estado: 'Servidor funcionando correctamente',
    version: '1.0.0',
    rutas_disponibles: {
      autenticacion: 'POST /api/auth/register, POST /api/auth/login, POST /api/auth/verify',
      restaurantes: 'GET /api/restaurants, POST /api/restaurants (admin)',
      usuarios: 'GET /api/users/profile, GET /api/users (admin)',
      pedidos: 'GET /api/orders, POST /api/orders',
      pagos: 'POST /api/payment/create-session, POST /api/payment/confirm, GET /api/payment/test-card'
    },
    documentacion: 'API completa para plataforma de delivery de comida'
  });
});

// Ruta de estado para verificar conexión con la base de datos
app.get('/api/estado', (req, res) => {
  res.json({
    estado: 'OK',
    mensaje: 'API de Holy Tacos operativa',
    timestamp: new Date().toISOString()
  });
});

// Middleware para manejar rutas no encontradas (404)
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    mensaje: 'La ruta solicitada no existe en esta API'
  });
});

// Middleware para manejo de errores global
app.use((error, req, res, next) => {
  logger.error({ err: error }, 'Unhandled error');
  res.status(500).json({
    error: 'Error interno del servidor',
    mensaje: 'Ha ocurrido un error inesperado'
  });
});

// Función principal para iniciar el servidor
const iniciarServidor = async () => {
  try {
    // Conectar a la base de datos primero
    await conectarDB();

    // Iniciar el servidor en el puerto especificado
    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'Server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Server start failed');
    process.exit(1);
  }
};

// Iniciar la aplicación
iniciarServidor();