import { describe, it, expect } from 'vitest';
import { renderPopup } from '../src/popup.js';

describe('renderPopup', () => {
  it('uses textContent for hostile values (no XSS)', () => {
    const props = {
      name: { type: 'literal', value: '<script>alert(1)</script>' },
    };
    const el = renderPopup(props);
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>');
  });

  it('renders IRIs as anchors with rel=noopener', () => {
    const props = {
      page: { type: 'uri', value: 'https://example.org/x' },
    };
    const el = renderPopup(props);
    const a = el.querySelector('a');
    expect(a).not.toBeNull();
    expect(a.href).toBe('https://example.org/x');
    expect(a.rel).toContain('noopener');
  });

  it('renders image URIs as <img>', () => {
    const props = { thumb: { type: 'uri', value: 'https://example.org/pic.png' } };
    const el = renderPopup(props);
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('respects skip option', () => {
    const props = { secret: { type: 'literal', value: 'hide-me' }, ok: { type: 'literal', value: 'show' } };
    const el = renderPopup(props, { skip: ['secret'] });
    expect(el.textContent).not.toContain('hide-me');
    expect(el.textContent).toContain('show');
  });
});
