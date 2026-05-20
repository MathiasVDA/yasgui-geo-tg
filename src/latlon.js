// Detect numeric latitude/longitude column pairs in SPARQL bindings and
// synthesize a virtual geometry column with WKT POINT literals.
// Useful for endpoints that don't expose GeoSPARQL WKT but do return
// coordinates as plain numeric literals.

const LAT_NAMES = ['lat', 'latitude', 'wgs84_lat', 'wgs84lat', 'y'];
const LON_NAMES = ['lon', 'long', 'longitude', 'lng', 'wgs84_long', 'wgs84long', 'x'];

const NUMERIC_DATATYPES = new Set([
  'http://www.w3.org/2001/XMLSchema#decimal',
  'http://www.w3.org/2001/XMLSchema#double',
  'http://www.w3.org/2001/XMLSchema#float',
  'http://www.w3.org/2001/XMLSchema#integer',
  'http://www.w3.org/2001/XMLSchema#int',
]);

const isNumericBinding = (b) => {
  if (!b) return false;
  if (b.datatype && NUMERIC_DATATYPES.has(b.datatype)) return true;
  // Untyped literal: try to parse
  if (b.type === 'literal' || b.type === 'typed-literal') {
    const n = Number(b.value);
    return Number.isFinite(n);
  }
  return false;
};

const matchName = (name, candidates) => {
  const lower = name.toLowerCase();
  return candidates.includes(lower) || candidates.some(c => lower.endsWith('_' + c) || lower === c);
};

/**
 * Find a (lat, lon) column pair in the result columns and return its names.
 * @param {string[]} columns
 * @param {Object} sampleRow - any binding row used to validate types
 * @returns {{lat:string, lon:string} | null}
 */
export const findLatLonPair = (columns, sampleRow) => {
  const latCols = columns.filter(c => matchName(c, LAT_NAMES) && isNumericBinding(sampleRow[c]));
  const lonCols = columns.filter(c => matchName(c, LON_NAMES) && isNumericBinding(sampleRow[c]));
  if (latCols.length === 0 || lonCols.length === 0) return null;
  return { lat: latCols[0], lon: lonCols[0] };
};

export const WKT_LITERAL_DT = 'http://www.opengis.net/ont/geosparql#wktLiteral';

/**
 * Mutate bindings in-place to add a synthetic WKT POINT column when a
 * lat/lon pair is detected. Returns the synthetic column name, or null.
 * @param {Array} bindings
 * @param {string} colName - name for the synthetic column (default: 'geo_point')
 * @returns {string|null}
 */
export const injectLatLonPointColumn = (bindings, colName = 'geo_point') => {
  if (!Array.isArray(bindings) || bindings.length === 0) return null;
  // Collect superset of columns; use a row that actually has lat/lon as sample.
  const allCols = new Set();
  bindings.forEach(r => Object.keys(r).forEach(k => allCols.add(k)));
  const columns = Array.from(allCols);
  const sample = bindings.find((r) => {
    const pair = findLatLonPair(columns, r);
    return pair !== null;
  });
  if (!sample) return null;
  const pair = findLatLonPair(columns, sample);
  if (!pair) return null;
  // Don't overwrite a real geometry column
  if (columns.includes(colName)) return null;

  for (const row of bindings) {
    const latB = row[pair.lat];
    const lonB = row[pair.lon];
    if (!latB || !lonB) continue;
    const lat = Number(latB.value);
    const lon = Number(lonB.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    row[colName] = {
      type: 'literal',
      datatype: WKT_LITERAL_DT,
      value: `POINT(${lon} ${lat})`,
    };
  }
  return colName;
};
