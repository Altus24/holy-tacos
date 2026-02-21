/**
 * Tests de API de autenticación (register, login, verify)
 * Ejecutar con: npm run test
 * Requiere MONGODB_URI (puede ser mongodb://localhost:27017/holy-tacos-test)
 */
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Cargar env para JWT_SECRET
require('dotenv').config();

// Crear app Express mínima con solo rutas de auth (evitar conectar DB real en server completo)
const express = require('express');
const authRoutes = require('../routes/auth');
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const User = require('../models/User');

const TEST_EMAIL = `test-${Date.now()}@test.com`;
const TEST_PASSWORD = 'password123';

describe('Auth API', () => {
  beforeAll(async () => {
    const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017/holy-tacos-test';
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await User.deleteOne({ email: TEST_EMAIL }).catch(() => {});
    await mongoose.disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('debe rechazar email inválido', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid', password: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('debe rechazar contraseña corta', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'a@b.com', password: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('debe registrar usuario y devolver token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD, role: 'client' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.email).toBe(TEST_EMAIL);
    });

    it('debe rechazar email duplicado', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: TEST_EMAIL, password: 'otherpass' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('debe rechazar sin email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: '123456' });
      expect(res.status).toBe(400);
    });

    it('debe rechazar credenciales incorrectas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('debe hacer login y devolver token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('POST /api/auth/verify', () => {
    it('debe rechazar sin token', async () => {
      const res = await request(app).post('/api/auth/verify').send({});
      expect(res.status).toBe(400);
    });

    it('debe aceptar token válido', async () => {
      const user = await User.findOne({ email: TEST_EMAIL });
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const res = await request(app).post('/api/auth/verify').send({ token });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(TEST_EMAIL);
    });
  });
});
