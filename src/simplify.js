// Geometry simplification helper using @turf/simplify (Ramer-Douglas-Peucker).
// Skips non-line/polygon geometries.

import simplify from '@turf/simplify';

/**
 * Simplify all line/polygon features of a GeoJSON FeatureCollection in place
 * (returns a new collection). Tolerance is in degrees of latitude/longitude.
 * @param {GeoJSON.FeatureCollection} fc
 * @param {number} tolerance
 * @returns {GeoJSON.FeatureCollection}
 */
export const simplifyFeatureCollection = (fc, tolerance) => {
  if (!fc || !Array.isArray(fc.features) || !tolerance || tolerance <= 0) return fc;
  const features = fc.features.map((f) => {
    const t = f.geometry?.type;
    if (t === 'LineString' || t === 'MultiLineString'
      || t === 'Polygon' || t === 'MultiPolygon') {
      try {
        return simplify(f, { tolerance, highQuality: false, mutate: false });
      } catch {
        return f;
      }
    }
    return f;
  });
  return { ...fc, features };
};
