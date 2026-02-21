/**
 * Script para eliminar TODAS las órdenes de clientes.
 * Los contadores (admin, driver) se calculan con countDocuments, así que quedarán en 0.
 * Ejecutar desde la carpeta backend: node scripts/delete-all-orders.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

async function deleteAllOrders() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI no está definida en .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Conectado a MongoDB');

    const result = await Order.deleteMany({});
    console.log(`✅ Eliminadas ${result.deletedCount} órdenes. Los contadores quedan en 0.`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
    process.exit(0);
  }
}

deleteAllOrders();
