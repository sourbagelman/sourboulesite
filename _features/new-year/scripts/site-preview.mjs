// LOOPBACK ONLY. Serves current repository pages; no snapshots, file edits or publishing.
import http from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const site=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const feature=fileURLToPath(new URL('../',import.meta.url));
const origin='http://127.0.0.1:8788';
const pages=new Set(['index.html','brand-home.html','about.html','catering.html','contact.html','events.html','fort-worth.html','locations.html','menu.html','menus-order.html','willow-bend.html','willow-bend-menu.html']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.pdf':'application/pdf','.xml':'application/xml','.txt':'text/plain'};
http.createServer((req,res)=>{
  try{
    if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end('Local host only');return;}
    const path=decodeURIComponent(new URL(req.url,origin).pathname).replace(/^\//,'')||'index.html';
    if(!['GET','HEAD'].includes(req.method)||!(pages.has(path)||/^(assets|images)\//.test(path)||['robots.txt','sitemap.xml'].includes(path))){res.writeHead(404);res.end('Not found');return;}
    const file=resolve(site,path);
    if(!file.startsWith(site+sep)||!statSync(file).isFile())throw new Error('Not found');
    let body=readFileSync(file);
    if(path==='assets/js/new-year-2027.js'){
      body=readFileSync(resolve(feature,'src/integration-loader.js'),'utf8')
        .replace('const ENABLED=false;','const ENABLED=true;')
        .replace("const SERVICE='https://celebrate.thesourboule.com';","const SERVICE='http://127.0.0.1:8787';");
    }
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(8788,'127.0.0.1',()=>console.log('LOCAL ONLY current website + test takeover: '+origin+' (start npm start on port 8787 first). No production artifact is changed or published.'));
