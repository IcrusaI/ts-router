import { defineConfig } from "vite";
import * as path from "node:path";

export default defineConfig({
    root: path.resolve(__dirname),
    server: { port: 5174, open: true },
    resolve: {
        alias: {
            "@icrusai/ts-router": path.resolve(__dirname, "../dist/index.js")
        }
    },
    appType: "spa"
});