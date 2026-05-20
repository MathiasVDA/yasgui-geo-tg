import { describe, it, expect } from 'vitest';
import { decodeGeoHash, parseGeoHash } from '../src/geohash.js';

describe('GeoHash helpers', () => {
  it('decodes a geohash center', () => {
    const decoded = decodeGeoHash('u1514');
    expect(decoded.lat).toBeCloseTo(50.5, 0);
    expect(decoded.lon).toBeCloseTo(4.4, 0);
  });

  it('returns a GeoJSON point', () => {
    const point = parseGeoHash('u1514');
    expect(point.type).toBe('Point');
    expect(point.coordinates[0]).toBeCloseTo(4.4, 0);
    expect(point.coordinates[1]).toBeCloseTo(50.5, 0);
  });

  it('rejects invalid geohashes', () => {
    expect(decodeGeoHash('not valid!')).toBeNull();
    expect(parseGeoHash('')).toBeNull();
  });
});
