import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const projectRoot=fileURLToPath(new URL('../../',import.meta.url));

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,projectRoot,'');
  const serverHost=env.SERVER_HOST||'127.0.0.1';
  const serverPort=Number(env.PORT)||3001;
  const devHost=env.VITE_DEV_SERVER_HOST||'127.0.0.1';
  const devPort=Number(env.VITE_DEV_SERVER_PORT)||5173;
  return {
  envDir:projectRoot,
  resolve: {
    alias: { '@neon-rival/simulation': fileURLToPath(new URL('../../packages/simulation/src/index.ts', import.meta.url)) },
  },
  server:{host:devHost,port:devPort,strictPort:true,proxy:{'/ws':{target:`ws://${serverHost}:${serverPort}`,ws:true,changeOrigin:true}}},
  preview:{host:env.VITE_PREVIEW_HOST||'127.0.0.1',port:Number(env.VITE_PREVIEW_PORT)||4173,strictPort:true},
  build: { outDir: '../../build/client', emptyOutDir: true },
};
});
