// Safe popup rendering for SPARQL bindings.
// All values are inserted via textContent or createElement to prevent XSS
// from hostile endpoints. IRIs, images, and long text are handled specially.

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;
const URL_RE = /^https?:\/\//i;
const MAX_VALUE_CHARS = 240;

const isIRI = (binding) => binding && (binding.type === 'uri' || binding.type === 'iri');

const createValueNode = (binding, doc) => {
  const value = binding?.value ?? '';
  if (isIRI(binding) || URL_RE.test(value)) {
    if (IMAGE_EXT.test(value)) {
      const img = doc.createElement('img');
      img.src = value;
      img.alt = '';
      img.loading = 'lazy';
      img.style.maxWidth = '180px';
      img.style.maxHeight = '120px';
      img.style.display = 'block';
      return img;
    }
    const a = doc.createElement('a');
    a.href = value;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = value;
    return a;
  }
  const span = doc.createElement('span');
  if (value.length > MAX_VALUE_CHARS) {
    const short = doc.createElement('span');
    short.textContent = value.slice(0, MAX_VALUE_CHARS) + '… ';
    const more = doc.createElement('button');
    more.type = 'button';
    more.textContent = '(show more)';
    more.setAttribute('aria-label', 'Show full value');
    more.style.background = 'none';
    more.style.border = 'none';
    more.style.color = '#06c';
    more.style.cursor = 'pointer';
    more.style.padding = '0';
    more.addEventListener('click', (ev) => {
      ev.preventDefault();
      span.textContent = value;
    });
    span.appendChild(short);
    span.appendChild(more);
  } else {
    span.textContent = value;
  }
  return span;
};

/**
 * Render a SPARQL binding row as a safe DOM table for use in a Leaflet popup.
 * @param {Object} properties - SPARQL bindings { var: { value, type, datatype } }
 * @param {Object} [opts]
 * @param {string[]} [opts.skip] - Variable names to omit (e.g. 'wktLabel', 'wktTooltip')
 * @param {Document} [opts.doc] - Document to use (defaults to global document)
 * @returns {HTMLElement}
 */
export const renderPopup = (properties, opts = {}) => {
  const doc = opts.doc || document;
  const skip = new Set(opts.skip || []);
  const table = doc.createElement('table');
  table.className = 'yasgui-geo-popup';
  table.setAttribute('role', 'presentation');
  table.tabIndex = 0;
  table.setAttribute('aria-label', 'Feature properties');
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '12px';
  for (const key of Object.keys(properties)) {
    if (skip.has(key)) continue;
    const binding = properties[key];
    if (!binding) continue;
    const tr = doc.createElement('tr');
    const th = doc.createElement('th');
    th.textContent = key;
    th.style.textAlign = 'left';
    th.style.verticalAlign = 'top';
    th.style.paddingRight = '6px';
    th.style.whiteSpace = 'nowrap';
    const td = doc.createElement('td');
    td.appendChild(createValueNode(binding, doc));
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  }
  return table;
};
