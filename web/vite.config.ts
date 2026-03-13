import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/days": "http://localhost:8000",
      "/entries": "http://localhost:8000",
      "/chat": "http://localhost:8000",
    },
  },
});
