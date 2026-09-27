"""Local browser regressions for guest lifecycle and safe staff confirmation retries.
Uses real shared UI/adapter sources with deferred or fake HTTP responses. This is
not Cloudflare Access, cloud persistence, native-phone, or real reward testing.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('NYE_QA_OUTPUT', str(ROOT/'.local/qa')))
OUT.mkdir(parents=True, exist_ok=True)
VIEW=(ROOT/'public/assets/view.js').read_text().replace('export function mountExperience','function mountExperience')
CSS=(ROOT/'public/assets/nye.css').read_text()
results=[]
def record(name, condition=True):
    assert condition, name
    results.append({'test':name, 'status':'PASS'})
def html(script):
    return '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+CSS+'</style></head><body><div id="app"></div><script>'+script+'</script></body></html>'
HARNESS='''
const MID=1798783200000;
const event={start:MID-600000,midnight:MID,end:MID+300000,expires:MID+259200000,preWindow:30000,postWindow:90000};
const snapshot={serverNow:MID-15000,event,entry:{firstName:'Local guest',eligible:false},pass:null,mode:'local-lab'};
let stateCalls=0, waiting=[], presenceCalls=[], exits=[];
const adapter={state:()=>++stateCalls===1?Promise.resolve(snapshot):new Promise((resolve,reject)=>waiting.push({resolve,reject})),presence:visible=>{presenceCalls.push(visible);return new Promise(()=>{});},exit:ended=>exits.push(ended)};
const controller=mountExperience(document.querySelector('#app'),adapter,{embedded:true});
'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'),headless=True)
    page=browser.new_page(viewport={'width':390,'height':844}); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(VIEW+'\n'+HARNESS))
    expect(page.locator('.sb-card h2')).to_contain_text('Local guest')
    page.locator('[data-action="exit"]').click()
    expect(page.locator('.sb-placeholder')).to_be_visible(timeout=1000)
    record('Continue dismisses immediately despite an unresolved leave request',page.evaluate('exits.length===1 && exits[0]===false && presenceCalls.includes(false)'))
    page.evaluate('controller.resetView()');page.keyboard.press('Escape')
    expect(page.locator('.sb-placeholder')).to_be_visible(timeout=1000)
    record('Escape in the embedded experience uses the same immediate leave path',page.evaluate('exits.length===2 && exits[1]===false'))
    page.close();page=browser.new_page(viewport={'width':390,'height':844})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(VIEW+'\n'+HARNESS))
    expect(page.locator('#sb-title')).to_be_visible()
    page.evaluate('void controller.sync();void controller.sync();window.newer=waiting.at(-1);window.older=waiting.at(-2);')
    page.evaluate("newer.resolve({...snapshot,serverNow:MID+1});")
    expect(page.locator('.sb-year')).to_have_text('2027')
    page.evaluate("older.resolve({...snapshot,serverNow:MID-20000});")
    expect(page.locator('.sb-year')).to_have_text('2027')
    record('A stale pre-midnight state response cannot reverse the newer 2027 phase')
    page.evaluate('void controller.sync();void controller.sync();window.newer=waiting.at(-1);window.older=waiting.at(-2);newer.resolve({...snapshot,serverNow:MID+1000});')
    page.evaluate("older.reject(new Error('stale failed request'))")
    expect(page.locator('#sb-network')).to_have_text('Local test server')
    record('An obsolete failed state request cannot overwrite a newer connected state')
    page.evaluate("void controller.sync();controller.destroy();document.querySelector('#app').innerHTML='<p id=successor>Another page</p>';waiting.at(-1).resolve(snapshot);")
    expect(page.locator('#successor')).to_have_text('Another page')
    record('Destroyed experience ignores a pending state response')
    page.close();page=browser.new_page(viewport={'width':320,'height':568},accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(VIEW+'\n'+HARNESS))
    expect(page.locator('#sb-title')).to_be_visible()
    page.evaluate("controller.setState({...snapshot,serverNow:MID+1,pass:{code:'12345',firstName:'W'.repeat(40),status:'issued'}});controller.showPass();")
    expect(page.locator('.sb-demo-stamp')).to_contain_text('TEST ONLY')
    record('Local-backend mode visibly labels its numeric pass as test-only')
    page.get_by_role('button',name='Save sample pass as an image').focus()
    page.evaluate("controller.setState({...snapshot,serverNow:MID+2,pass:{code:'12345',firstName:'W'.repeat(40),status:'issued'}});")
    record('Unchanged pass refresh preserves keyboard focus on its Save control',page.get_by_role('button',name='Save sample pass as an image').evaluate('(e)=>e===document.activeElement'))
    record('Maximum-length first name wraps within the mobile pass',page.locator('.sb-ticket-name').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
    page.evaluate("() => { window.savedText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){savedText.push(String(text));return original.call(this,text,...args);}; }")
    with page.expect_download() as download:
        page.get_by_role('button',name='Save sample pass as an image').click()
    download.value.save_as(str(OUT/'local-sample-cookie-pass.png'))
    record('Saved local-backend pass image contains TEST ONLY and no-purchase wording',page.evaluate("savedText.includes('TEST ONLY - NOT VALID FOR REDEMPTION') && savedText.includes('No purchase required.')"))
    page.evaluate("controller.setState({...snapshot,serverNow:MID+300000,mode:'live'});")
    expect(page.locator('.sb-return [data-action=\"exit\"]')).to_have_text('Continue to the website')
    page.locator('.sb-return [data-action=\"exit\"]').click()
    record('Post-event live pass return uses the real website exit instead of a preview placeholder',page.evaluate('exits.length===1 && exits[0]===false'))
    page.close();page=browser.new_page(viewport={'width':390,'height':844})
    page.on('pageerror',lambda e:errors.append(str(e)))
    empty=HARNESS.replace("entry:{firstName:'Local guest',eligible:false}","entry:null").replace("const controller=", "adapter.register=async()=>({});const controller=")
    page.set_content(html(VIEW+'\n'+empty))
    expect(page.locator('#sb-first-name')).to_be_visible()
    page.locator('#sb-first-name').fill('Preserve entry')
    page.get_by_role('button',name='Count me in').click()
    page.evaluate("waiting.at(-1).reject(new Error('state unavailable'))")
    expect(page.locator('#sb-error')).to_contain_text('Your entry may have been saved')
    record('Registration with failed recovery remains retryable and preserves the typed name',page.get_by_role('button',name='Count me in').is_enabled() and page.locator('#sb-first-name').input_value()=='Preserve entry')
    page.close();page=browser.new_page(viewport={'width':320,'height':568})
    page.on('pageerror',lambda e:errors.append(str(e)))
    recovery=HARNESS.replace("state:()=>++stateCalls===1?Promise.resolve(snapshot):new Promise((resolve,reject)=>waiting.push({resolve,reject}))","state:()=>new Promise((resolve,reject)=>waiting.push({resolve,reject}))").replace("{embedded:true}","{embedded:true,passPage:true}")
    page.set_content(html(VIEW+'\n'+recovery))
    page.evaluate("void controller.sync();window.newestRecovery=waiting.at(-1);waiting[0].resolve({...snapshot,serverNow:MID+300000});")
    page.evaluate("newestRecovery.resolve({...snapshot,serverNow:MID+300000,pass:{code:'12345',firstName:'Recovered guest',status:'issued'}});")
    expect(page.locator('.sb-ticket')).to_contain_text('Recovered guest')
    record('Pass recovery survives an overlapping pageshow/bootstrap sync after the takeover',page.locator('.sb-placeholder').count()==0 and page.locator('.sb-ticket code').inner_text()=='12345')
    # Mount the production-facing staff fetch adapter. A 503 is uncertain even
    # when an upstream proxy replaces JSON with HTML; retry must keep the key.
    staff=(ROOT/'public/assets/staff-ui.js').read_text().replace('export function mountStaff','function mountStaff')
    client=(ROOT/'public/assets/staff.js').read_text().replace("import { mountStaff } from './staff-ui.js';",'')
    for response in ['json','html']:
        page.close();page=browser.new_page(viewport={'width':390,'height':844})
        page.on('pageerror',lambda e:errors.append(str(e)))
        fake='''
window.payloads=[];
if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000001';
window.fetch=async(url,options={})=>{
 if(url.endsWith('/me'))return Response.json({location:'fort-worth',mode:'local-lab'});
 if(url.endsWith('/verify'))return Response.json({status:'valid',firstName:'Local guest'});
 payloads.push(JSON.parse(options.body));
 if(payloads.length===1)return BAD_RESPONSE;
 return Response.json({status:'already_confirmed'});
};
'''.replace('BAD_RESPONSE',"Response.json({error:'Service unavailable'},{status:503})" if response=='json' else "new Response('<h1>Unavailable</h1>',{status:503})")
        page.set_content(html(fake+staff+client).replace('<div id="app"></div>','<div id="staff-app"></div>'))
        expect(page.locator('#staff-identity')).to_contain_text('LOCAL TEST ONLY')
        page.locator('#code').fill('12345');page.get_by_role('button',name='Check code',exact=True).click()
        page.get_by_role('button',name='Redeem cookie',exact=True).click()
        expect(page.get_by_role('button',name='Retry confirmation')).to_be_visible()
        page.get_by_role('button',name='Retry confirmation').click()
        expect(page.locator('#result')).to_contain_text('Do not give a second cookie')
        record(f'{response.upper()} server failure retries exactly the original redemption key',page.evaluate('payloads.length===2 && JSON.stringify(payloads[0])===JSON.stringify(payloads[1]) && Object.keys(payloads[0]).sort().join(",")==="code,requestId"'))
        page.get_by_role('button',name='Next guest').click()
        record(f'{response.upper()} retry restores the next-guest numeric input',page.locator('#code').input_value()=='' and page.locator('#code').evaluate('(e)=>e===document.activeElement'))
    record('No browser JavaScript exceptions in lifecycle/retry regressions',not errors)
    browser.close()
(OUT/'frontend-tests.json').write_text(json.dumps({'environment':'Chromium emulation; shared guest/staff source with synthetic adapter responses; no cloud or real rewards','checks':results,'count':len(results)},indent=2)+'\n')
print(json.dumps({'checks':len(results),'pass':len(results),'errors':errors},indent=2))
