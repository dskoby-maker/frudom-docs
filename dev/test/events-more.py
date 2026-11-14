"""«События»: тихие события (14.11.2026) — вкладки, просмотр накладной, почта (открыл, обработано, папка, вложение), прочитанные задачи;
без отдельного запроса на каждое нажатие; «Скрыть входы и просмотры». Запуск: тестовый сервер на :8787."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
def rows(t):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
PX='k'*24
MSG=[{'uid':11,'date':'2026-11-12T06:15:00.000Z','from':{'n':'МГУ Комбинат','a':'zakaz@msu.ru'},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':'Акт сверки','msgid':'<m11@msu.ru>','inReply':'','refs':'',
  'text':'Пришлите акт','html':'','atts':[{'name':'akt.txt','mime':'text/plain','size':5,'data':'MTIzNDU='}]},
  {'uid':12,'date':'2026-11-11T08:00:00.000Z','from':{'n':'Рассылка','a':'news@shop.ru'},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':'Скидки недели','msgid':'<n12@shop.ru>','inReply':'','refs':'','text':'Скидки','html':'','atts':[]}]
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    sync=[]; pg.on('request', lambda r: sync.append(1) if r.method=='POST' and '"action":"sync"' in (r.post_data or '') else None)
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs, sync
async def tab(pg,t): await pg.evaluate("t=>document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()", t); await pg.wait_for_timeout(400)
async def main():
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'p1',uidv:5,msgs:%s}},sent:[]}; __tb={proxy:{key:'%s'}}; PropertiesService.getScriptProperties().setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); PropertiesService.getScriptProperties().deleteProperty('MAIL_ACC'); PropertiesService.getScriptProperties().deleteProperty('MAIL_SYNC_AT'); write_('mail', []); 1"%(json.dumps(MSG,ensure_ascii=False),PX,PX))
    r=ev("JSON.stringify(doPost({postData:{contents:JSON.stringify({key:'1111',user:'Даниил',action:'mail',op:'acc',a:{email:'frudom.ru@mail.ru',ih:'imap.mail.ru',sh:'smtp.mail.ru',pass:'p1'}})}}).t)")
    ok('ok\\":true' in str(r) or '"ok":true' in str(r), 'ящик подключён: '+str(r)[:80])
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs,sync=await login(b,'Наталья','2222')
        await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1500); n0=len(sync)
        for t in ['journal','calendar','mail']: await tab(pg,t)
        await pg.wait_for_timeout(2500)
        await pg.click('#ml .mlr >> nth=0'); await pg.wait_for_timeout(1500)
        st=await pg.evaluate("(()=>{const E=__fd.evSoft(); return E.evs.map(e=>e.action+': '+e.text)})()")
        ok(any('Вкладка: Открыта вкладка «Журнал' in x for x in st), 'вкладка «Журнал» записана: '+str(st[:3]))
        ok(any(x.startswith('Почта: Открыто письмо «') for x in st), 'открытие письма записано')
        ok(len(sync)==n0, f'переходы и открытие письма — без отдельной синхронизации (запросов sync: {len(sync)-n0})')
        # второй раз та же вкладка — не дублируется
        await tab(pg,'journal'); await tab(pg,'mail')
        st2=await pg.evaluate("__fd.evSoft().evs.filter(e=>e.text.includes('«Журнал»')).length"); ok(st2==1, 'повторный заход в ту же вкладку не дублируется')
        # отметить обработано и в неважные
        r0=await pg.evaluate("(()=>{const M=__fd.mail().ML; return M.rows.find(r=>r.id===M.sel)?M.sel:''})()")
        await pg.evaluate("(()=>{const b=document.querySelector('#ml-view .mlmk.mkok'); if(b) b.click();})()"); await pg.wait_for_timeout(600)
        st=await pg.evaluate("__fd.evSoft().evs.map(e=>e.text)")
        ok(any('Отмечено «Обработано»' in x for x in st), 'отметка «Обработано» записана')
        # вложение
        await pg.evaluate("(()=>{const a=document.querySelector('#ml-view [data-mlatt]'); if(a) a.click();})()"); await pg.wait_for_timeout(1500)
        st=await pg.evaluate("__fd.evSoft().evs.map(e=>e.text)")
        ok(any('вложение «akt.txt»' in x for x in st), 'вложение записано')
        # просмотр накладной (если есть)
        has=await pg.evaluate("__fd.D().journal.filter(j=>j.snap).length")
        if has:
            await tab(pg,'journal'); await pg.evaluate("(()=>{const a=document.querySelector('#jr-body [data-card],#jr-body .jcus,#jr-body [data-doc]'); if(a) a.click();})()"); await pg.wait_for_timeout(800)
        # отправить
        await pg.evaluate("__fd.evSoft().now()"); await pg.wait_for_timeout(4000)
        E=[e for e in rows('События') if 'Наталья' in json.dumps(e,ensure_ascii=False)]
        txt=json.dumps(E,ensure_ascii=False)
        ok('Открыто письмо' in txt and 'Открыта вкладка' in txt and 'Обработано' in txt, 'события Натальи дошли в таблицу')
        ok(await pg.evaluate("__fd.evSoft().evs.length")==0, 'очередь тихих событий пуста после отправки')
        ok(not errs, 'без ошибок: '+str(errs[:2]))
        await ctx.close()
        # Даниил: вкладка «События», фильтр
        ctx,pg,errs,_=await login(b,'Даниил','1111'); await tab(pg,'events'); await pg.wait_for_timeout(2500)
        body=await pg.inner_text('#ev-body')
        ok('Открыто письмо' in body and 'Наталья' in body, 'в «Событиях» видно, что Наталья открыла письмо')
        await pg.check('#ev-nologin'); await pg.wait_for_timeout(400); body2=await pg.inner_text('#ev-body')
        ok('Открыта вкладка' not in body2 and 'Открыто письмо' in body2, '«Скрыть входы и просмотры» прячет переходы, почта остаётся')
        opts=await pg.evaluate("[...document.querySelectorAll('#ev-type option')].map(o=>o.textContent)")
        ok('Почта' in opts, 'в «Все действия» есть «Почта»')
        await pg.uncheck('#ev-nologin'); ok(not errs, 'без ошибок у Даниила: '+str(errs[:2]))
        await b.close()
    print('ошибок:', len(fails))
asyncio.run(main())
