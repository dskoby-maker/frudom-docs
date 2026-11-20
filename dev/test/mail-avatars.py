"""Почта: свои аватарки отправителей — у каждого отправителя свой цвет/рисунок и буквы, у одного и того же — одинаковые,
у организаций значок-домик (класс org). Запуск: тестовый сервер (node test/server.js)."""
import asyncio, os, json, urllib.request, datetime, re
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
NOW=datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
def iso(h): return (NOW-datetime.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
def msg(uid,h,n,a): return {'uid':uid,'date':iso(h),'from':{'n':n,'a':a},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':f'Тема {uid}','msgid':f'<a{uid}@t.ru>','inReply':'','refs':'','text':'Текст','html':'','atts':[]}
S=[('ООО «РосПродукт»','sale@rosprod.ru'),('Ситникова Екатерина','sit@gpm.ru'),('Андриянова Елена','buh@zoo.ru'),('ООО «РосПродукт»','sale@rosprod.ru'),('ip@yandex.ru','ip@yandex.ru'),('ГАУ «Московский зоопарк»','zoo@zoo.ru')]
M=[msg(500+i,1+i,n,a) for i,(n,a) in enumerate(S)]
async def main():
    acc=[{'id':'mru','email':'frudom.ru@mail.ru','name':'','color':'','ih':'imap.mail.ru','ip':993,'sh':'smtp.mail.ru','sp':465,'user':'frudom.ru@mail.ru','pass':'p','uidv':'','last':0,'at':'','err':''}]
    PX='k'*24
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'p',uidv:7,msgs:%s}},sent:[]}; __tb={proxy:{key:'%s'}}; var P=PropertiesService.getScriptProperties(); P.setProperty('TB_PROXY',JSON.stringify({url:'https://functions.yandexcloud.net/dtest',key:'%s'})); P.setProperty('MAIL_ACC',%s); P.deleteProperty('MAIL_SYNC_AT'); write_('mail', []); write_('mailtags', []); 1" % (json.dumps(M,ensure_ascii=False),PX,PX,json.dumps(json.dumps(acc))))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in (1300,390):
            ctx=await b.new_context(viewport={'width':W,'height':860}, has_touch=W<500, is_mobile=W<500); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/s2/favicons**', lambda r: r.abort()); await pg.route('**gravatar**', lambda r: r.abort())
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("location.hash='#pochta'")
            await pg.wait_for_timeout(1200)
            if W>500: await pg.click('#ml [data-ml="sync"]', timeout=3000)
            sel='#ml-list .mlrav' if W>500 else '#ml-list .mrav'
            for _ in range(60):
                if await pg.locator(sel).count()>=6: break
                await pg.wait_for_timeout(250)
            av=await pg.evaluate(f"""[...document.querySelectorAll('{sel}')].map(e=>{{const r=e.closest('.mlr');return {{a:r.textContent, st:e.getAttribute('style')||'', t:e.textContent.trim(), org:e.classList.contains('org')}}}})""")
            ok(len(av)>=6, f'{W}: аватарки у всех писем ({len(av)})')
            bg=lambda s: (re.search(r'--avbg:([^;]+)',s) or [None,''])[1]
            ros=[x for x in av if 'РосПродукт' in x['a']]; zoo=[x for x in av if 'Андриянова' in x['a']]; sit=[x for x in av if 'Ситникова' in x['a']]
            ok(len(ros)==2 and bg(ros[0]['st']) and bg(ros[0]['st'])==bg(ros[1]['st']), f'{W}: один отправитель — одинаковая аватарка')
            ok(bg(zoo[0]['st'])!=bg(sit[0]['st']) and bg(ros[0]['st'])!=bg(zoo[0]['st']), f'{W}: разные отправители — разные цвета')
            ok('РП' in ros[0]['t'] and ros[0]['org'], f'{W}: у «ООО РосПродукт» буквы РП и значок организации ({ros[0]["t"]})')
            ok('СЕ' in sit[0]['t'] and not sit[0]['org'], f'{W}: у человека инициалы без значка ({sit[0]["t"]})')
            sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw==W, f'{W}: без прокрутки вбок ({sw})')
            await pg.screenshot(path=f'/tmp/claude-0/mlav-{W}.png')
            ok(not errs, f'{W}: без ошибок {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
