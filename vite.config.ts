import { defineConfig } from "vite";

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
});
