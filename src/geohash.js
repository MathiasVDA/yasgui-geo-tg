const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const decodeGeoHash = (hash) => {
  const value = String(hash || '').trim().toLowerCase();
  if (!value || /[^0123456789bcdefghjkmnpqrstuvwxyz]/.test(value)) return null;

  let evenBit = true;
  const lon = [-180, 180];
  const lat = [-90, 90];

  for (const char of value) {
    let bits = BASE32.indexOf(char);
    if (bits < 0) return null;
    for (let mask = 16; mask > 0; mask >>= 1) {
      const range = evenBit ? lon : lat;
      const mid = (range[0] + range[1]) / 2;
      if (bits & mask) range[0] = mid;
      else range[1] = mid;
      evenBit = !evenBit;
    }
  }

  return {
    lon: (lon[0] + lon[1]) / 2,
    lat: (lat[0] + lat[1]) / 2,
    bounds: { west: lon[0], east: lon[1], south: lat[0], north: lat[1] },
  };
};

export const parseGeoHash = (hash) => {
  const decoded = decodeGeoHash(hash);
  if (!decoded) return null;
  return { type: 'Point', coordinates: [decoded.lon, decoded.lat] };
};
