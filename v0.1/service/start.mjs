import {fileURLToPath} from 'node:url';
import {publicServer} from './public_server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const app=await publicServer(root,Number(process.env.PORT??8769));
console.log('HAST-SEC v0.1: '+app.url);
let closing=false;
async function close(){if(closing)return;closing=true;try{await app.close();}catch{process.exitCode=1;}}
process.once('SIGINT',close);process.once('SIGTERM',close);
