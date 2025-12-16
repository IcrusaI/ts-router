import { defineConfig } from "vite";
import * as path from "node:path";

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "TsRouter",
            formats: ["es", "cjs"],
            fileName: (format) => (format === "es" ? "index.js" : "index.cjs")
        },
        rollupOptions: {
            // Внешние зависимости (если появятся) — помести сюда, чтобы не тащить в бандл
            external: [],
        },
        sourcemap: true,
        target: "es2022"
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src")
        }
    }
});