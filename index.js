import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import proj4 from 'proj4';
import { wktToGeoJSON } from 'betterknown';
import { renderPopup } from './src/popup.js';
import { injectLatLonPointColumn } from './src/latlon.js';
import { parseGML } from './src/gml.js';
import { enableDrawing } from './src/draw.js';
import { simplifyFeatureCollection } from './src/simplify.js';
import { addExportControl } from './src/export.js';
import { bindHashState } from './src/permalink.js';
import { addCoordinateDisplay, addMeasureControl } from './src/controls.js';

// Known SRID proj4 definitions. Add more as needed.
const SRID_PROJ = {
  // Proj4 defaults to longitude first axis order!!
  '4326': '+proj=longlat +datum=WGS84 +ellps=WGS84 +no_defs',
  // Web Mercator
  '3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0 +x_0=0 +y_0=0 +k=1.0 +units=m +no_defs',
  // Belgium Lambert 1972
  '31370': '+proj=lcc +lat_1=51.166667 +lat_2=49.833333 +lat_0=90 +lon_0=4.367486666666667 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +units=m +no_defs',
  // ETRS89 geographic
  '4258': '+proj=longlat +ellps=GRS80 +no_defs',
  // ETRS89 / LAEA Europe
  '3035': '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs',
  // ETRS89 / UTM zone 31N
  '25831': '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs',
  // ETRS89 / UTM zone 32N
  '25832': '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',
  // ETRS89 / UTM zone 33N
  '25833': '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',
  // RGF93 / Lambert-93 (France)
  '2154': '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  // OSGB36 / British National Grid
  '27700': '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
  // Amersfoort / RD New (Netherlands)
  '28992': '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs',
  // SWEREF99 TM (Sweden)
  '3006': '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  // CH1903+ / LV95 (Switzerland)
  '2056': '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs',
  // NAD83 geographic
  '4269': '+proj=longlat +ellps=GRS80 +datum=NAD83 +no_defs',
  // NAD83 / Canada Atlas Lambert
  '3978': '+proj=lcc +lat_1=49 +lat_2=77 +lat_0=49 +lon_0=-95 +x_0=0 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=m +no_defs',
};

// Register known SRID projections with proj4
for (const [srid, definition] of Object.entries(SRID_PROJ)) {
  proj4.defs(`EPSG:${srid}`, definition);
}


/**
 * Ensure an EPSG SRID is registered with proj4.
 * Uses an in-flight promise cache to avoid duplicate network requests
 * and a failure cache to avoid repeated failed attempts.
 *
 * @param {string|number} srid - EPSG numeric code or string like '4326'
 * @returns {Promise<void>} resolves once registration is ensured (or fetch fails)
 */
const sridFetchPromises = new Map();
const sridFailedCache = new Set();

const ensureSridRegistered = async (srid) => {
  const code = `EPSG:${String(srid)}`;

  // Already registered
  if (proj4.defs(code)) return;

  // If previous attempt failed, skip retrying (avoid repeated 404 calls).
  if (sridFailedCache.has(code)) {
    console.debug(`Skipping previously failed SRID fetch for ${code}`);
    return;
  }

  // If there's already a fetch in progress for this SRID, reuse it
  if (sridFetchPromises.has(code)) {
    return sridFetchPromises.get(code);
  }

  const fetchPromise = (async () => {
    try {
      console.debug(`Fetching proj4 definition for ${code}`);
      const response = await fetch(`https://epsg.io/${srid}.proj4`);
      if (response.ok) {
        const proj4Def = await response.text();
        if (proj4Def && !proj4.defs(code)) {
          proj4.defs(code, proj4Def);
          console.debug(`Registered SRID ${srid} with proj4: ${proj4Def}`);
        }
      } else {
        console.warn(`Failed to fetch proj4 definition for SRID ${srid}, status: ${response.status}`);
        // Mark as failed to avoid repeated attempts in current runtime
        sridFailedCache.add(code);
      }
    } catch (error) {
      console.error(`Error fetching proj4 definition for SRID ${srid}:`, error);
      // In case of transient network errors don't mark as permanently failed,
      // so future attempts may still retry (optional: could add rate limiting)
    } finally {
      // Clean up in-flight cache
      sridFetchPromises.delete(code);
    }
  })();

  sridFetchPromises.set(code, fetchPromise);
  return fetchPromise;
};


