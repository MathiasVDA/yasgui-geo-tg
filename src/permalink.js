// Sync map view (basemap, center, zoom) to URL hash so users can share links
// that restore the same view. Hash format: #geo=zoom/lat/lon[/basemap]
//
// Uses a custom hash key so it doesn't conflict with Yasgui's own hash state.

const KEY = 'geo';

const parseHash = () => {
  const m = (window.location.hash || '').match(new RegExp(`${KEY}=([^&]+)`));
  if (!m) return null;
  const parts = decodeURIComponent(m[1]).split('/');
  const zoom = Number(parts[0]);
  const lat = Number(parts[1]);
  const lon = Number(parts[2]);
  const basemap = parts[3];
  if (![zoom, lat, lon].every(Number.isFinite)) return null;
  return { zoom, lat, lon, basemap };
};

const writeHash = (zoom, lat, lon, basemap) => {
  const value = `${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}${basemap ? `/${basemap}` : ''}`;
  const existing = (window.location.hash || '').replace(/^#/, '');
  const parts = existing.split('&').filter(p => p && !p.startsWith(`${KEY}=`));
  parts.push(`${KEY}=${encodeURIComponent(value)}`);
  const next = `#${parts.join('&')}`;
  if (next !== window.location.hash) {
    history.replaceState(null, '', next);
  }
};

/**
 * Bind the map to the URL hash. Restores view if hash is set; otherwise leaves
 * the map at its current center/zoom. Returns a dispose function.
 * @param {L.Map} map
 * @param {{ basemaps: Record<string, L.Layer>, currentBasemapName?: string }} ctx
 */
export const bindHashState = (map, ctx) => {
  let currentBasemap = ctx.currentBasemapName;

  // Restore
  const restored = parseHash();
  if (restored) {
    map.setView([restored.lat, restored.lon], restored.zoom);
    if (restored.basemap && ctx.basemaps[restored.basemap]) {
      for (const [name, layer] of Object.entries(ctx.basemaps)) {
        if (map.hasLayer(layer) && name !== restored.basemap) map.removeLayer(layer);
      }
      ctx.basemaps[restored.basemap].addTo(map);
      currentBasemap = restored.basemap;
    }
  }

  const update = () => {
    const c = map.getCenter();
    writeHash(map.getZoom(), c.lat, c.lng, currentBasemap);
  };
  map.on('moveend zoomend', update);
  map.on('baselayerchange', (e) => {
    currentBasemap = e.name;
    update();
  });

  return () => {
    map.off('moveend zoomend', update);
  };
};
