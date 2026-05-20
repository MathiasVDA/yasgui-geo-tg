import { describe, it, expect } from 'vitest';
import { findLatLonPair, injectLatLonPointColumn, WKT_LITERAL_DT } from '../src/latlon.js';

const num = (v) => ({ type: 'literal', value: String(v), datatype: 'http://www.w3.org/2001/XMLSchema#decimal' });

describe('findLatLonPair', () => {
  it('finds a basic lat/lon pair', () => {
    expect(findLatLonPair(['lat', 'lon'], { lat: num(50.5), lon: num(4.4) }))
      .toEqual({ lat: 'lat', lon: 'lon' });
  });

  it('finds latitude/longitude pair', () => {
    const out = findLatLonPair(['latitude', 'longitude'], { latitude: num(1), longitude: num(2) });
    expect(out).toEqual({ lat: 'latitude', lon: 'longitude' });
  });

  it('returns null when only one of the pair is present', () => {
    expect(findLatLonPair(['lat'], { lat: num(1) })).toBeNull();
  });

  it('returns null when values are not numeric', () => {
    expect(findLatLonPair(['lat', 'lon'], {
      lat: { type: 'literal', value: 'abc' },
      lon: { type: 'literal', value: 'xyz' },
    })).toBeNull();
  });
});

describe('injectLatLonPointColumn', () => {
  it('synthesizes a WKT point column', () => {
    const bindings = [{ lat: num(50.5), lon: num(4.4) }];
    const colName = injectLatLonPointColumn(bindings);
    expect(colName).toBe('geo_point');
    expect(bindings[0].geo_point.value).toBe('POINT(4.4 50.5)');
    expect(bindings[0].geo_point.datatype).toBe(WKT_LITERAL_DT);
  });

  it('returns null when no pair found', () => {
    expect(injectLatLonPointColumn([{ name: { type: 'literal', value: 'x' } }])).toBeNull();
  });
});
