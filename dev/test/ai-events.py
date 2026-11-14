"""Помощник знает действия сотрудников: инструмент events (журнал «События»: кто, когда, что) и history у накладных
(кто создал и что менял); вопрос «кто создал накладную» → Claude вызывает events → ответ с именем. Шрифт панели — без засечек."""
import asyncio, os, re, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
def srv(js): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode()
FAKE = r"""__chatLog=[]; __chat=function(bd){ __chatLog.push(bd); const last=bd.messages[bd.messages.length-1];
  if(typeof last.content==='string') return {content:[{type:'tool_use',id:'e1',name:'events',input:{text:'777'}}],stop_reason:'tool_use'};
  const r=JSON.parse(last.content[0].content); const e=r.events.find(x=>/Создан/.test(x.action))||r.events[0];
  return {content:[{type:'text',text:'Накладную создал(а) **'+e.who+'** '+e.at+'.'}],stop_reason:'end_turn'}; }; 'ok'"""
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('CLAUDE_KEY','sk-ant-test-key-000000000000'); 'ok'"); srv(FAKE)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        # Наталья создаёт накладную № 777 — событие пишется в журнал
        pg=await b.new_page(viewport={'width':1300,'height':860})
        await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
        await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Наталья"]'); await pg.fill('#fd-pass','2222'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""s=>T.ev(s)""", """(()=>{ const c=D.customers.find(x=>x.id!=='private-buyer'), s=D.suppliers[0], p=D.products[0];
          const dr=Object.assign(newDraft(D),{number:'777', date:'2026-11-13', customerId:c.id, supplierId:s.id, lines:[{productId:p.id, qty:5, price:100}]});
          D.draft=dr; commitDoc(); })()""")
        await pg.wait_for_timeout(500); await pg.evaluate("s=>T.ev(s)", "flush()"); await pg.wait_for_timeout(2500); await pg.close()
        for W in (1300, 390):
            pg=await b.new_page(viewport={'width':W,'height':860}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
            await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
            if W==1300:
                r=await ev("AC_RUN.events({text:'777'})")
                ok(r.get('found',0)>=1 and any(e['who']=='Наталья' for e in r['events']), f'events находит действие Натальи с № 777: {json.dumps(r,ensure_ascii=False)[:200]}')
                r2=await ev("AC_RUN.events({who:'Наталья', date_from:'2000-01-01'})"); ok(all(e['who']=='Наталья' for e in r2['events']) and r2['events'], 'фильтр по человеку')
                r3=await ev("AC_RUN.events({who:'Гриша', action:'Создан'})"); ok(r3['found']==0, 'чужие не попадают')
                d=await ev("AC_RUN.search_docs({number:'777'}).then(x=>x.docs.find(j=>j.number==='777'))")
                ok(d and d.get('history') and d['history'][0]['who']=='Наталья' and 'создан' in d['history'][0]['what'], f'history у накладной: {d and d.get("history")}')
                ok('events' in await ev("acSystem()") and 'Наталья' in await ev("acSystem()"), 'в инструкции — про журнал событий')
            await pg.click('#ac-fab'); await pg.wait_for_timeout(300)
            ff=await pg.evaluate("getComputedStyle(document.getElementById('ac-pan')).fontFamily")
            ok('serif' not in ff.replace('sans-serif','') and ('Golos' in ff or 'system-ui' in ff), f'{W}: шрифт панели без засечек ({ff[:40]})')
            await pg.fill('#ac-in', 'Кто создал накладную 777?'); await pg.keyboard.press('Enter')
            await pg.wait_for_function("document.querySelector('#ac-pan').innerText.includes('создал(а)')", timeout=15000)
            ok('Наталья' in await pg.inner_text('#ac-pan'), f'{W}: помощник отвечает, кто создал')
            ok(not errs, f'{W}: без ошибок {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
