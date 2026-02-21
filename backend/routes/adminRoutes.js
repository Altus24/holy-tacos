// Rutas de administración para Holy Tacos
const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const orderController = require('../controllers/orderController');

const router = express.Router();

// Todas las rutas requieren autenticación de admin
router.use(authenticateToken, requireAdmin);

// GET /api/admin/dashboard - Estadísticas del dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Gestión de Drivers (counts antes de :id para que "counts" no se interprete como id)
router.get('/drivers/counts', adminController.getDriverCounts);
router.get('/drivers', adminController.getAllDrivers);
router.get('/drivers/:id', adminController.getDriverById);
router.put('/drivers/:id/verify', adminController.verifyDriver);
router.put('/drivers/:id/availability', adminController.toggleDriverAvailability);
router.put('/drivers/:id/status', adminController.toggleDriverStatus);
router.put('/drivers/:id/profile', adminController.updateDriverProfile);
router.delete('/drivers/:id', adminController.deleteDriver);

// Gestión de Restaurantes
router.get('/restaurants', adminController.getAllRestaurants);
router.get('/restaurants/:id/status', adminController.getRestaurantStatus);
router.post('/restaurants', adminController.createRestaurant);
router.put('/restaurants/:id', adminController.updateRestaurant);
router.put('/restaurants/:id/status', adminController.toggleRestaurantStatus);
router.delete('/restaurants/:id', adminController.deleteRestaurant);

// Gestión de Órdenes
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:id/cancel', adminController.cancelOrderByAdmin);
// Asignar conductor (pending → assigned). Notifica al driver.
router.put('/orders/:id/assign-driver', orderController.assignDriver);
// Marcar pedido listo para recoger (assigned | heading_to_restaurant → ready_for_pickup). Notifica al driver.
router.put('/orders/:id/ready', orderController.setReadyForPickup);

module.exports = router;