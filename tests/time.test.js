import { describe, it, expect } from 'vitest';
import { collectTimeValues, filterFeatureCollectionByTime, formatTimeLabel, getFeatureTime, parseTemporalValue } from '../src/time.js';

const feature = (time, id = time) => ({
  type: 'Feature',
  properties: { id: { value: id }, time: { value: time } },
  geometry: { type: 'Point', coordinates: [0, 0] },
});

describe('time helpers', () => {
  it('parses ISO dates and rejects invalid values', () => {
    expect(parseTemporalValue({ value: '2024-01-02' })).toBe(Date.parse('2024-01-02'));
    expect(parseTemporalValue({ value: 'not a date' })).toBeNull();
  });

  it('detects configured feature time bindings', () => {
    expect(getFeatureTime({ properties: { date: { value: '2024-01-02' } } })).toBe(Date.parse('2024-01-02'));
  });

  it('collects sorted unique time values', () => {
    const values = collectTimeValues([feature('2024-01-03'), feature('2024-01-01'), feature('2024-01-03')]);
    expect(values).toEqual([Date.parse('2024-01-01'), Date.parse('2024-01-03')]);
  });

  it('filters cumulatively by default and keeps undated features', () => {
    const undated = { type: 'Feature', properties: { id: { value: 'undated' } }, geometry: null };
    const fc = { type: 'FeatureCollection', features: [feature('2024-01-01'), feature('2024-01-03'), undated] };
    const out = filterFeatureCollectionByTime(fc, Date.parse('2024-01-02'));
    expect(out.features.map(f => f.properties.id.value)).toEqual(['2024-01-01', 'undated']);
  });

  it('can filter exact instants', () => {
    const fc = { type: 'FeatureCollection', features: [feature('2024-01-01'), feature('2024-01-03')] };
    const out = filterFeatureCollectionByTime(fc, Date.parse('2024-01-03'), { mode: 'instant' });
    expect(out.features).toHaveLength(1);
    expect(out.features[0].properties.id.value).toBe('2024-01-03');
  });

  it('formats slider labels as ISO text', () => {
    expect(formatTimeLabel(Date.parse('2024-01-02'))).toBe('2024-01-02');
  });
});
