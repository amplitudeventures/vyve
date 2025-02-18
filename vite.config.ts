import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({ mode }) => {
  // Load default environment variables
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    envDir: '.',
    envPrefix: 'VITE_',
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    plugins: [
      react(),
      wasm(),
      topLevelAwait(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ['pdfjs-dist']
          }
        }
      }
    },
    publicDir: path.resolve(__dirname, 'node_modules/pdfjs-dist/build'),
    // Make environment variables available
    define: {
      __ENV__: JSON.stringify(env)
    }
  };
});