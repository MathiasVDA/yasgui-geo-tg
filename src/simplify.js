// Geometry simplification helper using @turf/simplify (Ramer-Douglas-Peucker).
// Skips non-line/polygon geometries.

import simplify from '@turf/simplify';
import L from 'leaflet';

export const normalizeSimplifyTolerance = (value, max = 0.05) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(num, 0), max);
};

/**
 * Simplify all line/polygon features of a GeoJSON FeatureCollection in place
 * (returns a new collection). Tolerance is in degrees of latitude/longitude.
 * @param {GeoJSON.FeatureCollection} fc
 * @param {number} tolerance
 * @returns {GeoJSON.FeatureCollection}
 */
export const simplifyFeatureCollection = (fc, tolerance) => {
  const normalizedTolerance = normalizeSimplifyTolerance(tolerance, Number.POSITIVE_INFINITY);
  if (!fc || !Array.isArray(fc.features) || normalizedTolerance <= 0) return fc;
  const features = fc.features.map((f) => {
    const t = f.geometry?.type;
    if (t === 'LineString' || t === 'MultiLineString'
      || t === 'Polygon' || t === 'MultiPolygon') {
      try {
        return simplify(f, { tolerance: normalizedTolerance, highQuality: false, mutate: false });
      } catch {
        return f;
      }
    }
    return f;
  });
  return { ...fc, features };
};

export const addSimplifyControl = (map, initialTolerance, options, onChange) => {
  const max = Number(options?.max) || 0.05;
  const step = Number(options?.step) || 0.0001;
  const Control = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar yasgui-geo-simplify');

      // Toggle button (always visible)
      const toggle = document.createElement('a');
      toggle.href = '#';
      toggle.title = 'Simplification tolerance';
      toggle.textContent = '〰';
      toggle.style.fontSize = '16px';
      toggle.style.textAlign = 'center';
      toggle.style.textDecoration = 'none';
      toggle.style.lineHeight = '26px';
      toggle.style.display = 'block';

      // Collapsible panel (hidden by default)
      const panel = document.createElement('div');
      panel.style.display = 'none';
      panel.style.padding = '6px';
      panel.style.fontSize = '12px';
      panel.style.background = '#fff';
      panel.style.borderTop = '1px solid #ccc';

      let panelOpen = false;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panelOpen = !panelOpen;
        panel.style.display = panelOpen ? 'block' : 'none';
      });

      const label = document.createElement('label');
      label.title = 'Simplification tolerance';
      label.style.display = 'grid';
      label.style.gap = '2px';
      const text = document.createElement('span');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = String(max);
      input.step = String(step);
      input.value = String(normalizeSimplifyTolerance(initialTolerance, max));
      const updateText = () => { text.textContent = `Simplify ${Number(input.value).toFixed(4)}`; };
      input.oninput = () => {
        updateText();
        onChange(normalizeSimplifyTolerance(input.value, max));
      };
      updateText();
      label.append(text, input);
      panel.append(label);
      div.append(toggle, panel);
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    },
  });
  return new Control().addTo(map);
};
