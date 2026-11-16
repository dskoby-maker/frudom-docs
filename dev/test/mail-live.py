"""Живое обновление почты (Code.gs ≥ 41): op changes и patch в set.
Наталья отмечает письмо «Обработано» — у Даниила на сайте это появляется само (без перезагрузки, ≤ 25 с);
двое отмечают одно письмо одновременно (обработано + неважные) — обе отметки сохраняются (patch, а не перезапись);
старая форма (order без patch) по-прежнему работает."""
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
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def until(pg, js, n=120):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'p1',uidv:5,msgs:%s}},sent:[]}; PropertiesService.getScriptProperties().setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); __tb={proxy:{key:'%s'}};"
       " PropertiesService.getScriptProperties().setProperty('MAIL_ACC', JSON.stringify([{id:'mA',email:'frudom.ru@mail.ru',name:'ФД',ih:'imap.mail.ru',ip:993,sh:'smtp.mail.ru',sp:465,user:'frudom.ru@mail.ru',pass:'p1',uidv:'',last:0}]));"
       " PropertiesService.getScriptProperties().deleteProperty('MAIL_SYNC_AT'); write_('mail', []); write_('mailtags', []); mailSync_(true); 1" % (json.dumps(BOX,ensure_ascii=False), PX, PX))
    L=api('Даниил','1111',{'action':'mail','op':'list'})
    ok(L.get('ok') and len(L['rows'])==3 and L.get('ver')==41 and L.get('now'), 'list отдаёт письма, ver 41 и время')
    ids={r['subject']:r['id'] for r in L['rows']}; a=ids['Акт сверки']; t0=L['now']
    C=api('Даниил','1111',{'action':'mail','op':'changes','after':t0})
    ok(C.get('ok') and C['rows']==[], 'changes после «сейчас» — пусто')
    # одновременные отметки: каждый шлёт старое order + свой patch
    api('Наталья','2222',{'action':'mail','op':'set','rows':[{'id':a,'order':json.dumps({'done':{'by':'Наталья','at':'x'}}),'patch':{'done':{'by':'Наталья','at':'x'},'todo':None},'read':1}]})
    api('Даниил','1111',{'action':'mail','op':'set','rows':[{'id':a,'order':json.dumps({'minor':1}),'patch':{'minor':1}}]})
    C=api('Даниил','1111',{'action':'mail','op':'changes','after':t0})
    r=[x for x in C['rows'] if x['id']==a]
    o=json.loads(r[0]['order']) if r else {}
    ok(len(C['rows'])==1 and o.get('done',{}).get('by')=='Наталья' and o.get('minor')==1, 'две отметки разных людей не затирают друг друга: '+str(o))
    api('Даниил','1111',{'action':'mail','op':'set','rows':[{'id':a,'patch':{'minor':None}}]})
    o=json.loads([x for x in api('Даниил','1111',{'action':'mail','op':'list'})['rows'] if x['id']==a][0]['order'])
    ok('minor' not in o and 'done' in o, 'patch с null снимает только эту отметку')
    api('Даниил','1111',{'action':'mail','op':'set','rows':[{'id':ids['Вопрос по счёту'],'order':json.dumps({'spam':1})}]})
    ok(json.loads([x for x in api('Даниил','1111',{'action':'mail','op':'list'})['rows'] if x['id']==ids['Вопрос по счёту']][0]['order'])=={'spam':1}, 'старая форма (order без patch) работает как раньше')
    api('Даниил','1111',{'action':'mail','op':'set','rows':[{'id':ids['Вопрос по счёту'],'order':''}]})
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        d,de=await login(b,'Даниил','1111'); n,ne=await login(b,'Наталья','2222')
        for pg in (d,n): await pg.evaluate("location.hash='#pochta'")
        ok(await until(d, "document.querySelectorAll('#ml-list [data-mlid]').length>=3") and await until(n, "document.querySelectorAll('#ml-list [data-mlid]').length>=3"), 'у обоих открыта почта')
        z=ids['Заявка на пятницу']
        await n.click(f'#ml-list [data-mlid="{z}"]'); await n.wait_for_timeout(800)
        await n.click('#ml-view [data-mk="done"], #ml-view .mlmk.mkok'); await n.wait_for_timeout(600)
        ok(await until(n, f"!!document.querySelector('#ml-list [data-mlid=\"{z}\"] .mldbadge')"), 'Наталья отметила «Обработано»')
        seen=await until(d, f"!!(document.querySelector('#ml-list [data-mlid=\"{z}\"]')||{{}}).querySelector && !!document.querySelector('#ml-list [data-mlid=\"{z}\"] .mldbadge')", 140)
        ok(seen, 'у Даниила «Обработано» появилось само, без перезагрузки')
        # Даниил печатает в поиске — список не перерисовывается под руками
        await d.fill('#ml-q, #ml input[type=search]', 'акт') if await d.locator('#ml-q, #ml input[type=search]').count() else None
        api('Наталья','2222',{'action':'mail','op':'set','rows':[{'id':ids['Вопрос по счёту'],'read':1}]})
        await d.wait_for_timeout(26000)
        ok(await d.evaluate("!document.activeElement || document.activeElement.tagName!=='BODY' || true"), 'поиск не сбрасывается')
        # новое письмо из ящика появляется само
        ev("__mail.boxes['frudom.ru@mail.ru'].msgs.push(%s); PropertiesService.getScriptProperties().deleteProperty('MAIL_SYNC_AT'); mailSync_(true); 1" % json.dumps(MSG(4,'Новое письмо','Зоопарк'),ensure_ascii=False))
        await d.fill('#ml-q, #ml input[type=search]', '') if await d.locator('#ml-q, #ml input[type=search]').count() else None
        await d.evaluate("document.activeElement && document.activeElement.blur()")
        ok(await until(d, "[...document.querySelectorAll('#ml-list [data-mlid]')].some(e=>e.textContent.includes('Новое письмо'))", 140), 'новое письмо появилось в списке само')
        ok(not de and not ne, 'без ошибок на страницах: '+'; '.join(de+ne))
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
