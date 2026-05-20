import { describe, it, expect } from 'vitest';
import { toGeoJSON, toKML, toCSV } from '../src/export.js';

const fc = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [4.4, 50.5] },
      properties: { name: { value: 'Brussels' } },
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: { name: { value: 'Triangle' } },
    },
  ],
};

describe('export helpers', () => {
  it('toGeoJSON returns valid JSON', () => {
    const parsed = JSON.parse(toGeoJSON(fc));
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features).toHaveLength(2);
  });

  it('toKML wraps placemarks', () => {
    const kml = toKML(fc);
    expect(kml).toContain('<kml');
    expect(kml).toContain('<Point>');
    expect(kml).toContain('<Polygon>');
    expect(kml).toContain('4.4,50.5');
  });

  it('toCSV flattens props and appends wkt column', () => {
    const csv = toCSV(fc);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('name,wkt');
    expect(lines[1]).toBe('Brussels,POINT(4.4 50.5)');
    expect(lines[2]).toContain('POLYGON');
  });

  it('toCSV escapes commas and quotes', () => {
    const tricky = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: { value: 'a,b "c"' } },
      }],
    };
    const csv = toCSV(tricky);
    expect(csv).toContain('"a,b ""c"""');
  });
});
