import { defineConfig } from "vite";
import * as path from "node:path";

export default defineConfig({
    build: {
        target: "es2022",
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "TsRouter",
            formats: ["es", "cjs"],
            fileName: (format) => (format === "es" ? "index.js" : "index.cjs")
        },
        rollupOptions: {
            external: []
        },
        sourcemap: true
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src")
        }
    }
});