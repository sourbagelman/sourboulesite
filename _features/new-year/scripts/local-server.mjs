// LOOPBACK-ONLY laboratory. Never deploy this file. No cloud credentials needed.
import http from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../src/worker.mjs';
import {EVENT} from '../src/config.mjs';
import {randomToken} from '../src/crypto.mjs';
import {LocalD1} from './sqlite-adapter.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)), local=resolve(process.env.NYE_LAB_DATA||resolve(root,'.local'));mkdirSync(local,{recursive:true});
const secretFile=resolve(local,'lab-secret');if(!existsSync(secretFile))writeFileSync(secretFile,randomToken(),{mode:0o600});
const PASS_SECRET=readFileSync(secretFile,'utf8').trim();
const db=new LocalD1(resolve(local,'nye-v2.sqlite'));await db.exec(readFileSync(resolve(root,'migrations/0001_initial.sql'),'utf8'));
if(!(await db.prepare('PRAGMA table_info(entries)').all()).results.some(column=>column.name==='pre_observed_ms')){
  db.close();throw new Error('Earlier lab database schema. Preserve that database; set NYE_LAB_DATA to a new empty local directory. This fresh schema is not a data migration.');
}
const staffToken=process.env.LAB_STAFF_TOKEN||randomToken(),secondStaffToken=process.env.LAB_WB_STAFF_TOKEN||randomToken(),controlToken=process.env.LAB_CONTROL_TOKEN||randomToken();
let simBase=EVENT.start,realBase=performance.now(),frozen=false;
const clock=()=>simBase+(frozen?0:Math.floor(performance.now()-realBase));
for(const [subject,location] of [['lab-fw','fort-worth'],['lab-wb','willow-bend']]){
  await db.prepare('INSERT OR IGNORE INTO staff_users(subject,email) VALUES(?,?)').bind(subject,subject+'@example.invalid').run();
  await db.prepare('INSERT OR IGNORE INTO staff_locations(subject,location) VALUES(?,?)').bind(subject,location).run();
}
// Test-only windows, NOT approved holiday operating hours. Distinct from migration.
for(const location of ['fort-worth','willow-bend'])await db.prepare('INSERT OR IGNORE INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES(?,?,?,?)').bind(location,EVENT.midnight+3600000,EVENT.expires,'LOCAL TEST WINDOW - NOT BUSINESS HOURS').run();
const port=Number(process.env.PORT||8787),origin='http://127.0.0.1:'+port;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const env={DB:db,PASS_SECRET,WEBSITE_ORIGINS:origin+',http://127.0.0.1:8788',ASSETS:{async fetch(request){let path=new URL(request.url).pathname;if(path==='/'||path==='/pass')path='/index.html';if(path==='/staff'||path==='/staff/')path='/staff/index.html';let file=resolve(root,'public','.'+path);if(!file.startsWith(resolve(root,'public')+sep)||!existsSync(file))return new Response('Not found',{status:404});return new Response(readFileSync(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}}};
const staffAuth=async request=>{
  const bearer=request.headers.get('authorization')?.replace('Bearer ','');
  const saved=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('sb_lab_staff='))?.slice(13);
  const token=bearer||saved;
  if(token!==staffToken&&token!==secondStaffToken)throw new Error('Local lab staff sign-in required');
  const subject=token===staffToken?'lab-fw':'lab-wb';return {subject,email:subject+'@example.invalid'};
};
const app=createApp({clock,staffAuth,lab:true});
const server=http.createServer(async(req,res)=>{
  try{
    // Bind loopback and reject foreign Host headers to limit DNS-rebinding access.
    if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end('Local host only');return;}
    let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4096){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
    const request=new Request(origin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    const path=new URL(request.url).pathname;
    let response;
    if(path.startsWith('/__lab/')){
      if(path==='/__lab/login'&&req.method==='GET'){
        response=new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local staff lab sign-in</title><style>body{font:17px system-ui;max-width:500px;margin:60px auto;padding:24px}input,button{font:inherit;display:block;width:100%;box-sizing:border-box;padding:14px;margin:14px 0}p{line-height:1.6}</style><h1>LOCAL TEST staff sign-in</h1><p>Paste the local staff token printed by npm start. This is not a production staff login.</p><form><label for="token">Local staff token</label><input type="password" id="token" required autocomplete="off"><button>Open local redemption lab</button></form><p id="error" role="status"></p><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/__lab/staff-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:document.querySelector('#token').value})});if(r.ok)location.assign('/staff/');else document.querySelector('#error').textContent='The local token was not accepted.';};</script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
      }else if(req.method!=='POST'||headers.get('origin')!==origin){response=Response.json({error:'Local POST only'},{status:403});}
      else if(path==='/__lab/time'&&headers.get('X-Lab-Control')===controlToken){const input=await request.json();if(!Number.isFinite(input.now))throw new Error('Expected numeric now');simBase=input.now;realBase=performance.now();frozen=input.freeze===true;response=Response.json({now:clock(),mode:'LOCAL TEST ONLY'});}
      else if(path==='/__lab/staff-login'){const input=await request.json();response=(input.token===staffToken||input.token===secondStaffToken)?Response.json({signedIn:true},{headers:{'Set-Cookie':`sb_lab_staff=${input.token}; Path=/; HttpOnly; SameSite=Strict`}}):Response.json({error:'Incorrect lab token'},{status:401});}
      else response=Response.json({error:'Local control unauthorized'},{status:403});
    }else response=await app.fetch(request,env);
    const h={};response.headers.forEach((v,k)=>h[k]=v);res.writeHead(response.status,h);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(port,'127.0.0.1',()=>{
  console.log('\nLOCAL TEST LAB ONLY - NOT A LIVE PROMOTION');
  console.log('Guest: '+origin+'\nStaff sign-in: '+origin+'/__lab/login');
  console.log('Fort Worth lab staff token (local only): '+staffToken);
  console.log('Willow Bend lab staff token (local only): '+secondStaffToken);
  console.log('Lab control token (local only): '+controlToken);
  console.log('Server clock starts at Dec 31 2026, 11:50 PM America/Chicago.');
  console.log('Database: '+resolve(local,'nye-v2.sqlite')+'. No production files or services changed.\n');
});
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
