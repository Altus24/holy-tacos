// Rutas específicas para conductores: conteos y lista filtrada de pedidos
const express = require('express');
const { authenticateToken, requireDriver } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

// GET /api/driver/orders/counts → { assigned, completedToday, completedTotal }
router.get('/orders/counts', authenticateToken, requireDriver, orderController.getDriverOrderCounts);

// GET /api/driver/orders?status=assigned|completed|all → lista de pedidos del conductor
router.get('/orders', authenticateToken, requireDriver, orderController.getDriverOrders);

// PUT /api/driver/orders/:id/arrived → marcar que el driver llegó al restaurante
// Internamente reutiliza la lógica de updateStatus con estado 'at_restaurant'
router.put('/orders/:id/arrived', authenticateToken, requireDriver, (req, res) => {
  req.body.status = 'at_restaurant';
  return orderController.updateStatus(req, res);
});

module.exports = router;