const builtInBasemaps = {
  // OpenStreetMap
  openStreetMap: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '© OpenStreetMap contributors',
    },
  ),
  // OpenTopoMap
  openTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors',
  }),

  // ESRI World Imagery (Satellite)
  'ESRI World Imagery (Satellite)': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  ),

  // CartoDB Voyager
  'CartoDB Voyager': L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; CartoDB',
    },
  ),

  // CartoDB Dark Matter (good for dark mode)
  'CartoDB Dark Matter': L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; CartoDB',
    },
  ),
};

/**
 * Recursively reprojects all coordinates in a GeoJSON geometry
 * from a source CRS to WGS84 (EPSG:4326).
 * Handles GeometryCollection by recursing into sub-geometries.
 *
 * @param {Object} geometry - GeoJSON geometry object
 * @param {string} fromCRS - Source CRS string (e.g. 'EPSG:25832')
 * @returns {Object} New geometry with reprojected coordinates
 */
const reprojectGeometry = (geometry, fromCRS) => {
  if (!geometry) return geometry;
  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: geometry.geometries.map(g => reprojectGeometry(g, fromCRS)),
    };
  }
  const transformCoords = (coords) => {
    if (!Array.isArray(coords)) return coords;
    if (typeof coords[0] === 'number') {
      const [lng, lat] = proj4(fromCRS, 'EPSG:4326', [coords[0], coords[1]]);
      return coords.length > 2 ? [lng, lat, coords[2]] : [lng, lat];
    }
    return coords.map(transformCoords);
  };
  return { ...geometry, coordinates: transformCoords(geometry.coordinates) };
};

/**
 * Recursively swaps lat/lon axis order in a GeoJSON geometry.
 * Used for OGC WKT with the EPSG:4326 URI, which stores coordinates as (lat, lon).
 * Handles GeometryCollection by recursing into sub-geometries.
 *
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {Object} New geometry with swapped axes
 */
const swapLatLon = (geometry) => {
  if (!geometry) return geometry;
  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: geometry.geometries.map(swapLatLon),
    };
  }
  const swapCoords = (coords) => {
    if (!Array.isArray(coords)) return coords;
    if (typeof coords[0] === 'number') {
      return coords.length > 2 ? [coords[1], coords[0], coords[2]] : [coords[1], coords[0]];
    }
    return coords.map(swapCoords);
  };
  return { ...geometry, coordinates: swapCoords(geometry.coordinates) };
};

