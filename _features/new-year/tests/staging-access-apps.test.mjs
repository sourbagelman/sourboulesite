import test from 'node:test';
import assert from 'node:assert/strict';
import {accessApplications,withAccessPolicy} from '../staging/access-apps.mjs';
const fixture={websiteOrigin:'https://website.example.invalid',serviceOrigin:'https://service.example.invalid',
  pinIdentityProviderId:'11111111-1111-1111-1111-111111111111',
  testerEmails:['first@example.invalid','second@example.invalid'],stationEmails:['first@example.invalid','second@example.invalid']};
test('Access templates protect both roots and all four staff destinations independently',()=>{
  const result=accessApplications(fixture);
  assert.deepEqual(result.tester.application.destinations,[{type:'public',uri:'website.example.invalid'},{type:'public',uri:'service.example.invalid'}]);
  assert.deepEqual(result.staff.application.destinations,['/staff','/staff/*','/api/staff','/api/staff/*'].map(path=>({type:'public',uri:'service.example.invalid'+path})));
  assert.equal(result.tester.application.allow_iframe,true);assert.equal(result.staff.application.allow_iframe,false);
  for(const entry of Object.values(result)) {
    assert.deepEqual(entry.application.policies,[]);assert.equal(entry.application.session_duration,'12h');assert.equal(entry.policy.session_duration,'12h');
    assert.equal(entry.policy.decision,'allow');assert.deepEqual(entry.policy.include,fixture.testerEmails.map(email=>({email:{email}})));
    assert.deepEqual(entry.policy.exclude,[]);assert.deepEqual(entry.policy.require,[]);assert.match(entry.application.name,/TEST ONLY — NOT REDEEMABLE$/);
    assert.deepEqual(entry.application.allowed_idps,[fixture.pinIdentityProviderId]);assert.equal(entry.application.auto_redirect_to_identity,true);
    for(const key of ['eager_redirect_cookie_setting','path_cookie_attribute','http_only_cookie_attribute'])assert.equal(entry.application[key],true);
    assert.equal(entry.application.same_site_cookie_attribute,'lax');assert.equal(entry.application.options_preflight_bypass,false);
    assert.equal(entry.application.allow_authenticate_via_warp,false);assert.equal(entry.application.mfa_config,undefined);
    assert.equal(entry.policy.mfa_config,undefined);assert.equal(entry.application.self_hosted_domains,undefined);
    assert.ok(entry.application.destinations.every(item=>item.overrides===undefined));
  }
  result.tester.policy.include.pop();assert.equal(result.staff.policy.include.length,2);
});
test('Access templates reject production, host wildcards, paths, non-sibling hosts, and unspecified scopes',()=>{
  for(const input of [{websiteOrigin:'https://thesourboule.com'},{serviceOrigin:'https://www.thesourboule.com'},
    {websiteOrigin:'https://celebrate.thesourboule.com'},{websiteOrigin:'https://*.example.invalid'},
    {serviceOrigin:'https://service.example.invalid/staff'},{websiteOrigin:'https://website.example.invalid.'},
    {serviceOrigin:fixture.websiteOrigin},{serviceOrigin:'https://service.other.invalid'},
    {pinIdentityProviderId:'REPLACE_WITH_ID'},{sessionDuration:'24h'},{routes:['*']}])assert.throws(()=>accessApplications({...fixture,...input}));
});
test('Access templates require two distinct approved station emails within the explicit tester list',()=>{
  for(const input of [{testerEmails:[]},{testerEmails:['*@example.invalid']},{testerEmails:['everyone']},
    {testerEmails:['first@example.invalid,other@example.invalid']},{stationEmails:['first@example.invalid']},
    {stationEmails:['first@example.invalid','FIRST@example.invalid']},{stationEmails:['first@example.invalid','unknown@example.invalid']},
    {stationEmails:['first@example.invalid','second@example.invalid','third@example.invalid']}])assert.throws(()=>accessApplications({...fixture,...input}));
});
test('verified policy UUID attaches only to a fresh generated application without mutating its template',()=>{
  const original=accessApplications(fixture).staff.application;
  const id='22222222-2222-2222-2222-222222222222',linked=withAccessPolicy(original,id);
  assert.deepEqual(linked.policies,[{id,precedence:1}]);assert.deepEqual(original.policies,[]);
  linked.destinations.pop();assert.equal(original.destinations.length,4);
  assert.throws(()=>withAccessPolicy(original,'REPLACE'));assert.throws(()=>withAccessPolicy(linked,id));
});
