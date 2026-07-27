import { describe, it, expect } from 'vitest';
import {
  AppError,
  NetworkError,
  APIError,
  ValidationError,
  StorageError,
} from '../../src/utils/errors.js';

describe('AppError hierarchy', () => {
  it('AppError base tiene props por defecto', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('test');
    expect(err.code).toBe('APP_ERROR');
    expect(err.statusCode).toBeNull();
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('AppError acepta code, statusCode y cause', () => {
    const cause = new Error('original');
    const err = new AppError('wrapped', { code: 'CUSTOM', statusCode: 418, cause });
    expect(err.code).toBe('CUSTOM');
    expect(err.statusCode).toBe(418);
    expect(err.cause).toBe(cause);
  });

  it('NetworkError extiende AppError', () => {
    const err = new NetworkError('sin red');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('NETWORK_FAIL');
    expect(err.name).toBe('NetworkError');
  });

  it('APIError tiene statusCode por defecto 500', () => {
    const err = new APIError('fail');
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('API_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('APIError');
  });

  it('APIError acepta statusCode custom', () => {
    const err = new APIError('not found', { statusCode: 404 });
    expect(err.statusCode).toBe(404);
  });

  it('ValidationError tiene code VALIDATION_FAIL', () => {
    const err = new ValidationError('bad input');
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('VALIDATION_FAIL');
    expect(err.name).toBe('ValidationError');
  });

  it('StorageError tiene code STORAGE_FAIL', () => {
    const err = new StorageError('quota exceeded');
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('STORAGE_FAIL');
    expect(err.name).toBe('StorageError');
  });

  it('instanceof funciona para toda la jerarquía', () => {
    const errors = [
      new AppError('a'),
      new NetworkError('b'),
      new APIError('c'),
      new ValidationError('d'),
      new StorageError('e'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
      expect(err.isOperational).toBe(true);
    }
    expect(errors[1]).not.toBeInstanceOf(APIError);
    expect(errors[2]).not.toBeInstanceOf(NetworkError);
  });
});
