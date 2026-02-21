// Script para actualizar URLs de imágenes relativas a absolutas
// Ejecutar una sola vez para migrar imágenes existentes

const mongoose = require('mongoose');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
require('dotenv').config();

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function updateImageUrls() {
  try {
    console.log('🔄 Iniciando actualización de URLs de imágenes...');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Conectado a MongoDB');

    let updatedUsers = 0;
    let updatedRestaurants = 0;

    // Actualizar fotos de perfil de usuarios
    const users = await User.find({
      profilePicture: { $exists: true, $regex: '^/uploads/' }
    });

    for (const user of users) {
      const oldUrl = user.profilePicture;
      const newUrl = `${BASE_URL}${oldUrl}`;

      await User.findByIdAndUpdate(user._id, {
        profilePicture: newUrl,
        updatedAt: Date.now()
      });

      console.log(`✅ Usuario ${user.email}: ${oldUrl} → ${newUrl}`);
      updatedUsers++;
    }

    // Actualizar documentos de drivers
    const drivers = await User.find({
      'driverProfile.documents': { $exists: true }
    });

    for (const driver of drivers) {
      const updates = {};

      if (driver.driverProfile.documents.licenseFront?.startsWith('/uploads/')) {
        updates['driverProfile.documents.licenseFront'] = `${BASE_URL}${driver.driverProfile.documents.licenseFront}`;
      }

      if (driver.driverProfile.documents.licenseBack?.startsWith('/uploads/')) {
        updates['driverProfile.documents.licenseBack'] = `${BASE_URL}${driver.driverProfile.documents.licenseBack}`;
      }

      if (driver.driverProfile.documents.profileVerification?.startsWith('/uploads/')) {
        updates['driverProfile.documents.profileVerification'] = `${BASE_URL}${driver.driverProfile.documents.profileVerification}`;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Date.now();
        await User.findByIdAndUpdate(driver._id, updates);
        console.log(`✅ Driver ${driver.email}: documentos actualizados`);
        updatedUsers++;
      }
    }

    // Actualizar imágenes de restaurantes (si existen)
    const restaurants = await Restaurant.find({
      image: { $exists: true, $regex: '^/uploads/' }
    });

    for (const restaurant of restaurants) {
      const oldUrl = restaurant.image;
      const newUrl = `${BASE_URL}${oldUrl}`;

      await Restaurant.findByIdAndUpdate(restaurant._id, {
        image: newUrl,
        updatedAt: Date.now()
      });

      console.log(`✅ Restaurante ${restaurant.name}: ${oldUrl} → ${newUrl}`);
      updatedRestaurants++;
    }

    console.log(`\n🎉 Actualización completada:`);
    console.log(`   👥 ${updatedUsers} usuarios actualizados`);
    console.log(`   🏪 ${updatedRestaurants} restaurantes actualizados`);
    console.log(`   🔗 URLs convertidas de relativas a absolutas (${BASE_URL})`);

  } catch (error) {
    console.error('❌ Error actualizando URLs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 Desconectado de MongoDB');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  updateImageUrls();
}

module.exports = { updateImageUrls };