const parseWKT = async (wkt) => {
  const trimmed = wkt.trimStart();

  // CRS84 — longitude/latitude, WGS84. Treat as plain WKT.
  const crs84Match = trimmed.match(/^<(?:http:\/\/www\.opengis\.net\/def\/crs\/OGC\/[^>]*\/CRS84|urn:ogc:def:crs:OGC:[^:]*:CRS84)>\s*([\s\S]*)$/i);
  if (crs84Match) {
    return wktToGeoJSON(crs84Match[1].trim());
  }

  // urn:ogc:def:crs:EPSG::<code> — OGC URN form. Same semantics as
  // <http://www.opengis.net/def/crs/EPSG/0/...>: axis order follows the
  // authority definition (lat,lon for 4326).
  const urnMatch = trimmed.match(/^<urn:ogc:def:crs:EPSG:[^:]*:(\d+)>\s*([\s\S]*)$/i);
  if (urnMatch) {
    const epsgCode = urnMatch[1];
    const rawWkt = urnMatch[2].trim();
    if (epsgCode === '4326') return swapLatLon(wktToGeoJSON(rawWkt));
    await ensureSridRegistered(epsgCode);
    return reprojectGeometry(wktToGeoJSON(rawWkt), `EPSG:${epsgCode}`);
  }

  // OGC URI with EPSG:4326 — coordinates are in (lat, lon) order per the OGC standard.
  // Parse the raw WKT without betterknown's SRID handling, then swap axes ourselves.
  // This also correctly handles GeometryCollection sub-geometries, unlike betterknown's
  // built-in proj integration which loses the inherited SRID for nested geometries.
  if (trimmed.startsWith('<http://www.opengis.net/def/crs/EPSG/0/4326>')) {
    const match = trimmed.match(/^<http:\/\/www\.opengis\.net\/def\/crs\/EPSG\/0\/4326>\s*([\s\S]*)$/);
    if (match) {
      return swapLatLon(wktToGeoJSON(match[1].trim()));
    }
  }
  // OGC URI with other EPSG codes — parse raw WKT and reproject manually.
  // betterknown's proj4 integration is bypassed because it loses the inherited SRID
  // when recursing into GeometryCollection sub-geometries (sets srid: null on inner geoms).
  if (trimmed.startsWith('<http://www.opengis.net/def/crs/EPSG/0/')) {
    const match = trimmed.match(/^<http:\/\/www\.opengis\.net\/def\/crs\/EPSG\/0\/(\d+)>\s*([\s\S]*)$/);
    if (match) {
      const epsgCode = match[1];
      await ensureSridRegistered(epsgCode);
      return reprojectGeometry(wktToGeoJSON(match[2].trim()), `EPSG:${epsgCode}`);
    }
  }
  // SRID=xxxx; prefix — same issue with betterknown, reproject manually.
  if (trimmed.startsWith('SRID=') || trimmed.startsWith('srid=')) {
    const match = trimmed.match(/^SRID=(\d+);([\s\S]*)$/i);
    if (match) {
      const epsgCode = match[1];
      const rawWkt = match[2].trim();
      if (epsgCode === '4326') {
        return wktToGeoJSON(rawWkt);
      }
      await ensureSridRegistered(epsgCode);
      return reprojectGeometry(wktToGeoJSON(rawWkt), `EPSG:${epsgCode}`);
    }
  }
  // Plain WKT with no CRS prefix — assumed WGS84 (lon/lat), pass through as-is.
  return wktToGeoJSON(wkt, { proj: proj4 });
}

/**
 * Map of supported RDF datatype URIs to converter functions.
 * Converter functions accept a string (literal value) and may return synchronously or return a Promise.
 * Synchronous converter example: JSON.parse (for geoJSONLiteral).
 *
 * @type {Object.<string, function(string): (Object|Promise<Object>)>}
 */
const conversions = {
  'http://www.opengis.net/ont/geosparql#wktLiteral': parseWKT,
  'http://www.openlinksw.com/schemas/virtrdf#Geometry': parseWKT,
  'http://www.opengis.net/ont/geosparql#geoJSONLiteral': JSON.parse,
  'http://www.opengis.net/ont/geosparql#gmlLiteral': parseGML,
};

/**
 * Creates a GeoJSON object from SPARQL query bindings.
 *
 * @param {Array} bindings - An array of binding objects from a SPARQL query result.
 * @param {string} wktColumn - The key in the binding objects that contains the WKT (Well-Known Text) geometry.
 * @returns {Object} A GeoJSON object representing the features.
 */
const createGeojson = async (bindings, column) => ({
  type: 'FeatureCollection',
  features: (await Promise.all(
    bindings.map(async (item) => {
      const converter = conversions[item[column].datatype];
      if (!converter) {
        return {
          type: 'Feature',
          properties: item,
          geometry: null,
        };
      }
      try {
        const geometry = await converter(item[column].value);
        return {
          type: 'Feature',
          properties: item,
          geometry,
        };
      } catch (error) {
        console.warn(`Failed to parse geometry for column "${column}":`, item[column].value, error);
        return null; // Skip this feature
      }
    }),
  )).filter(feature => feature !== null),
});

/**
 * Default plugin options. Override per-instance via Yasgui config:
 *   yasr: { plugins: { geo: { ...overrides } } }
 */
const DEFAULT_OPTIONS = {
  latLonAutoDetect: true,
  defaultColor: '#3388ff',
  defaultBasemap: 'openStreetMap',
  initialView: { center: [50.6411, 4.6680], zoom: 5 },
  maxZoom: 14,
  minHeight: 500,
  basemaps: null, // null = use built-in `basemaps`
  clustering: true,
  clusterMinPoints: 50,
  maxClusterRadius: 60,
  heatmap: false,
  heatmapRadius: 25,
  heatmapBlur: 15,
  drawing: false,
  simplifyTolerance: 0,
  exportControl: true,
  permalink: false,
  showCoordinates: true,
  measure: true,
  darkMode: 'auto', // 'auto' | true | false
};

