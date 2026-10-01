"""Browser -> HTTP Worker harness -> persistent SQLite -> staff -> guest.
The managed Chromium blocks loopback navigation, so a Playwright fetch bridge
carries same-origin HTTP requests. Native cookie/CORS/Access behavior is NOT
validated by this test; production release checks cover those separately.
Start the lab with LAB_STAFF_TOKEN=local-test-staff-token and
LAB_CONTROL_TOKEN=local-test-control-token before running this developer check.
"""
from pathlib import Path
import json, os
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('NYE_QA_OUTPUT', str(ROOT/'.local/qa')))
OUT.mkdir(parents=True, exist_ok=True)
BROWSER=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
ORIGIN=os.environ.get('NYE_LAB_ORIGIN','http://127.0.0.1:8787')
MIDNIGHT=1798783200000
reports=[]
staff_payloads=[]
def http(path,method='GET',body=None,cookie=None,staff=False,control=False):
    headers={'Origin':ORIGIN}
    if body is not None:headers['Content-Type']='application/json'
    if cookie:headers['Cookie']=cookie
    if staff:headers['Authorization']='Bearer '+(os.environ.get('LAB_WB_STAFF_TOKEN','local-test-wb-token') if staff=='willow' else os.environ.get('LAB_STAFF_TOKEN','local-test-staff-token'))
    if control:headers['X-Lab-Control']=os.environ.get('LAB_CONTROL_TOKEN','local-test-control-token')
    req=Request(ORIGIN+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
    try:r=urlopen(req,timeout=10)
    except HTTPError as e:r=e
    text=r.read().decode();return {'status':r.status,'headers':dict(r.headers),'body':text}
def clock(now):
    r=http('/__lab/time','POST',{'now':now,'freeze':True},control=True)
    assert r['status']==200,r

def record(name,condition=True):
    assert condition,name
    reports.append({'test':name,'status':'PASS'})
clock(MIDNIGHT-15000)
css=(ROOT/'public/assets/nye.css').read_text()
view=(ROOT/'public/assets/view.js').read_text().replace('export function mountExperience','function mountExperience')
guest=(ROOT/'public/assets/guest.js').read_text().replace("import { mountExperience } from './view.js';",'')
jar={'cookie':None}
def bridge(payload,staff=False):
    body=payload.get('body');body=json.loads(body) if body else None
    if staff and payload['url']=='/api/staff/redeem':staff_payloads.append(body)
    r=http(payload['url'],payload.get('method','GET'),body,jar['cookie'] if not staff else None,staff=staff)
    for k,v in r['headers'].items():
        if k.lower()=='set-cookie' and (v.startswith('__Host-sb_nye=') or v.startswith('sb_nye_lab=')):jar['cookie']=v.split(';')[0]
    return r
fetch_js="window.fetch=async(url,options={})=>{const r=await window.labFetch({url:String(url),method:options.method||'GET',body:options.body||null});return new Response(r.body,{status:r.status,headers:r.headers});};"
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=BROWSER,headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.expose_function('labFetch',bridge)
    page.set_content('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>'+css+'</style></head><body><div id="lab-banner"></div><div id="app"></div><script>'+fetch_js+'\n'+view+'\n'+guest+'</script></body></html>')
    expect(page.get_by_role('textbox',name='Your first name')).to_be_visible()
    page.get_by_role('textbox',name='Your first name').fill('Local QA')
    page.get_by_role('button',name='Count me in').click()
    expect(page.locator('.sb-card h2')).to_contain_text('Local QA')
    page.wait_for_timeout(100)
    state=json.loads(http('/api/state',cookie=jar['cookie'])['body'])
    record('Real UI registration is persisted by the HTTP backend',state['entry']['firstName']=='Local QA' and state['pass'] is None)
    record('Guest identity is held in a server-issued secure session cookie',bool(jar['cookie']))
    clock(MIDNIGHT)
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('.sb-ticket')).to_be_visible(timeout=12000)
    state=json.loads(http('/api/state',cookie=jar['cookie'])['body']);code=state['pass']['code']
    record('Real pre/post presence yields one persisted test pass in the browser',state['entry']['eligible'] and len(code)==5 and code.isdigit() and code[0]!='0')
    page.screenshot(path=str(OUT/'local-backend-guest.png'),full_page=True)
    clock(MIDNIGHT+300000)
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(200)
    page.locator('[data-action="pass"]').first.click()
    expect(page.locator('.sb-ticket')).to_be_visible()
    record('Guest can retrieve the same persisted pass after 12:05',page.locator('.sb-ticket code').inner_text()==code)
    clock(MIDNIGHT+3600000)
    staffpage=browser.new_page(viewport={'width':1000,'height':1000})
    staffpage.on('pageerror',lambda e:errors.append(str(e)))
    staffpage.expose_function('labFetch',lambda payload:bridge(payload,True))
    html=(ROOT/'public/staff/index.html').read_text().replace('<link rel="stylesheet" href="/assets/nye.css">','<style>'+css+'</style>')
    # about:blank lacks randomUUID, which is normally available on production HTTPS.
    uuid="if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000001';"
    script=(ROOT/'public/assets/staff-ui.js').read_text().replace('export function mountStaff','function mountStaff')+'\n'+(ROOT/'public/assets/staff.js').read_text().replace("import { mountStaff } from './staff-ui.js';",'')
    html=html.replace('<script type="module" src="/assets/staff.js"></script>','<script type="module">'+fetch_js+uuid+script+'</script>')
    staffpage.set_content(html)
    expect(staffpage.locator('#staff-identity')).to_contain_text('LOCAL TEST ONLY')
    expect(staffpage.locator('#station-location')).to_contain_text('Fort Worth')
    staffpage.locator('#code').fill(code)
    staffpage.get_by_role('button',name='Check code',exact=True).click()
    expect(staffpage.locator('#result')).to_contain_text('Ready to redeem')
    record('Authenticated local staff UI verifies the actual persisted pass')
    staffpage.get_by_role('button',name='Redeem cookie',exact=True).click()
    expect(staffpage.locator('#result')).to_contain_text('Give one cookie.')
    record('Single Redeem action records a free-cookie redemption with no purchase')
    record('Actual staff request contains only code and idempotency key',len(staff_payloads)==1 and set(staff_payloads[0])=={'code','requestId'})
    state=json.loads(http('/api/state',cookie=jar['cookie'])['body'])
    record('Guest sees centrally updated redeemed status',state['pass']['status']=='redeemed' and state['pass']['location']=='fort-worth')
    again=http('/api/staff/redeem','POST',{'code':code,'location':'willow-bend','requestId':'20000000-2000-4000-8000-200000000002'},staff='willow')
    record('Willow Bend cannot redeem the Fort Worth-used pass',again['status']==409 and json.loads(again['body'])['status']=='redeemed')
    staffpage.screenshot(path=str(OUT/'local-backend-staff.png'),full_page=True)
    record('No browser JavaScript exceptions during combined local flow',not errors)
    browser.close()
(OUT/'local-e2e-tests.json').write_text(json.dumps({'environment':'Real HTTP local backend + persistent SQLite; Playwright fetch bridge; local staff auth substitute; simulated server time','checks':reports,'count':len(reports),'cloud_tested':False,'native_browser_cookies_tested':False},indent=2))
print(json.dumps({'checks':len(reports),'pass':len(reports),'errors':errors},indent=2))
