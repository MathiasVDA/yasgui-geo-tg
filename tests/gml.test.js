import { describe, it, expect } from 'vitest';
import { parseGML } from '../src/gml.js';

describe('parseGML', () => {
  it('parses a Point with srsName urn EPSG:4326 (lat/lon swap)', () => {
    const gml = '<gml:Point srsName="urn:ogc:def:crs:EPSG::4326" xmlns:gml="http://www.opengis.net/gml"><gml:pos>50.5 4.4</gml:pos></gml:Point>';
    const g = parseGML(gml);
    expect(g.type).toBe('Point');
    expect(g.coordinates[0]).toBeCloseTo(4.4);
    expect(g.coordinates[1]).toBeCloseTo(50.5);
  });

  it('parses a LineString posList', () => {
    const gml = '<gml:LineString srsName="CRS:84" xmlns:gml="http://www.opengis.net/gml"><gml:posList>0 0 1 1 2 2</gml:posList></gml:LineString>';
    const g = parseGML(gml);
    expect(g.type).toBe('LineString');
    expect(g.coordinates).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('parses a Polygon with hole', () => {
    const gml = `<gml:Polygon srsName="CRS:84" xmlns:gml="http://www.opengis.net/gml">
      <gml:exterior><gml:LinearRing><gml:posList>0 0 4 0 4 4 0 4 0 0</gml:posList></gml:LinearRing></gml:exterior>
      <gml:interior><gml:LinearRing><gml:posList>1 1 2 1 2 2 1 2 1 1</gml:posList></gml:LinearRing></gml:interior>
    </gml:Polygon>`;
    const g = parseGML(gml);
    expect(g.type).toBe('Polygon');
    expect(g.coordinates).toHaveLength(2);
    expect(g.coordinates[0]).toHaveLength(5);
    expect(g.coordinates[1]).toHaveLength(5);
  });

  it('returns null on garbage input', () => {
    expect(parseGML('not gml')).toBeNull();
  });
});
