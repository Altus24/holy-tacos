// Rutas de perfiles para Holy Tacos
// Maneja todas las operaciones relacionadas con perfiles de usuario
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  uploadProfilePicture,
  uploadDriverDocuments
} = require('../middleware/upload');
const {
  getProfile,
  updateProfile,
  uploadProfilePicture: uploadProfilePictureController,
  uploadDriverDocuments: uploadDriverDocumentsController,
  toggleDriverAvailability,
  updateDriverLocation,
  toggleLocationSharing
} = require('../controllers/profileController');

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// GET /api/profile - Obtener perfil completo del usuario autenticado
router.get('/', getProfile);

// PUT /api/profile - Actualizar perfil del usuario autenticado
router.put('/', updateProfile);

// POST /api/profile/picture - Subir foto de perfil
router.post('/picture', uploadProfilePicture, uploadProfilePictureController);

// POST /api/profile/driver/documents - Subir documentos del conductor
router.post('/driver/documents', uploadDriverDocuments, uploadDriverDocumentsController);

// PUT /api/profile/driver/availability - Cambiar disponibilidad del conductor
router.put('/driver/availability', toggleDriverAvailability);

// PUT /api/profile/driver/location - Actualizar ubicación del conductor
router.put('/driver/location', updateDriverLocation);

// PUT /api/profile/driver/location-sharing - Activar/desactivar compartir ubicación en tiempo real
router.put('/driver/location-sharing', toggleLocationSharing);

module.exports = router;