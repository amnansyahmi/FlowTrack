import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: [
        "logos/*.svg",
        "app-icon.svg",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "FlowTrack",
        short_name: "FlowTrack",
        description: "Personal finance, clearly.",
        start_url: "/",
        display: "standalone",
        background_color: "#f7f7f5",
        theme_color: "#17624a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: "0.0.0.0",
    port: 3000,
    hmr: process.env.DISABLE_HMR !== "true",
  },
});
