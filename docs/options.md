# Plugin options

Pass options to the geo plugin via Yasgui's standard plugin-config slot:

```js
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  yasr: {
    pluginOrder: ['table', 'response', 'geo'],
    defaultPlugin: 'geo',
    plugins: {
      geo: {
        defaultColor: '#ff5722',
        defaultBasemap: 'CartoDB Voyager',
        initialView: { center: [48.8566, 2.3522], zoom: 11 },
        maxZoom: 18,
        minHeight: 600,
        latLonAutoDetect: true,
        // Replace the bundled basemaps entirely:
        basemaps: {
          'My tiles': L.tileLayer('https://my.tiles/{z}/{x}/{y}.png'),
        },
      },
    },
  },
});
```

## Available options

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultColor` | `string` (CSS color) | `#3388ff` | Color used for features without a `?wktColor` binding. |
| `defaultBasemap` | `string` | `'openStreetMap'` | Name of the basemap to activate at startup. Must be a key of `basemaps`. |
| `initialView` | `{ center: [lat, lon], zoom: number }` | Belgium @ 5 | Map center and zoom when no features are present. |
| `maxZoom` | `number` | `14` | Upper bound applied when auto-fitting bounds to features. |
| `minHeight` | `number` (px) | `500` | Minimum height of the map container. |
| `latLonAutoDetect` | `boolean` | `true` | Auto-detect numeric lat/lon column pairs and synthesize a WKT POINT column. |
| `basemaps` | `{ [name]: L.TileLayer }` | built-in | Replace the bundled basemap dictionary. |

## Convention-based per-feature controls

Bindings the plugin recognizes when present in result rows:

| Binding | Effect |
|---|---|
| `?wktColor` | Override fill/stroke color for that feature. |
| `?wktLabel` | Plain-text popup content (replaces the default key/value table). |
| `?wktTooltip` | Hover tooltip text. |
