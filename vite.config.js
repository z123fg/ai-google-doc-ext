import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";
import manifest from "./manifest.json";

export default defineConfig({
    resolve: {
        conditions: ["onnxruntime-web-use-extern-wasm"],
    },
    plugins: [
        react(),
        // 1. The Extension Engine
        crx({ manifest }),

        // 2. The WASM Transporter
        // This moves the heavy AI engine files so the extension can find them locally
        viteStaticCopy({
            targets: [
                {
                    // Copy both WebGPU (jsep) and plain WASM runtime files.
                    src: "node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded*",
                    dest: "transformers-bin",
                    rename: { stripBase: true },
                },
            ],
        }),
    ],
    assetsInclude: ["**/*.wasm"],
    build: {
        // 3. Modern JavaScript Target
        // Required for "Top-Level Await" and WebGPU support in 2026
        target: "esnext",
        modulePreload: false,
        rollupOptions: {
            external: [/\.wasm$/],
            input: {
                // We must explicitly tell Vite to build the Offscreen page
                // because it's not directly linked in the manifest.
                offscreen: resolve(__dirname, "src/offscreen.html"),
            },
        },
    },

    server: {
        // 4. The Dev Server "Safety Valve"
        // Allows Vite to reach outside the root folder to find model files in node_modules
        fs: {
            allow: [".."],
        },
        port: 5173,
        hmr: {
            port: 5173,
        },
    },
});
