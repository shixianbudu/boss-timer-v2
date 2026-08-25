import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // 浏览器环境使用 mqtt 的 ESM 预构建版本，避免 Node polyfill 问题
      mqtt: path.resolve(__dirname, "node_modules/mqtt/dist/mqtt.esm.js"),
    },
  },
});
