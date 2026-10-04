import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api/* is forwarded to the FastAPI server on port 8000.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});