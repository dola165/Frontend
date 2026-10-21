import { createServer } from 'vite';
const apiTarget = process.env.ATLAS_API_TARGET || 'http://127.0.0.1:8187';
const port = Number(process.env.ATLAS_PORT || 5187);
const server=await createServer({root:process.cwd(),define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},server:{host:'127.0.0.1',port,strictPort:true,proxy:{'/api':{target:apiTarget,changeOrigin:true,headers:{origin:'https://app.grasskickz.com'}},'/uploads':{target:'http://127.0.0.1:8080',changeOrigin:true}}}});
await server.listen();console.log(`Map review: http://127.0.0.1:${port}/world`);
