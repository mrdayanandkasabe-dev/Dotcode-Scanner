import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid missing type definition error for cwd()
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Prioritize process.env.API_KEY (System/Netlify env) -> env.API_KEY (.env file) -> env.VITE_API_KEY
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY || env.VITE_API_KEY || ''),
    },
  };
});