import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {validateConfiguration,workerConfiguration,stagingSql} from '../staging/config.mjs';
const fixture={accountId:'a'.repeat(32),databaseId:'11111111-1111-1111-1111-111111111111',environmentId:'nye-private-test-fixture',
  websiteOrigin:'https://website.example.invalid',serviceOrigin:'https://service.example.invalid',accessIssuer:'https://test-team.cloudflareaccess.com',
  testerAudience:'b'.repeat(64),staffAudience:'c'.repeat(64),testerEmails:['approved@example.invalid'],realAnchorUtc:'2026-09-27T12:00:00Z',eventAnchorUtc:'2027-01-01T05:48:50Z'};
const assets=fileURLToPath(new URL('../.local/staging-build-test/assets',import.meta.url));
test('private configuration has no public route or preview and authenticates before all assets',()=>{
  const c=workerConfiguration(fixture,assets);
  assert.equal(c.workers_dev,false);assert.equal(c.preview_urls,false);assert.equal(c.routes,undefined);
  assert.equal(c.assets.run_worker_first,true);assert.equal(c.assets.html_handling,'none');assert.match(c.main,/staging\/worker.mjs$/);
  assert.equal(c.vars.STAGING_SITE_AUD,c.vars.STAGING_SERVICE_AUD);assert.notEqual(c.vars.STAGING_STAFF_AUD,c.vars.STAGING_SITE_AUD);
  assert.equal(c.vars.PASS_SECRET,undefined);assert.equal(c.observability.enabled,false);
});
test('staging routes are exact approved hosts only in separately selected DNS variant',()=>{
  const c=workerConfiguration(fixture,assets,{attachApprovedDomains:true});
  assert.deepEqual(c.routes,[{pattern:'website.example.invalid',custom_domain:true},{pattern:'service.example.invalid',custom_domain:true}]);
});
test('configuration rejects production hosts, shared audiences, missing identities and non-isolated assets',()=>{
  for(const input of [{websiteOrigin:'https://thesourboule.com'},{serviceOrigin:fixture.websiteOrigin},{serviceOrigin:'https://elsewhere.example.com'},
    {staffAudience:fixture.testerAudience},{testerEmails:[]},{testerEmails:['*@example.invalid']},{accountId:'REPLACE'},
    {databaseId:'bad'},{environmentId:"x'); DROP TABLE passes;--"},{realAnchorUtc:'now'}])assert.throws(()=>validateConfiguration({...fixture,...input}));
  assert.throws(()=>workerConfiguration(fixture,'/tmp/public'));
});
test('artificial rehearsal hours and DB marker are generated separately from empty production windows',()=>{
  const original=readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
  assert.doesNotMatch(original,/INSERT INTO redemption_windows|staging_environment/);
  const sql=stagingSql(fixture,original);
  assert.ok(sql.startsWith(original));assert.match(sql,/CREATE TABLE staging_environment/);
  assert.equal((sql.match(/INSERT INTO redemption_windows/g)||[]).length,2);
  assert.equal((sql.match(/ARTIFICIAL ONE-HOUR REHEARSAL WINDOW/g)||[]).length,2);
});
