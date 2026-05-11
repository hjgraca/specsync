import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        qa: resolve(__dirname, "src/client/qa/index.html"),
        review: resolve(__dirname, "src/client/review/index.html"),
      },
    },
    outDir: "dist/client",
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
      "/documents": "http://localhost:4000",
      "/qa": "http://localhost:4000",
      "/ws": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
  test: {
    exclude: ["node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/client/**"],
    },
  },
});
