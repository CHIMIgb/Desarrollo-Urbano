import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, Events } from '../../src/config/events.js';

describe('EventBus', () => {
  beforeEach(() => {
    EventBus._listeners.clear();
  });

  it('debería registrar y ejecutar un listener al emitir un evento', () => {
    const handler = vi.fn();
    EventBus.on('test:event', handler);
    EventBus.emit('test:event', { data: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ data: 42 });
  });

  it('debería soportar múltiples listeners para el mismo evento', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    EventBus.on('test:event', handler1);
    EventBus.on('test:event', handler2);
    EventBus.emit('test:event');

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('debería desuscribirse con la función devuelta por on()', () => {
    const handler = vi.fn();
    const unsubscribe = EventBus.on('test:event', handler);
    unsubscribe();
    EventBus.emit('test:event');

    expect(handler).not.toHaveBeenCalled();
  });

  it('debería ignorar eventos sin listeners sin errores', () => {
    expect(() => EventBus.emit('nonexistent:event')).not.toThrow();
  });

  it('debería manejar errores en listeners sin romper otros listeners', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badHandler = () => { throw new Error('fail'); };
    const goodHandler = vi.fn();

    EventBus.on('test:event', badHandler);
    EventBus.on('test:event', goodHandler);
    EventBus.emit('test:event');

    expect(goodHandler).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('debería off() eliminar un listener específico', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    EventBus.on('test:event', handler1);
    EventBus.on('test:event', handler2);
    EventBus.off('test:event', handler1);
    EventBus.emit('test:event');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('debería tener el catálogo de eventos correcto', () => {
    expect(Events.MAP_READY).toBe('map:ready');
    expect(Events.FEATURES_UPDATED).toBe('state:features_updated');
    expect(Events.TOAST).toBe('ui:toast');
    expect(Events.STATS_UPDATE).toBe('ui:stats_update');
  });
});