/**
 * GeoPlugin: YASR plugin that displays geographic results in a Leaflet map.
 *
 * @class
 */
class GeoPlugin {
  /**
   * Create a new GeoPlugin instance.
   *
   * @param {Object} yasr - The YASR instance the plugin is attached to. Expected to expose results.json.results.bindings and resultsEl.
   */
  constructor(yasr) {
    this.yasr = yasr;
    this.priority = 30;
    this.label = 'Geo';
    this.geometryColumns = [];
    this.options = {
      ...DEFAULT_OPTIONS,
      ...(yasr?.config?.plugins?.geo?.dynamicConfig || {}),
      ...(yasr?.config?.plugins?.geo || {}),
    };
    this.updateColumns();
  }

  /**
   * Update detected geometry columns based on current YASR results.
   * Scans all rows (not just the first) so optional geometry bindings are
   * still detected when the first row happens to lack them.
   * @returns {void}
   */
  updateColumns() {
    const bindings = this.yasr?.results?.json?.results?.bindings ?? [];
    // Synthesize a WKT POINT column from numeric lat/lon pairs (best-effort).
    if (this.options?.latLonAutoDetect !== false) {
      injectLatLonPointColumn(bindings);
    }
    const seen = new Map();
    for (const row of bindings) {
      for (const colName of Object.keys(row)) {
        if (seen.has(colName)) continue;
        const datatype = row[colName]?.datatype;
        if (datatype && Object.keys(conversions).includes(datatype)) {
          seen.set(colName, { colName, datatype });
        }
      }
    }
    this.geometryColumns = Array.from(seen.values());
  }

  /**
   * Called by YASR to render the visualization.
   * @returns {Promise<void>}
   */
  async draw() {
    this.updateColumns();
    await this.updateMap();
  }

  /**
   * Build or update the Leaflet map with the current results.
   * @returns {Promise<void>}
   */
  async updateMap() {
    const opts = this.options;
    const basemaps = opts.basemaps || builtInBasemaps;
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.style.height = '100%';
      this.container.style.minHeight = `${opts.minHeight}px`;
      this.container.style.width = '100%';
      const map = L.map(this.container, {
        center: opts.initialView.center,
        zoom: opts.initialView.zoom,
      });
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = opts.darkMode === true || (opts.darkMode === 'auto' && prefersDark);
      const initialBasemapName = isDark && basemaps['CartoDB Dark Matter']
        ? 'CartoDB Dark Matter'
        : opts.defaultBasemap;
      const initialBasemap = basemaps[initialBasemapName] || Object.values(basemaps)[0];
      initialBasemap.addTo(map);
      this.layerControl = L.control.layers(basemaps, {}).addTo(map);
      this.map = map;
      this.columnLayers = new Map();
      this._featureCollections = new Map();
      if (opts.drawing) {
        enableDrawing(map);
      }
      if (opts.exportControl) {
        addExportControl(map, () => ({
          type: 'FeatureCollection',
          features: Array.from(this._featureCollections.values())
            .flatMap(fc => fc.features || []),
        }));
      }
      if (opts.permalink) {
        bindHashState(map, { basemaps, currentBasemapName: opts.defaultBasemap });
      }
      if (opts.showCoordinates) addCoordinateDisplay(map);
      if (opts.measure) addMeasureControl(map);
    }
    this.yasr.resultsEl.appendChild(this.container);

    // Remove previous per-column overlays from map + control
    for (const [, lg] of this.columnLayers) {
      this.layerControl.removeLayer(lg);
      this.map.removeLayer(lg);
    }
    this.columnLayers.clear();
    this._featureCollections.clear();

    const palette = ['#3388ff', '#e6550d', '#31a354', '#756bb1', '#d62728', '#17becf'];
    const allBounds = L.latLngBounds([]);

