// Result-export helpers: GeoJSON, KML, CSV-with-WKT.

import { toPng } from 'html-to-image';

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, c => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;',
}[c]));

const escapeCsv = (s) => {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const toWKT = (geom) => {
  if (!geom) return '';
  const ring = (coords) => coords.map(([x, y]) => `${x} ${y}`).join(', ');
  switch (geom.type) {
    case 'Point': return `POINT(${geom.coordinates[0]} ${geom.coordinates[1]})`;
    case 'LineString': return `LINESTRING(${ring(geom.coordinates)})`;
    case 'Polygon': return `POLYGON(${geom.coordinates.map(r => `(${ring(r)})`).join(',')})`;
    case 'MultiPoint': return `MULTIPOINT(${geom.coordinates.map(c => `(${c[0]} ${c[1]})`).join(',')})`;
    case 'MultiLineString': return `MULTILINESTRING(${geom.coordinates.map(l => `(${ring(l)})`).join(',')})`;
    case 'MultiPolygon': return `MULTIPOLYGON(${geom.coordinates.map(p => `(${p.map(r => `(${ring(r)})`).join(',')})`).join(',')})`;
    default: return '';
  }
};

const flattenProps = (p) => {
  const out = {};
  for (const [k, v] of Object.entries(p || {})) {
    if (v && typeof v === 'object' && 'value' in v) out[k] = v.value;
    else out[k] = v;
  }
  return out;
};

export const toGeoJSON = (fc) => JSON.stringify(fc, null, 2);

export const copyGeoJSONToClipboard = async (fc, clipboard = navigator?.clipboard) => {
  if (!clipboard?.writeText) {
    throw new Error('Clipboard API is not available.');
  }
  await clipboard.writeText(toGeoJSON(fc));
};

export const toKML = (fc) => {
  const placemarks = (fc.features || []).map((f) => {
    const props = flattenProps(f.properties);
    const name = escapeXml(props.wktLabel || props.name || '');
    let body = '';
    const g = f.geometry;
    if (!g) return '';
    const coordStr = (c) => `${c[0]},${c[1]}${c[2] != null ? `,${c[2]}` : ''}`;
    if (g.type === 'Point') {
      body = `<Point><coordinates>${coordStr(g.coordinates)}</coordinates></Point>`;
    } else if (g.type === 'LineString') {
      body = `<LineString><coordinates>${g.coordinates.map(coordStr).join(' ')}</coordinates></LineString>`;
    } else if (g.type === 'Polygon') {
      const rings = g.coordinates.map((r, i) => {
        const tag = i === 0 ? 'outerBoundaryIs' : 'innerBoundaryIs';
        return `<${tag}><LinearRing><coordinates>${r.map(coordStr).join(' ')}</coordinates></LinearRing></${tag}>`;
      }).join('');
      body = `<Polygon>${rings}</Polygon>`;
    } else {
      return '';
    }
    return `<Placemark><name>${name}</name>${body}</Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
${placemarks}
</Document>
</kml>`;
};

export const toCSV = (fc) => {
  const features = fc.features || [];
  const propKeys = new Set();
  for (const f of features) for (const k of Object.keys(flattenProps(f.properties))) propKeys.add(k);
  const headers = [...propKeys, 'wkt'];
  const rows = features.map((f) => {
    const p = flattenProps(f.properties);
    const cells = [...propKeys].map(k => escapeCsv(p[k] ?? ''));
    cells.push(escapeCsv(toWKT(f.geometry)));
    return cells.join(',');
  });
  return [headers.map(escapeCsv).join(','), ...rows].join('\n');
};

const triggerDownload = (filename, content, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const triggerDownloadUrl = (filename, url) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const downloadMapPNG = async (map, filename = 'map.png', renderer = toPng) => {
  const container = map?.getContainer?.();
  if (!container) throw new Error('Map container is not available.');
  const dataUrl = await renderer(container, {
    cacheBust: true,
    pixelRatio: 2,
    filter: node => !node.classList?.contains?.('leaflet-control-container'),
  });
  triggerDownloadUrl(filename, dataUrl);
  return dataUrl;
};

/**
 * Add a small export control to a Leaflet map. Calls getFeatureCollection()
 * on demand to retrieve the merged feature collection at click time.
 * @param {L.Map} map
 * @param {() => GeoJSON.FeatureCollection} getFeatureCollection
 */
export const addExportControl = (map, getFeatureCollection) => {
  const Control = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar yasgui-geo-export');
      div.style.background = 'white';
      div.style.padding = '4px';
      const mk = (label, handler, title = `Download as ${label}`) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = title;
        b.style.margin = '2px';
        b.onclick = async (e) => {
          L.DomEvent.stopPropagation(e);
          try {
            await handler();
          } catch (error) {
            console.warn('Geo export action failed:', error);
          }
        };
        return b;
      };
      div.append(
        mk('GeoJSON', () => triggerDownload('results.geojson', toGeoJSON(getFeatureCollection()), 'application/geo+json')),
        mk('Copy', () => copyGeoJSONToClipboard(getFeatureCollection()), 'Copy GeoJSON to clipboard'),
        mk('PNG', () => downloadMapPNG(map), 'Download the current map as PNG'),
        mk('KML', () => triggerDownload('results.kml', toKML(getFeatureCollection()), 'application/vnd.google-earth.kml+xml')),
        mk('CSV', () => triggerDownload('results.csv', toCSV(getFeatureCollection()), 'text/csv')),
      );
      L.DomEvent.disableClickPropagation(div);
      return div;
    },
  });
  return new Control().addTo(map);
};
