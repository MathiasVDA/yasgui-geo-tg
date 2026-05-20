import L from 'leaflet';

export const DEFAULT_TIME_BINDINGS = ['time', 'date', 'datetime', 'timestamp', 'start', 'startDate'];

export const parseTemporalValue = (bindingOrValue) => {
  const raw = typeof bindingOrValue === 'object' ? bindingOrValue?.value : bindingOrValue;
  if (raw == null || raw === '') return null;
  const numeric = Number(raw);
  const timestamp = Number.isFinite(numeric) && String(raw).trim().length >= 4
    ? numeric
    : Date.parse(String(raw));
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const getFeatureTime = (feature, bindingNames = DEFAULT_TIME_BINDINGS) => {
  const props = feature?.properties || {};
  for (const name of bindingNames) {
    if (props[name]) {
      const parsed = parseTemporalValue(props[name]);
      if (parsed != null) return parsed;
    }
  }
  return null;
};

export const collectTimeValues = (features, bindingNames = DEFAULT_TIME_BINDINGS) => {
  const values = new Set();
  for (const feature of features || []) {
    const time = getFeatureTime(feature, bindingNames);
    if (time != null) values.add(time);
  }
  return [...values].sort((a, b) => a - b);
};

export const filterFeatureCollectionByTime = (fc, selectedTime, options = {}) => {
  if (selectedTime == null) return fc;
  const bindingNames = options.bindingNames || DEFAULT_TIME_BINDINGS;
  const mode = options.mode || 'cumulative';
  return {
    ...fc,
    features: (fc.features || []).filter((feature) => {
      const time = getFeatureTime(feature, bindingNames);
      if (time == null) return true;
      return mode === 'instant' ? time === selectedTime : time <= selectedTime;
    }),
  };
};

export const formatTimeLabel = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/T00:00:00.000Z$/, '').replace(/\.000Z$/, 'Z');
};

export const addTimeSliderControl = (map, values, selectedTime, onSelect) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  let playTimer = null;
  const Control = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar yasgui-geo-time');
      div.style.background = 'white';
      div.style.padding = '6px';
      div.style.display = 'grid';
      div.style.gridTemplateColumns = 'auto 1fr';
      div.style.gap = '4px';
      div.style.alignItems = 'center';
      div.style.minWidth = '220px';
      div.style.fontSize = '12px';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Play';
      button.title = 'Play time animation';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = String(sorted.length - 1);
      input.step = '1';
      input.value = String(Math.max(0, sorted.indexOf(selectedTime)));

      const label = document.createElement('span');
      label.style.gridColumn = '1 / span 2';
      const updateLabel = () => { label.textContent = formatTimeLabel(sorted[Number(input.value)]); };
      const select = () => onSelect(sorted[Number(input.value)]);

      input.oninput = () => {
        updateLabel();
        select();
      };
      button.onclick = () => {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
          button.textContent = 'Play';
          return;
        }
        button.textContent = 'Pause';
        playTimer = setInterval(() => {
          const next = (Number(input.value) + 1) % sorted.length;
          input.value = String(next);
          updateLabel();
          select();
        }, 900);
      };

      updateLabel();
      div.append(button, input, label);
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    },
    onRemove() {
      if (playTimer) clearInterval(playTimer);
    },
  });
  return new Control().addTo(map);
};
