// Pure helper functions for GeoSPARQL draw output.
// Kept separate so they can be unit-tested without importing leaflet-draw.

import proj4 from 'proj4';

// OGC URIs that mean WGS84 lon/lat (no conversion, no prefix needed)
export const CRS84_URIS = new Set([
  'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
  'http://www.opengis.net/def/crs/OGC/0/CRS84',
  'urn:ogc:def:crs:OGC:1.3:CRS84',
]);

// EPSG URIs whose authority axis order is lat/lon
export const EPSG4326_URIS = new Set([
  'http://www.opengis.net/def/crs/EPSG/0/4326',
  'urn:ogc:def:crs:EPSG::4326',
  'urn:ogc:def:crs:EPSG:4326',
]);

// Extract numeric EPSG code from a CRS URI or URN
export const epsgFromUri = (uri) => {
  if (!uri) return null;
  const m = uri.match(/\/EPSG\/[^/]*\/(\d+)$/) || uri.match(/EPSG::?(\d+)$/);
  return m ? m[1] : null;
};

/**
 * Build a closed WKT POLYGON from an array of {lat, lng} points,
 * applying the correct axis order and coordinate conversion for the given CRS.
 *
 * @param {Array<{lat:number, lng:number}>} latlngs
 * @param {string|null} crsUri
 * @returns {string}
 */
export const polygonToWKT = (latlngs, crsUri) => {
  const ring = [...latlngs, latlngs[0]];

  if (!crsUri || CRS84_URIS.has(crsUri)) {
    // Plain WKT lon/lat (CRS84 or no declared CRS)
    const coords = ring.map(p => `${p.lng} ${p.lat}`).join(', ');
    return `POLYGON((${coords}))`;
  }

  if (EPSG4326_URIS.has(crsUri)) {
    // EPSG:4326 authority axis order is lat/lon — swap relative to Leaflet
    const coords = ring.map(p => `${p.lat} ${p.lng}`).join(', ');
    return `<${crsUri}>POLYGON((${coords}))`;
  }

  // Other EPSG: reproject WGS84 lon/lat → target CRS using proj4
  const epsgCode = epsgFromUri(crsUri);
  if (epsgCode) {
    const code = `EPSG:${epsgCode}`;
    if (proj4.defs(code)) {
      try {
        const points = ring.map(({ lat, lng }) => proj4('EPSG:4326', code, [lng, lat]));
        const coords = points.map(([x, y]) => `${x} ${y}`).join(', ');
        return `<${crsUri}>POLYGON((${coords}))`;
      } catch {
        // fall through to plain WKT
      }
    }
  }

  // Fallback: plain lon/lat WKT
  const coords = ring.map(p => `${p.lng} ${p.lat}`).join(', ');
  return `POLYGON((${coords}))`;
};