    for (const [idx, geometryColumn] of this.geometryColumns.entries()) {
      const colName = geometryColumn.colName;
      const geojson = await createGeojson(
        this.yasr.results.json.results.bindings,
        colName,
      );
      const simplified = opts.simplifyTolerance > 0
        ? simplifyFeatureCollection(geojson, opts.simplifyTolerance)
        : geojson;
      this._featureCollections.set(colName, simplified);
      const layerColor = palette[idx % palette.length];
      const DEFAULT_COLOR = opts.defaultColor === DEFAULT_OPTIONS.defaultColor
        ? layerColor
        : opts.defaultColor;

      const lg = L.featureGroup();
      const newLayers = L.geoJson(simplified, {
        pointToLayer: (feature, latlng) => {
          const color = feature.properties?.wktColor?.value || DEFAULT_COLOR;
          return L.circleMarker(latlng, {
            radius: 4,
            weight: 2,
            color: color,
            fillColor: color,
            opacity: 0.7,
            fillOpacity: 0.5,
          });
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          if (p.wktLabel?.value) {
            const span = document.createElement('span');
            span.textContent = p.wktLabel.value;
            layer.bindPopup(span);
          } else {
            layer.bindPopup(renderPopup(p, { skip: ['wktLabel', 'wktTooltip', 'wktColor'] }));
          }
          if (p.wktTooltip?.value) {
            layer.bindTooltip(p.wktTooltip.value);
          }
        },
        style: (feature) => {
          const color = feature.properties?.wktColor?.value || DEFAULT_COLOR;
          return {
            color, fillColor: color, weight: 2, opacity: 0.7, fillOpacity: 0.5,
          };
        },
      });

      const pointCount = (simplified.features || []).filter(
        f => f.geometry?.type === 'Point' || f.geometry?.type === 'MultiPoint',
      ).length;

      if (opts.heatmap && pointCount > 0 && typeof L.heatLayer === 'function') {
        const heatPoints = [];
        for (const f of simplified.features) {
          if (f.geometry?.type === 'Point') {
            const [lon, lat] = f.geometry.coordinates;
            heatPoints.push([lat, lon, 1]);
          } else if (f.geometry?.type === 'MultiPoint') {
            for (const [lon, lat] of f.geometry.coordinates) heatPoints.push([lat, lon, 1]);
          }
        }
        const heat = L.heatLayer(heatPoints, {
          radius: opts.heatmapRadius,
          blur: opts.heatmapBlur,
        });
        lg.addLayer(heat);
        // Still add non-point features as vector overlays
        const vectorOnly = {
          ...simplified,
          features: simplified.features.filter(f =>
            f.geometry?.type !== 'Point' && f.geometry?.type !== 'MultiPoint'),
        };
        if (vectorOnly.features.length) lg.addLayer(L.geoJson(vectorOnly, newLayers.options));
      } else {
        const useCluster = opts.clustering
          && pointCount >= opts.clusterMinPoints
          && typeof L.markerClusterGroup === 'function';
        if (useCluster) {
          const cluster = L.markerClusterGroup({ maxClusterRadius: opts.maxClusterRadius });
          cluster.addLayer(newLayers);
          lg.addLayer(cluster);
        } else {
          lg.addLayer(newLayers);
        }
      }
      lg.addTo(this.map);
      this.layerControl.addOverlay(lg, `?${colName}`);
      this.columnLayers.set(colName, lg);
      const b = lg.getBounds();
      if (b.isValid()) allBounds.extend(b);
    }

    setTimeout(() => {
      this.map.invalidateSize();
      if (allBounds.isValid()) {
        this.map.fitBounds(allBounds, { padding: [20, 20], maxZoom: opts.maxZoom });
      }
    }, 100);
  }

  /**
   * Return an element used as a icon for the plugin.
   * @returns {HTMLElement}
   */
  getIcon() {
    const icon = document.createElement('div');
    icon.innerHTML = '🌍';
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', 'Geo map view');
    icon.title = 'Geo map view';
    return icon;
  }

  /**
   * Check whether current results contain supported geometry columns.
   * @returns {boolean}
   */
  canHandleResults() {
    this.updateColumns();
    return this.geometryColumns && this.geometryColumns.length > 0;
  }
}

export default GeoPlugin;
