import { describe, it, expect } from 'vitest';
import { normalizeSimplifyTolerance, simplifyFeatureCollection } from '../src/simplify.js';

describe('simplifyFeatureCollection', () => {
  it('normalizes slider tolerance values', () => {
    expect(normalizeSimplifyTolerance(-1)).toBe(0);
    expect(normalizeSimplifyTolerance('oops')).toBe(0);
    expect(normalizeSimplifyTolerance(0.2, 0.05)).toBe(0.05);
  });

  it('returns input unchanged when tolerance is 0', () => {
    const fc = { type: 'FeatureCollection', features: [] };
    expect(simplifyFeatureCollection(fc, 0)).toBe(fc);
  });

  it('passes through point features without simplifying', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: {},
      }],
    };
    const out = simplifyFeatureCollection(fc, 0.5);
    expect(out.features[0].geometry.type).toBe('Point');
  });

  it('reduces vertex count on a dense polyline', () => {
    const coords = [];
    for (let i = 0; i < 100; i += 1) coords.push([i * 0.001, Math.sin(i * 0.1) * 0.001]);
    const fc = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      }],
    };
    const out = simplifyFeatureCollection(fc, 0.01);
    expect(out.features[0].geometry.coordinates.length).toBeLessThan(coords.length);
  });
});
