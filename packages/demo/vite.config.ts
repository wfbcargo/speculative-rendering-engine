import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@sre/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@sre/react": fileURLToPath(
        new URL("../react/src/index.tsx", import.meta.url),
      ),
    },
  },
});
