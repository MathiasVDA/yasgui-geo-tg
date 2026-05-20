import { describe, it, expect } from 'vitest';
import { normalizeStyleState, resolveFeatureStyle, hashString, loadStyleState, saveStyleState } from '../src/style.js';

describe('style helpers', () => {
  it('normalizes numeric ranges', () => {
    const state = normalizeStyleState({ color: '#123456', opacity: 4, fillOpacity: -1, weight: 20, radius: 0 });
    expect(state).toEqual({ color: '#123456', opacity: 1, fillOpacity: 0, weight: 12, radius: 1 });
  });

  it('uses ?wktColor as feature-level color override', () => {
    const style = resolveFeatureStyle(
      { properties: { wktColor: { value: '#ff0000' } } },
      { color: '#00ff00', opacity: 0.4, fillOpacity: 0.2, weight: 3, radius: 7 },
    );
    expect(style.color).toBe('#ff0000');
    expect(style.radius).toBe(7);
  });

  it('persists normalized state to storage', () => {
    const store = new Map();
    const storage = {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    };
    const key = `style:${hashString('query')}`;
    saveStyleState(key, { color: '#abcdef', opacity: 0.3 }, storage);
    expect(loadStyleState(key, storage).color).toBe('#abcdef');
    expect(loadStyleState(key, storage).opacity).toBe(0.3);
  });
});
