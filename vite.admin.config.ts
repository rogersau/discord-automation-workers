import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-admin",
    emptyOutDir: true,
    rollupOptions: {
      input: { admin: "src/admin/main.tsx" },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "admin.css";
          return "[name].[ext]";
        },
      },
    },
  },
});
