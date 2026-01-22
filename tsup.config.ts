import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['app.tsx'],
  format: ['esm'],
  clean: true,
  // Bundle ALL the UI libraries to remove internal 'require' conflicts
  external: ['react-devtools-core'],
});
