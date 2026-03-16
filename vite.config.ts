import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isMock = process.env.VITE_MOCK === "true";

export default defineConfig({
	plugins: [
		TanStackRouterVite({
			routesDirectory: "./routes",
			generatedRouteTree: "./routeTree.gen.ts",
		}),
		tailwindcss(),
		react(),
	],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	resolve: {
		alias: {
			...(isMock && {
				"@/lib/rpc": path.resolve(__dirname, "./src/mainview/__mocks__/rpc.ts"),
			}),
			"@": path.resolve(__dirname, "./src/mainview"),
		},
	},
});
