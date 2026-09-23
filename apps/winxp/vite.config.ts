import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// 8787 is wrangler dev's default port — see `npm run worker:dev`.
const target = process.env.DEV_API_TARGET ?? "http://127.0.0.1:8787";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/shares": target,
      "/photos": target,
    },
  },
});
