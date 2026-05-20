import { defineConfig } from "vite";

// @matdata packages ship IIFE bundles with no module.exports.
// esbuild pre-bundling would produce an empty default export.
// We exclude them from pre-bundling and append an ESM default export
// via a transform plugin so that `import Yasgui from '@matdata/yasgui'`
// returns the actual Yasgui class (including its static .Yasr property).
const iifeInterop = {
  name: "matdata-iife-interop",
  transform(code: string, id: string) {
    if (id.includes("@matdata/yasgui") && id.endsWith("yasgui.min.js")) {
      return { code: code + "\nexport default Yasgui;\n", map: null };
    }
    if (id.includes("@matdata/yasr") && id.endsWith("yasr.min.js")) {
      return { code: code + "\nexport default Yasr;\n", map: null };
    }
  },
};

export default defineConfig({
  root: "demo",
  publicDir: false,
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler", // or "modern"
      },
    },
  },
  optimizeDeps: {
    exclude: ["@matdata/yasgui", "@matdata/yasr"],
  },
  plugins: [iifeInterop],
});
