import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/front-scampia/" : "/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
  },
}));
