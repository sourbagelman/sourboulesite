// Local test adapter for D1's prepare/bind/first/all/run/batch subset.
// It executes the SAME SQL as the Worker. This is not the Cloudflare runtime.
import { DatabaseSync } from 'node:sqlite';
export class LocalD1 {
  constructor(path=':memory:'){this.sqlite=new DatabaseSync(path);this.sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');}
  exec(sql){this.sqlite.exec(sql);return Promise.resolve({success:true});}
  prepare(sql){const db=this.sqlite;let values=[];const obj={bind(...args){values=args;return obj;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return{results:db.prepare(sql).all(...values),success:true};},async run(){const result=db.prepare(sql).run(...values);return{success:true,meta:{changes:Number(result.changes)}};},_sql:sql,_values:()=>values};return obj;}
  async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>{const stmt=this.sqlite.prepare(s._sql);const r=stmt.run(...s._values());return{success:true,meta:{changes:Number(r.changes)}};});this.sqlite.exec('COMMIT');return result;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
  close(){this.sqlite.close();}
}
