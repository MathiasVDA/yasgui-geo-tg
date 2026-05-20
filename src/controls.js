// Live mouse-coordinate readout (bottom-right) and a simple measure tool
// (click to add vertices, double-click to finish; shows total distance in km).

import L from 'leaflet';

export const addCoordinateDisplay = (map) => {
  const ctl = L.control({ position: 'bottomright' });
  ctl.onAdd = () => {
    const div = L.DomUtil.create('div', 'yasgui-geo-coords');
    div.style.background = 'rgba(255,255,255,0.85)';
    div.style.padding = '2px 6px';
    div.style.font = '11px monospace';
    div.textContent = '—';
    return div;
  };
  ctl.addTo(map);
  const div = ctl.getContainer();
  map.on('mousemove', (e) => {
    div.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
  map.on('mouseout', () => { div.textContent = '—'; });
  return ctl;
};

export const addMeasureControl = (map) => {
  const layer = L.layerGroup().addTo(map);
  let active = false;
  let points = [];
  let line, marker;

  const totalKm = () => {
    let km = 0;
    for (let i = 1; i < points.length; i += 1) km += points[i - 1].distanceTo(points[i]) / 1000;
    return km;
  };

  const reset = () => {
    points = [];
    layer.clearLayers();
    line = null;
    marker = null;
  };

  const onClick = (e) => {
    if (!active) return;
    points.push(e.latlng);
    L.circleMarker(e.latlng, { radius: 3, color: '#000' }).addTo(layer);
    if (points.length >= 2) {
      if (line) layer.removeLayer(line);
      line = L.polyline(points, { color: '#000', weight: 2, dashArray: '4,4' }).addTo(layer);
      if (marker) layer.removeLayer(marker);
      marker = L.marker(points[points.length - 1], {
        icon: L.divIcon({
          className: 'yasgui-geo-measure-label',
          html: `<div style="background:white;padding:2px 4px;border:1px solid #000;font:11px monospace;">${totalKm().toFixed(2)} km</div>`,
        }),
      }).addTo(layer);
    }
  };
  const onDblClick = () => {
    if (!active) return;
    active = false;
    L.DomUtil.removeClass(map.getContainer(), 'yasgui-geo-measuring');
  };

  map.on('click', onClick);
  map.on('dblclick', onDblClick);

  const Btn = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      const a = L.DomUtil.create('a', '', div);
      a.href = '#'; a.title = 'Measure distance'; a.textContent = '📏';
      a.style.fontSize = '16px'; a.style.textAlign = 'center';
      L.DomEvent.on(a, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        if (active) {
          active = false;
          reset();
        } else {
          reset();
          active = true;
        }
      });
      return div;
    },
  });
  return new Btn().addTo(map);
};
