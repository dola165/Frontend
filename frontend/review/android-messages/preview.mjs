import {readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
const root='C:/Users/daddo/IdeaProjects/GrassKickZ',control=root+'/build/android-messages-fixture';
const f=JSON.parse(await readFile(control+'/fixture.json','utf8'));
const server=await createServer({root:process.cwd(),configFile:path.resolve('vite.config.ts'),
 define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(f.backend+'/api'),'import.meta.env.VITE_ENABLE_MOCKS':'"false"'},
 server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false}});
await server.listen();await writeFile(control+'/web-ready','ready');console.log('Web app ready for the Messages fixture on port 5187.');
const deadline=Date.now()+12*60*60*1000;
while(Date.now()<deadline){try{await access(control+'/stop-web');break;}catch{}await new Promise(r=>setTimeout(r,1000));}
await server.close();
