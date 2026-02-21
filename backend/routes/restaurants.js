// Rutas para gestión de restaurantes en Holy Tacos
const express = require('express');
const Restaurant = require('../models/Restaurant');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/restaurants - Obtener lista de restaurantes
// Query: ?active=true → solo activos y se incluye location (para mapa del conductor)
router.get('/', async (req, res) => {
  try {
    const onlyActive = req.query.active === 'true';
    const filter = onlyActive ? { isActive: true } : { isActive: true };
    const select = onlyActive
      ? 'name address phone menu location'
      : 'name address phone menu';
    const restaurants = await Restaurant.find(filter)
      .select(select)
      .sort({ name: 1 })
      .limit(onlyActive ? 200 : 500)
      .lean();

    res.json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('Error al obtener restaurantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de restaurantes'
    });
  }
});

// GET /api/restaurants/nearby?lat=XX&lng=YY&radius=KK - Restaurantes cercanos (query geoespacial)
// Para conductores: ver restaurantes cerca de su posición. radius en km (default 15).
router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = Math.min(Math.max(parseFloat(req.query.radius) || 15, 1), 50);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros lat y lng son obligatorios y deben ser números válidos'
      });
    }

    // Consulta geoespacial: restaurantes activos dentro del radio (índice 2dsphere)
    const restaurants = await Restaurant.find({
      isActive: true,
      location: {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusKm / 6378.1]
        }
      }
    })
      .select('name address phone location')
      .limit(50)
      .lean();

    res.json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('Error al obtener restaurantes cercanos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener restaurantes cercanos'
    });
  }
});

// GET /api/restaurants/:id - Obtener detalles de un restaurante específico
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    console.error('Error al obtener restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el restaurante'
    });
  }
});

// POST /api/restaurants - Crear un nuevo restaurante (solo para administradores)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, address, phone, menu } = req.body;

    // Validar datos requeridos
    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y dirección son obligatorios'
      });
    }

    // Crear el restaurante
    const restaurant = new Restaurant({
      name,
      address,
      phone,
      menu: menu || []
    });

    const nuevoRestaurant = await restaurant.save();

    res.status(201).json({
      success: true,
      message: 'Restaurante creado exitosamente',
      data: nuevoRestaurant
    });
  } catch (error) {
    console.error('Error al crear restaurante:', error);

    // Manejar errores de validación
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear el restaurante'
    });
  }
});

// PUT /api/restaurants/:id - Actualizar un restaurante (solo para administradores)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, address, phone, menu, isActive } = req.body;

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { name, address, phone, menu, isActive, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Restaurante actualizado exitosamente',
      data: restaurant
    });
  } catch (error) {
    console.error('Error al actualizar restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el restaurante'
    });
  }
});

// DELETE /api/restaurants/:id - Desactivar un restaurante (soft delete)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Restaurante desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error al desactivar restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar el restaurante'
    });
  }
});

module.exports = router;