import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: 'src/routes', generatedRouteTree: 'src/routeTree.gen.ts' }), react()],
  server: {
    port: 5173,
  },
});
