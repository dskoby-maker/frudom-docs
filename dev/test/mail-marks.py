"""Почта: свои отметки не слетают, когда приходит старый ответ таблицы (проверка ящиков / свежий список, запрошенные до отметки).
Даниил открывает письмо → «Обработано»; через 5 с приходит «старый» список без отметки — отметка остаётся на экране;
таблица подтвердила (ответ новее отметки) — отметка больше не держится сайтом; потом чужая правка того же письма видна."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
def api(user, pw, body):
    body=dict(body, user=user, key=pw); r=urllib.request.urlopen(urllib.request.Request('http://localhost:8787/exec', data=json.dumps(body).encode(), method='POST', headers={'content-type':'text/plain'})).read().decode()
    return json.loads(r)
PX='k'*24
MSG=lambda uid,subj,frm: {'uid':uid,'date':'2026-11-1%dT0%d:00:00.000Z'%(uid%9, uid%9),'from':{'n':frm,'a':frm.lower().replace(' ','')+'@test.ru'},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':subj,'msgid':'<%d@t>'%uid,'inReply':'','refs':'','text':'Текст '+subj,'html':'','atts':[]}
BOX=[MSG(1,'Заявка на пятницу','Цирк'), MSG(2,'Акт сверки','Бухгалтерия'), MSG(3,'Вопрос по счёту','МГУ')]
async def until(pg, js, n=80):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'p1',uidv:5,msgs:%s}},sent:[]}; PropertiesService.getScriptProperties().setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); __tb={proxy:{key:'%s'}};"
       " PropertiesService.getScriptProperties().setProperty('MAIL_ACC', JSON.stringify([{id:'mA',email:'frudom.ru@mail.ru',name:'ФД',ih:'imap.mail.ru',ip:993,sh:'smtp.mail.ru',sp:465,user:'frudom.ru@mail.ru',pass:'p1',uidv:'',last:0}]));"
       " PropertiesService.getScriptProperties().deleteProperty('MAIL_SYNC_AT'); write_('mail', []); write_('mailtags', []); mailSync_(true); 1" % (json.dumps(BOX,ensure_ascii=False), PX, PX))
    L=api('Даниил','1111',{'action':'mail','op':'list'}); ids={r['subject']:r['id'] for r in L['rows']}; a=ids['Акт сверки']
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"mail\"]').click()")
        ok(await until(pg, f"!!document.querySelector('#ml-list [data-mlid=\"{a}\"]')"), 'письма на месте')
        await pg.wait_for_timeout(1500)
        stale=await pg.evaluate("JSON.parse(JSON.stringify(__mlOwn.rows()))")
        old=await pg.evaluate("new Date(Date.now()-60000).toISOString()")
        await pg.click(f'#ml-list [data-mlid="{a}"]'); await pg.wait_for_timeout(600)
        await pg.click('#ml-view .mlmk.mkok'); await pg.wait_for_timeout(600)
        done=f"(()=>{{ const r=__mlOwn.rows().find(x=>x.id==='{a}'); try{{ return !!JSON.parse(r.order||'{{}}').done; }}catch(e){{ return false; }} }})()"
        ok(await pg.evaluate(done), 'отмечено «Обработано»')
        await pg.wait_for_timeout(5000)
        await pg.evaluate("j=>__mlOwn.take(j)", {'rows':stale, 'now':old})
        await pg.wait_for_timeout(400)
        ok(await pg.evaluate(done), 'старый ответ таблицы (как от проверки ящиков) не стёр отметку')
        ok(await pg.evaluate(f"!!document.querySelector('#ml-list [data-mlid=\"{a}\"] .mldbadge, #ml-list [data-mlid=\"{a}\"].isdone')"), 'на экране письмо всё ещё «Обработано»')
        S=api('Даниил','1111',{'action':'mail','op':'list'}); r=[x for x in S['rows'] if x['id']==a][0]
        ok('done' in json.loads(r['order'] or '{}'), 'в таблице отметка сохранена')
        await pg.evaluate("j=>__mlOwn.take(j)", {'rows':S['rows'], 'now':S['now']}); await pg.wait_for_timeout(300)
        ok(await pg.evaluate(f"!__mlOwn.own()['{a}']"), 'таблица подтвердила — сайт больше не держит отметку сам')
        api('Наталья','2222',{'action':'mail','op':'set','rows':[{'id':a,'patch':{'done':None},'order':''}]})
        S=api('Даниил','1111',{'action':'mail','op':'list'})
        await pg.evaluate("j=>__mlOwn.take(j)", {'rows':S['rows'], 'now':S['now']}); await pg.wait_for_timeout(300)
        ok(not await pg.evaluate(done), 'чужая правка после этого видна (Наталья сняла отметку)')
        ok(not errs, 'нет ошибок JS '+str(errs[:2]))
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
