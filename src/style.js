import L from 'leaflet';

export const DEFAULT_STYLE_STATE = {
  color: '#3388ff',
  opacity: 0.7,
  fillOpacity: 0.5,
  weight: 2,
  radius: 4,
};

const STORAGE_PREFIX = 'yasgui-geo-style:';

export const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const getStyleStorageKey = (yasr, options = {}) => {
  if (options.styleStorageKey) return options.styleStorageKey;
  const query = yasr?.yasqe?.getValue?.() || yasr?.yasqe?.value || '';
  const endpoint = yasr?.config?.requestConfig?.endpoint || '';
  return `${STORAGE_PREFIX}${hashString(`${endpoint}\n${query}`)}`;
};

const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

export const normalizeStyleState = (state = {}) => ({
  color: typeof state.color === 'string' && state.color ? state.color : DEFAULT_STYLE_STATE.color,
  opacity: clamp(state.opacity, 0, 1, DEFAULT_STYLE_STATE.opacity),
  fillOpacity: clamp(state.fillOpacity, 0, 1, DEFAULT_STYLE_STATE.fillOpacity),
  weight: clamp(state.weight, 0, 12, DEFAULT_STYLE_STATE.weight),
  radius: clamp(state.radius, 1, 30, DEFAULT_STYLE_STATE.radius),
});

export const loadStyleState = (key, storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem?.(key);
    return normalizeStyleState(raw ? JSON.parse(raw) : DEFAULT_STYLE_STATE);
  } catch {
    return { ...DEFAULT_STYLE_STATE };
  }
};

export const saveStyleState = (key, state, storage = globalThis.localStorage) => {
  const normalized = normalizeStyleState(state);
  try {
    storage?.setItem?.(key, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in private modes; styling still works for the session.
  }
  return normalized;
};

export const resolveFeatureStyle = (feature, state, fallbackColor = DEFAULT_STYLE_STATE.color) => {
  const normalized = normalizeStyleState({ ...DEFAULT_STYLE_STATE, ...state, color: state?.color || fallbackColor });
  const color = feature?.properties?.wktColor?.value || normalized.color || fallbackColor;
  return {
    color,
    fillColor: color,
    weight: normalized.weight,
    radius: normalized.radius,
    opacity: normalized.opacity,
    fillOpacity: normalized.fillOpacity,
  };
};

export const addStyleControl = (map, initialState, onChange) => {
  const Control = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      let state = normalizeStyleState(initialState);
      const div = L.DomUtil.create('div', 'leaflet-bar yasgui-geo-style');
      div.style.background = 'white';
      div.style.padding = '6px';
      div.style.display = 'grid';
      div.style.gap = '4px';
      div.style.fontSize = '12px';

      const emit = () => onChange(normalizeStyleState(state));
      const row = (title, input) => {
        const label = document.createElement('label');
        label.title = title;
        label.style.display = 'grid';
        label.style.gap = '2px';
        const span = document.createElement('span');
        span.textContent = title;
        label.append(span, input);
        return label;
      };
      const range = (title, key, min, max, step) => {
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(state[key]);
        input.oninput = () => { state = { ...state, [key]: Number(input.value) }; emit(); };
        return row(title, input);
      };
      const color = document.createElement('input');
      color.type = 'color';
      color.value = state.color;
      color.oninput = () => { state = { ...state, color: color.value }; emit(); };

      div.append(
        row('Color', color),
        range('Opacity', 'opacity', 0, 1, 0.05),
        range('Fill', 'fillOpacity', 0, 1, 0.05),
        range('Stroke', 'weight', 0, 12, 1),
        range('Marker', 'radius', 1, 30, 1),
      );
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    },
  });
  return new Control().addTo(map);
};
