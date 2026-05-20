import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { polygonToWKT } from '../src/draw-helpers.js';

// Register EPSG:31370 (Belgian Lambert 72) for CRS conversion tests
beforeAll(() => {
  proj4.defs('EPSG:31370',
    '+proj=lcc +lat_0=90 +lon_0=4.36748666666667 +lat_1=51.1666672333333 '
    + '+lat_2=49.8333339 +x_0=150000.013 +y_0=5400088.438 +ellps=intl '
    + '+towgs84=-106.869,52.2978,-103.724,0.3366,-0.457,1.8422,-1.2747 +units=m +no_defs');
});

const pts = [
  { lat: 50.0, lng: 4.0 },
  { lat: 50.0, lng: 5.0 },
  { lat: 51.0, lng: 5.0 },
  { lat: 51.0, lng: 4.0 },
];

describe('polygonToWKT', () => {
  it('plain WKT (no CRS) uses lon/lat order', () => {
    const wkt = polygonToWKT(pts, null);
    expect(wkt).toMatch(/^POLYGON\(\(/);
    // First coordinate should be lng lat
    expect(wkt).toContain('4 50');
  });

  it('CRS84 uses plain lon/lat with no prefix', () => {
    const wkt = polygonToWKT(pts, 'http://www.opengis.net/def/crs/OGC/1.3/CRS84');
    expect(wkt).toMatch(/^POLYGON\(\(/);
    expect(wkt).toContain('4 50');
    expect(wkt).not.toContain('<http');
  });

  it('EPSG:4326 uses lat/lon order with CRS prefix', () => {
    const crs = 'http://www.opengis.net/def/crs/EPSG/0/4326';
    const wkt = polygonToWKT(pts, crs);
    expect(wkt).toMatch(/^<http:\/\/www\.opengis\.net\/def\/crs\/EPSG\/0\/4326>POLYGON\(\(/);
    // First coordinate should be lat lng (50 4)
    expect(wkt).toContain('50 4');
    expect(wkt).not.toContain('4 50');
  });

  it('EPSG:4326 URN form uses lat/lon order with CRS prefix', () => {
    const crs = 'urn:ogc:def:crs:EPSG::4326';
    const wkt = polygonToWKT(pts, crs);
    expect(wkt).toMatch(/^<urn:ogc:def:crs:EPSG::4326>POLYGON\(\(/);
    expect(wkt).toContain('50 4');
  });

  it('EPSG:31370 converts coordinates and adds CRS prefix', () => {
    const crs = 'http://www.opengis.net/def/crs/EPSG/0/31370';
    const wkt = polygonToWKT(pts, crs);
    expect(wkt).toMatch(/^<http:\/\/www\.opengis\.net\/def\/crs\/EPSG\/0\/31370>POLYGON\(\(/);
    // Coordinates should be large numbers (Belgian Lambert easting/northing)
    const coordMatch = wkt.match(/POLYGON\(\(([^)]+)\)/);
    expect(coordMatch).not.toBeNull();
    const [firstX] = coordMatch[1].split(',')[0].trim().split(' ').map(Number);
    expect(firstX).toBeGreaterThan(100000); // easting in metres
  });

  it('closes the ring (last point equals first)', () => {
    const wkt = polygonToWKT(pts, null);
    const coordStr = wkt.replace('POLYGON((', '').replace('))', '');
    const coords = coordStr.split(', ');
    expect(coords[0]).toBe(coords[coords.length - 1]);
  });

  it('unknown CRS falls back to plain lon/lat', () => {
    const wkt = polygonToWKT(pts, 'http://example.com/crs/unknown');
    expect(wkt).toMatch(/^POLYGON\(\(/);
    expect(wkt).toContain('4 50');
  });
});
