// Spatial filter drawing: overlays leaflet-draw on the map, listens for
// drawn polygons/rectangles and shows a copyable GeoSPARQL snippet.

import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import L from 'leaflet';

const polygonToWKT = (latlngs) => {
  // latlngs is array of {lat,lng}; close ring
  const ring = [...latlngs, latlngs[0]]
    .map(p => `${p.lng} ${p.lat}`)
    .join(', ');
  return `POLYGON((${ring}))`;
};

/**
 * Enable spatial-filter drawing on the given map.
 * @param {L.Map} map
 * @param {{ onWKT?: (wkt: string) => void }} [opts]
 */
export const enableDrawing = (map, { onWKT } = {}) => {
  const drawnItems = new L.FeatureGroup().addTo(map);
  const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems, edit: false, remove: true },
    draw: {
      polygon: { allowIntersection: false, showArea: true },
      rectangle: {},
      marker: false,
      circle: false,
      circlemarker: false,
      polyline: false,
    },
  });
  map.addControl(drawControl);

  const panel = L.control({ position: 'bottomleft' });
  panel.onAdd = () => {
    const div = L.DomUtil.create('div', 'yasgui-geo-draw-panel');
    div.style.background = 'white';
    div.style.padding = '6px 8px';
    div.style.font = '12px monospace';
    div.style.maxWidth = '360px';
    div.style.display = 'none';
    div.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
    div.innerHTML = '';
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  panel.addTo(map);

  const showSnippet = (wkt) => {
    const div = panel.getContainer();
    div.style.display = 'block';
    div.replaceChildren();
    const title = document.createElement('div');
    title.textContent = 'GeoSPARQL filter:';
    title.style.fontWeight = 'bold';
    const code = document.createElement('textarea');
    code.readOnly = true;
    code.style.width = '100%';
    code.style.height = '70px';
    code.value = `FILTER(geof:sfWithin(?geom, "${wkt}"^^geo:wktLiteral))`;
    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.onclick = () => navigator.clipboard?.writeText(code.value);
    div.append(title, code, copy);
    onWKT?.(wkt);
  };

  map.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;
    drawnItems.clearLayers();
    drawnItems.addLayer(layer);
    const wkt = polygonToWKT(layer.getLatLngs()[0]);
    showSnippet(wkt);
  });
  map.on(L.Draw.Event.DELETED, () => {
    panel.getContainer().style.display = 'none';
  });
};
