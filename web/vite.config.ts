import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // forward API calls to the backend (port from backend/.env) so the browser needs no CORS
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
});
