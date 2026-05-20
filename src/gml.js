// Minimal parser for GeoSPARQL gmlLiteral values.
// Supports the subset of GML 3.2 most commonly emitted by GeoSPARQL endpoints:
// gml:Point, gml:LineString, gml:Polygon (with exterior/interior), gml:MultiPoint,
// gml:MultiLineString, gml:MultiPolygon (and MultiSurface/MultiCurve aliases),
// and gml:posList / gml:pos coordinate lists.
//
// CRS handling: detects srsName attributes referencing EPSG codes (in URN, URL
// or short forms). Coordinate order follows GML conventions: for EPSG:4326
// (and most lat/lon EPSG codes), GML stores latitude first, so we swap.
// All coordinates are returned in WGS84 lon/lat for Leaflet consumption.

import proj4 from 'proj4';

const EPSG_4326 = 'EPSG:4326';

const parseSrsName = (srsName) => {
  if (!srsName) return null;
  const m = srsName.match(/EPSG[\/:]+(?:\d+\/)?(\d+)/i)
        || srsName.match(/crs[:\/]EPSG[\/:]+\d*[\/:]*?(\d+)/i);
  if (m) return m[1];
  if (/CRS84/i.test(srsName)) return '4326-lonlat';
  return null;
};

const parseCoords = (text, dim = 2) => {
  const nums = text.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const out = [];
  for (let i = 0; i + dim <= nums.length; i += dim) {
    out.push(nums.slice(i, i + dim));
  }
  return out;
};

const findFirst = (parent, tagLocalName) => {
  const matches = parent.getElementsByTagName('*');
  for (const el of matches) {
    if (el.localName === tagLocalName) return el;
  }
  return null;
};
const findAll = (parent, tagLocalName) => {
  const out = [];
  for (const el of parent.getElementsByTagName('*')) {
    if (el.localName === tagLocalName) out.push(el);
  }
  return out;
};

const extractCoordsFromGeom = (geomEl) => {
  const posList = findFirst(geomEl, 'posList');
  if (posList) {
    const dim = Number(posList.getAttribute('srsDimension')) || 2;
    return parseCoords(posList.textContent, dim);
  }
  const positions = findAll(geomEl, 'pos');
  if (positions.length > 0) {
    return positions.flatMap(p => parseCoords(p.textContent, Number(p.getAttribute('srsDimension')) || 2));
  }
  const coordinates = findFirst(geomEl, 'coordinates');
  if (coordinates) {
    // legacy GML 2 style: "x,y x,y"
    const ts = coordinates.getAttribute('ts') || ' ';
    const cs = coordinates.getAttribute('cs') || ',';
    return coordinates.textContent.trim().split(new RegExp(`[${ts}]+`))
      .map(pair => pair.split(cs).map(Number))
      .filter(p => p.length >= 2 && p.every(Number.isFinite));
  }
  return [];
};

const reprojectCoords = (coords, srid) => {
  if (!srid) return coords;
  if (srid === '4326-lonlat') return coords; // CRS84 — already lon/lat
  // GML axis order: for EPSG:4326 (and most geographic CRSes), lat,lon.
  const needsSwap = ['4326', '4258', '4269'].includes(srid);
  const swapped = needsSwap ? coords.map(c => [c[1], c[0], ...c.slice(2)]) : coords;
  if (srid === '4326' || srid === '4326-lonlat') return swapped;
  try {
    return swapped.map(c => {
      const [x, y] = proj4(`EPSG:${srid}`, EPSG_4326, [c[0], c[1]]);
      return c.length > 2 ? [x, y, c[2]] : [x, y];
    });
  } catch {
    return swapped;
  }
};

const ringFromLinearRing = (linearRing, srid) =>
  reprojectCoords(extractCoordsFromGeom(linearRing), srid);

const polygonCoords = (polyEl, srid) => {
  const ext = findFirst(polyEl, 'exterior');
  const rings = [];
  if (ext) {
    const lr = findFirst(ext, 'LinearRing');
    if (lr) rings.push(ringFromLinearRing(lr, srid));
  }
  for (const interior of findAll(polyEl, 'interior')) {
    const lr = findFirst(interior, 'LinearRing');
    if (lr) rings.push(ringFromLinearRing(lr, srid));
  }
  return rings;
};

const geomToGeoJSON = (el, parentSrid) => {
  const srid = parseSrsName(el.getAttribute('srsName')) || parentSrid;
  switch (el.localName) {
    case 'Point': {
      const coords = reprojectCoords(extractCoordsFromGeom(el), srid)[0];
      return coords ? { type: 'Point', coordinates: coords } : null;
    }
    case 'LineString':
    case 'Curve':
      return { type: 'LineString', coordinates: reprojectCoords(extractCoordsFromGeom(el), srid) };
    case 'Polygon':
    case 'Surface':
      return { type: 'Polygon', coordinates: polygonCoords(el, srid) };
    case 'MultiPoint': {
      const points = findAll(el, 'Point').map(p => geomToGeoJSON(p, srid)).filter(Boolean);
      return { type: 'MultiPoint', coordinates: points.map(g => g.coordinates) };
    }
    case 'MultiLineString':
    case 'MultiCurve': {
      const lines = [
        ...findAll(el, 'LineString'),
        ...findAll(el, 'Curve'),
      ].map(l => geomToGeoJSON(l, srid)).filter(Boolean);
      return { type: 'MultiLineString', coordinates: lines.map(g => g.coordinates) };
    }
    case 'MultiPolygon':
    case 'MultiSurface': {
      const polys = [
        ...findAll(el, 'Polygon'),
        ...findAll(el, 'Surface'),
      ].map(p => geomToGeoJSON(p, srid)).filter(Boolean);
      return { type: 'MultiPolygon', coordinates: polys.map(g => g.coordinates) };
    }
    default:
      return null;
  }
};

/**
 * Parse a GeoSPARQL gmlLiteral string into a GeoJSON geometry in WGS84.
 * @param {string} gml
 * @returns {Object|null}
 */
export const parseGML = (gml) => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('GML parsing requires a DOM environment (DOMParser).');
  }
  const wrapped = `<root xmlns:gml="http://www.opengis.net/gml/3.2">${gml}</root>`;
  const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
  const root = doc.documentElement;
  // First child element is the geometry
  for (const child of root.children) {
    const geom = geomToGeoJSON(child, null);
    if (geom) return geom;
  }
  return null;
};
