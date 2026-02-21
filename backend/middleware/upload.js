// Middleware de upload para Holy Tacos
// Maneja la subida de archivos usando multer
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  // Directorio donde se guardarán los archivos
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },

  // Nombre del archivo (timestamp + extensión original)
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Filtro para validar tipos de archivos
const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;

  // Verificar extensión del archivo
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  // Verificar mimetype
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, GIF) y PDF'));
  }
};

// Configuración de multer para foto de perfil (single file)
const uploadProfilePicture = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
}).single('profilePicture');

// Configuración de multer para documentos del conductor (multiple files)
const uploadDriverDocuments = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo por archivo
  }
}).fields([
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'profileVerification', maxCount: 1 }
]);

// Función helper para obtener la URL completa del archivo
const getFileUrl = (filename) => {
  if (!filename) return null;

  // Obtener la URL base del backend
  const baseUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:5000';

  // Retornar URL absoluta que apunte al backend donde están servidos los archivos
  return `${baseUrl}/uploads/${filename}`;

  // Para desarrollo local alternativo:
  // return `/uploads/${filename}`;

  // Para producción con servicios externos como Cloudinary:
  // const cloudinaryUrl = process.env.CLOUDINARY_BASE_URL;
  // return cloudinaryUrl ? `${cloudinaryUrl}/uploads/${filename}` : `${baseUrl}/uploads/${filename}`;
};

module.exports = {
  uploadProfilePicture,
  uploadDriverDocuments,
  getFileUrl
};