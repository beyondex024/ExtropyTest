import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@extropy/shared": path.resolve(rootDir, "../../packages/shared/src/index.ts")
    }
  },
  server: {
    port: 5173,
    host: true,
  }
});
