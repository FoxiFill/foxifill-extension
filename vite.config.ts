import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: "chunks/[name].[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "popup.html") return "popup/popup.html";
          if (assetInfo.name?.endsWith(".css")) return "styles/[name].[ext]";
          return "assets/[name].[ext]";
        },
      },
    },
  },
  server: {
    port: 8080,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
