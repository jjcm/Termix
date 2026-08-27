import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const sslCertPath = path.join(process.cwd(), "ssl/termix.crt");
const sslKeyPath = path.join(process.cwd(), "ssl/termix.key");

const hasSSL = fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath);
const useHTTPS = process.env.VITE_HTTPS === "true" && hasSSL;
const apiProxyPorts = [
  30001, 30002, 30003, 30004, 30005, 30006, 30007, 30008, 30009, 30010, 30011,
  30012,
];
const apiProxy = Object.fromEntries(
  apiProxyPorts.map((port) => [
    `/__termix_api/${port}`,
    {
      target: `http://127.0.0.1:${port}`,
      changeOrigin: true,
      ws: true,
      rewrite: (requestPath: string) =>
        requestPath.replace(new RegExp(`^/__termix_api/${port}`), ""),
    },
  ]),
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { version?: string };

const manualChunkGroups: Record<string, string[]> = {
  "react-vendor": ["react", "react-dom"],
  "ui-vendor": [
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-select",
    "@radix-ui/react-tabs",
    "@radix-ui/react-switch",
    "@radix-ui/react-tooltip",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-separator",
    "lucide-react",
    "clsx",
    "tailwind-merge",
    "class-variance-authority",
  ],
  // NOTE: lazy-only vendors (codemirror, monaco, xterm, guacamole, cytoscape,
  // pdf/markdown preview libraries) are deliberately NOT pinned here. Pinning
  // them made the bundler hoist shared boot-needed modules (even React itself)
  // into those vendor chunks, which dragged up to ~970KB (compressed) of
  // editor/preview code onto the boot critical path even though every
  // consumer of those libraries is behind a dynamic import. Left unpinned,
  // they land in the lazy chunks that actually import them.
};

function getManualChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;

  const normalizedId = id.replaceAll("\\", "/");

  for (const [chunkName, packages] of Object.entries(manualChunkGroups)) {
    if (
      packages.some((packageName) =>
        normalizedId.includes(`/node_modules/${packageName}/`),
      )
    ) {
      return chunkName;
    }
  }

  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      packageJson.version || "0.0.0",
    ),
  },
  resolve: {
    alias: {
      "@/types": path.resolve(__dirname, "./src/types"),
      "@": path.resolve(__dirname, "./src/ui"),
    },
  },
  base: process.env.VITE_BASE_PATH || "./",
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    https: useHTTPS
      ? {
          cert: fs.readFileSync(sslCertPath),
          key: fs.readFileSync(sslKeyPath),
        }
      : false,
    port: 5173,
    host: "localhost",
    proxy: apiProxy,
  },
});
