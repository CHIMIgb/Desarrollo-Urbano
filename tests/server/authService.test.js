import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { loginUser, verifyToken, registerUser } = await import('../../server/services/authService.js');

const TEST_USER = { username: '_test_user_', full_name: 'Test User', email: '_test_user_@test.local', password: 'testpass123' };

describe('authService', () => {
  describe('verifyToken()', () => {
    it('debería devolver el payload con un token válido', () => {
      const token = jwt.sign({ id: 1, username: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
      const payload = verifyToken(token);

      expect(payload.id).toBe(1);
      expect(payload.username).toBe('admin');
    });

    it('debería lanzar error 401 con un token inválido', () => {
      expect(() => verifyToken('bad-token')).toThrow('Token inválido');
    });

    it('debería lanzar error 401 con un token expirado', () => {
      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'secret', { expiresIn: '0s' });
      expect(() => verifyToken(token)).toThrow('Token inválido');
    });
  });

  describe('loginUser() — integration', () => {
    beforeAll(async () => {
      try {
        await registerUser(TEST_USER.username, TEST_USER.full_name, TEST_USER.email, TEST_USER.password);
      } catch {
        // user may already exist
      }
    });

    it('debería devolver token y usuario con credenciales válidas', async () => {
      const result = await loginUser(TEST_USER.username, TEST_USER.password);

      expect(result.token).toBeDefined();
      expect(result.user.username).toBe(TEST_USER.username);
    });

    it('debería lanzar error 401 si el usuario no existe', async () => {
      await expect(loginUser('__nonexistent_user__', 'pass')).rejects.toThrow('Credenciales invalidas');
    });

    it('debería lanzar error 401 si la contraseña es incorrecta', async () => {
      await expect(loginUser(TEST_USER.username, 'wrongpassword')).rejects.toThrow('Credenciales invalidas');
    });
  });

  describe('registerUser() — integration', () => {
    it('debería registrar un usuario nuevo y devolver token', async () => {
      const unique = `test_${Date.now()}`;
      const result = await registerUser(unique, 'New User', `${unique}@test.local`, 'pass123');

      expect(result.token).toBeDefined();
      expect(result.user.username).toBe(unique);
    });

    it('debería lanzar error 400 si el usuario ya existe', async () => {
      await expect(
        registerUser(TEST_USER.username, 'Duplicate', 'dup@test.local', 'pass')
      ).rejects.toThrow('El usuario o correo ya está en uso');
    });
  });
});
