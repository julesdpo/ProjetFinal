import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const certPath = env.TLS_CERT_PATH || './certs/dev.cert';
  const keyPath = env.TLS_KEY_PATH || './certs/dev.key';
  const https = fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
    : false;

  return {
    plugins: [react()],
    server: {
      https,
      port: 4173
    },
    preview: {
      https,
      port: 4173
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') }
    }
  };
});
