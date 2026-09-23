import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const target = process.env.DEV_API_TARGET ?? "http://127.0.0.1:3001";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": target,
      "/shares": target,
      "/stats": target,
      "/photos": target,
    },
  },
});
