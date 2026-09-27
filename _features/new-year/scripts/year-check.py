"""Focused hero-year boundary checks in Chromium with a controlled event clock.
The same production-facing view is exercised; rewards and network are not tested.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
R = Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('NYE_QA_OUTPUT', str(R/'.local/qa')))
OUT.mkdir(parents=True, exist_ok=True)
BROWSER=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
view = (R/'public/assets/view.js').read_text().replace('export function mountExperience', 'function mountExperience')
css = (R/'public/assets/nye.css').read_text()
MID = 1798783200000
results = []

def record(name, ok):
    assert ok, name
    results.append({'test': name, 'status': 'PASS'})

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=BROWSER, headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Freeze monotonic time and invoke the requested frame explicitly so a one-ms
    # boundary assertion cannot be distorted by screenshot or test runner latency.
    harness = '''
    performance.now=()=>0;
    window.requestAnimationFrame=callback=>{window.nextYearFrame=callback;return 1;};
    window.cancelAnimationFrame=()=>{};
    const MID=1798783200000;
    const event={start:MID-600000,midnight:MID,end:MID+300000,expires:MID+259200000,preWindow:30000,postWindow:90000};
    let snapshot={serverNow:MID-600000,event,entry:null,pass:null,mode:'simulation'};
    const adapter={state:async()=>snapshot,presence:async()=>({}),register:async()=>{}};
    const controller=mountExperience(document.querySelector('#app'),adapter,{demo:true});
    window.atYearTime=(ms,reset=false)=>{
      snapshot={...snapshot,serverNow:ms};controller.setState(snapshot);
      if(reset)controller.resetView();
      window.nextYearFrame(0);
      const el=document.querySelector('.sb-year');
      return {year:el?.textContent,label:el?.getAttribute('aria-label'),title:document.querySelector('#sb-title')?.textContent};
    };
    window.showYearReturn=()=>controller.showWebsite();
    '''
    page.set_content('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script>'+view+'\n'+harness+'</script></body></html>')
    def at(n, reset=False):
        return page.evaluate('([n,reset])=>window.atYearTime(n,reset)', [n, reset])
    record('Opening is 2026', at(MID-600000)['year']=='2026')
    record('Final minute is 2026', at(MID-60000)['year']=='2026')
    record('Last full second is 2026', at(MID-1000)['year']=='2026')
    record('One millisecond before midnight is still 2026', at(MID-1)['year']=='2026')
    exact=at(MID)
    record('Exact midnight switches visible and accessible year to 2027 with greeting',exact['year']=='2027' and exact['label']=='2027' and 'Happy' in exact['title'])
    record('One millisecond after midnight remains 2027', at(MID+1)['year']=='2027')
    record('Late-open layout renders 2027 immediately', at(MID+15000,True)['year']=='2027')
    at(MID-60000, True)
    page.evaluate("Date.now=()=>Date.parse('2040-01-01T00:00:00Z')")
    record('Changing device Date.now does not change pre-midnight year', at(MID-1)['year']=='2026')
    page.emulate_media(reduced_motion='reduce')
    record('Reduced motion still switches year exactly at midnight', at(MID)['year']=='2027' and page.locator('.sb-app').get_attribute('data-motion')=='off')
    at(MID-1000,True);page.evaluate('window.showYearReturn()')
    record('Dismissed preview before midnight does not show future year',at(MID-1)['year']=='2026')
    record('Dismissed preview year changes at midnight too',at(MID)['year']=='2027')
    record('12:05 return keeps 2027 and reveals placeholder',at(MID+300000,True)['year']=='2027' and page.locator('.sb-placeholder').count()==1)
    record('No JavaScript errors in year checks',not errors)
    browser.close()
report={'environment':'Chromium mobile viewport; production-facing view; controlled monotonic/server-state clock; no live rewards', 'checks':results,'count':len(results)}
(OUT/'year-tests.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'checks':len(results),'pass':len(results),'errors':errors},indent=2))
