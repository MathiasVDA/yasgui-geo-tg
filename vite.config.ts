import { defineConfig } from "vite";

// leaflet-draw, leaflet.markercluster and leaflet.heat are IIFEs/UMDs that
// read the global L; expose Leaflet on window before they execute.
const leafletPluginInterop = {
  name: "leaflet-plugin-interop",
  transform(code: string, id: string) {
    if (id.includes("leaflet-draw") && id.includes("leaflet.draw.js")) {
      return { code: `import L from 'leaflet';\nwindow.L = L;\n` + code, map: null };
    }
    if (id.includes("leaflet.markercluster") && id.includes("leaflet.markercluster-src.js")) {
      return { code: `import L from 'leaflet';\nwindow.L = L;\n` + code, map: null };
    }
    if (id.includes("leaflet.heat") && id.includes("leaflet-heat.js")) {
      return { code: `import L from 'leaflet';\nwindow.L = L;\n` + code, map: null };
    }
  },
};

export default defineConfig({
  root: "demo",
  publicDir: false,
  server: {
    host: "0.0.0.0",
    port: 3000,
    open: false,
  },
  optimizeDeps: {
    exclude: ["leaflet-draw", "leaflet.markercluster", "leaflet.heat"],
  },
  plugins: [leafletPluginInterop],
});
