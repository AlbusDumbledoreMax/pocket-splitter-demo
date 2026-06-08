import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend", // <--- important: use the frontend folder as root
  plugins: [react()],
  server: {
    port: 4173,
    host: "127.0.0.1",
  },
});
