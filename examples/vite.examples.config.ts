import { defineConfig } from "vite";
import * as path from "node:path";

export default defineConfig({
    root: path.resolve(__dirname),
    appType: "spa",
    server: { port: 5174, open: true },
    esbuild: {
        target: "es2022"
    },
    build: { target: "ESNext" },
    resolve: {
        alias: {
            "@icrusai/ts-router": path.resolve(__dirname, "../dist/index.js"),
            "@": path.resolve(__dirname, "../src")
        }
    }
});
