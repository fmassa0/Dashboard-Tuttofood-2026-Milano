import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// IMPORTANT: deploying under https://<user>.github.io/Dashboard-Tuttofood-2026-Milano/
// requires base = "/Dashboard-Tuttofood-2026-Milano/". Override via VITE_BASE.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const base = env.VITE_BASE ?? "./";
  return {
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "hall-plan.png", "icons/*.png"],
      manifest: {
        name: "Tuttofood 2026 - Visite Espositori",
        short_name: "TF26 Visite",
        description:
          "Consulta gli espositori di Tuttofood 2026, segna le visite e prendi note. Funziona offline.",
        lang: "it",
        theme_color: "#e30613",
        background_color: "#0b0b0c",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Bundle dei dati JSON (3.6 MB) -> alza il limite
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,png,svg,json,webmanifest,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  };
});
