"""Приложение «Почта ФД»: сервер отдаёт новые письма для уведомлений (action=notes, kinds=mail, Code.gs ≥ 36),
сайт с ?app=mail показывает только почту, открывает письмо по нажатию на уведомление (__fd.mailOpen) и сообщает приложению,
что прочитано (__fd.mailState). Запуск: node test/server.js & python3 test/mail-app.py"""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
now=datetime.datetime.now(datetime.timezone.utc)
iso=lambda h: (now-datetime.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
PX='k'*24
def msg(uid,h,fn,fa,subj,text): return {'uid':uid,'date':iso(h),'from':{'n':fn,'a':fa},'to':[{'n':'','a':'x@frudom.ru'}],'cc':[],'replyTo':'','subject':subj,'msgid':f'<m{uid}@t>','inReply':'','refs':'','text':text,'html':'','atts':[]}
M_RU=[msg(21,2,'МГУ Комбинат','zakaz@msu.ru','Заявка на завтра','Прошу поставить помидоры 10 кг'),
      msg(22,3,'Рассылка','news@shop.ru','Скидки недели','Только сегодня'),
      msg(23,100,'Старое','old@x.ru','Старое письмо','Было давно')]
M_TW=[msg(4,1,'Цирк бухгалтерия','buh@circus.ru','Акт сверки','Пришлите акт сверки')]
NOTES=lambda who,pw: f"JSON.stringify(handle_({{action:'notes', user:'{who}', key:'{pw}', kinds:'mail', msync:'1'}}))"
async def main():
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'p1',uidv:5,msgs:%s},'info@frudom.ru':{pass:'p2',uidv:9,msgs:%s}},sent:[]}; __tb={proxy:{key:'%s'}}; var P=PropertiesService.getScriptProperties(); P.setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); P.deleteProperty('MAIL_SYNC_AT'); write_('mail', []); write_('mailtags', []);"
       "P.setProperty('MAIL_ACC', JSON.stringify([{id:'mA',email:'frudom.ru@mail.ru',ih:'imap.mail.ru',ip:993,sh:'smtp.mail.ru',sp:465,user:'frudom.ru@mail.ru',pass:'p1'},{id:'mB',email:'info@frudom.ru',ih:'imap.timeweb.ru',ip:993,sh:'smtp.timeweb.ru',sp:465,user:'info@frudom.ru',pass:'p2'}])); 1" % (json.dumps(M_RU,ensure_ascii=False), json.dumps(M_TW,ensure_ascii=False), PX, PX))
    r=json.loads(ev(NOTES('Даниил','1111')))
    it=[x for x in r['items'] if x['t']=='mail']
    ok(r['ok'] and r['ver']>=36, f"сервер: notes отвечает, версия {r.get('ver')}")
    ok(len(it)==3, f"Даниилу — 3 новых письма за 3 дня (старое не попало): {[x['text'] for x in it]}")
    ok(it[-1]['title']=='Цирк бухгалтерия' and it[-1]['box']=='info@frudom.ru', 'последнее — от цирка, ящик info@')
    ok([x['ord'] for x in it if x['text']=='Заявка на завтра']==[1], 'письмо «Заявка…» помечено как заявка')
    ok(r['mail']['unread']==4 and len(r['mail']['ids'])==4 and len(r['mail']['boxes'])==2, f"непрочитанных 4 (и старое), ящики: {r['mail']['boxes']}")
    ids={x['text']:x['id'] for x in it}
    ev(f"handle_({{action:'mail', op:'set', user:'Даниил', key:'1111', rows:[{{id:'{ids['Акт сверки']}', read:1}}]}}); handle_({{action:'mail', op:'tag', user:'Даниил', key:'1111', email:'news@shop.ru', kind:'spam'}}); 1")
    r=json.loads(ev(NOTES('Даниил','1111'))); t2=[x['text'] for x in r['items'] if x['t']=='mail']
    ok(t2==['Заявка на завтра'], f'прочитанное и спам не приходят: {t2}')
    ok(ids['Акт сверки'] not in r['mail']['ids'], 'прочитанное ушло из списка непрочитанных (приложение уберёт уведомление)')
    g=json.loads(ev(NOTES('Гриша','3333'))); tg=[x['text'] for x in g['items'] if x['t']=='mail']
    ok(g['mail']['ro'] and g['mail']['ids'] is None and 'Акт сверки' in tg, f'Грише (только читает) — все новые, без «прочитано»: {tg}')
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((390,844),(1300,900)):
            ev(f"handle_({{action:'mail', op:'set', user:'Даниил', key:'1111', rows:[{{id:'{ids['Заявка на завтра']}', read:0}}]}}); 1")
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page?source=apk&app=mail')
            ok(await pg.locator('#fd-app header.top').is_hidden(), f'{W}: на входе нет шапки сайта')
            await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate("[...document.querySelectorAll('section.tab')].filter(s=>!s.hidden).map(s=>s.id).join()")=='tab-mail', f'{W}: после входа — сразу «Почта»')
            ok(await pg.locator('#fd-app nav.tabs').is_hidden() and await pg.locator('#mbar').is_hidden() and await pg.locator('#fd-app header.top').is_hidden(), f'{W}: нет вкладок, шапки и нижней панели')
            for _ in range(40):
                if await pg.evaluate("__fd.mail().ML.loaded && __fd.mail().ML.rows.length>0"): break
                await pg.wait_for_timeout(250)
            ok(await pg.locator('#ml.mob').is_visible() and await pg.locator('[data-mm="dr"]').first.is_visible(), f'{W}: почта как приложение (список во весь экран, меню ☰)')
            st=await pg.evaluate("__fd.mailState()")
            ok(st['loaded'] and ids['Заявка на завтра'] in st['unread'] and ids['Акт сверки'] not in st['unread'], f"{W}: сайт отдаёт приложению непрочитанные ({len(st['unread'])})")
            await pg.evaluate("__fd.go('journal')"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("[...document.querySelectorAll('section.tab')].filter(s=>!s.hidden).map(s=>s.id).join()")=='tab-mail', f'{W}: другие вкладки не открываются')
            res='wait'
            for _ in range(40):
                res=await pg.evaluate(f"__fd.mailOpen('{ids['Заявка на завтра']}')")
                if res!='wait': break
                await pg.wait_for_timeout(300)
            await pg.wait_for_timeout(900)
            ok(res=='ok' and await pg.evaluate(f"__fd.mail().ML.sel==='{ids['Заявка на завтра']}'") and 'Заявка на завтра' in (await pg.text_content('#ml-view') or ''), f'{W}: нажатие на уведомление открывает письмо ({res})')
            ok(ids['Заявка на завтра'] not in (await pg.evaluate("__fd.mailState()"))['unread'], f'{W}: открытое письмо стало прочитанным — уведомление уберётся')
            ok(await pg.evaluate("__fd.mailOpen('нет-такого')")=='wait', f'{W}: неизвестное письмо — сайт подгружает почту')
            await pg.screenshot(path=f'/tmp/mailapp-open-{W}.png')
            ok(await pg.evaluate("__fd.mailOpen('','ord')")=='ok' and await pg.evaluate("__fd.mail().ML.f")=='ord', f'{W}: ярлык «Заявки» открывает папку заявок')
            ok(await pg.evaluate("__fd.mailOpen('','new')")=='ok' and await pg.evaluate("!!__fd.mail().ML.comp"), f'{W}: ярлык «Написать письмо» открывает новое письмо')
            await pg.wait_for_timeout(500); await pg.screenshot(path=f'/tmp/mailapp-new-{W}.png')
            await pg.go_back(); await pg.wait_for_timeout(600)
            await pg.evaluate("__fd.mailOpen('','in')"); await pg.wait_for_timeout(300)
            await pg.evaluate(f"__fd.mailOpen('{ids['Заявка на завтра']}','fwd')"); await pg.wait_for_timeout(1500)
            ok(await pg.evaluate("(__fd.mail().ML.comp||{}).kind")=='fwd' and 'Fwd:' in (await pg.evaluate("(__fd.mail().ML.comp||{}).subject||''")), f'{W}: «Переслать» из настоящего экрана открывает пересылку письма')
            await pg.evaluate("__fd.mailOpen('','in')"); await pg.wait_for_timeout(500)
            await pg.locator('[data-mm="dr"]').first.click(); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'/tmp/mailapp-drawer-{W}.png')
            lo=pg.locator('#ml-drp [data-mm="alogout"]')
            ok(await lo.count()==1, f'{W}: в меню слева есть «Выйти»')
            await lo.click(); await pg.wait_for_timeout(200); await lo.click(); await pg.wait_for_timeout(1200)
            ok(await pg.locator('#fd-login').is_visible() and await pg.locator('#fd-app nav.tabs').is_hidden(), f'{W}: выход — экран входа, без вкладок')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: без прокрутки вбок ({sw})')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}')
            await pg.close()
        pg=await b.new_page(viewport={'width':1300,'height':900})
        await pg.goto('http://localhost:8787/page'); await pg.wait_for_timeout(800)
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2000)
        ok(await pg.locator('#fd-app nav.tabs').is_visible() and await pg.evaluate("__fd.mailApp")==False, 'обычный сайт (без ?app=mail) — как раньше, с вкладками')
        ok(await pg.evaluate("__fd.mailOpen('','logout')")=='ok', '«Выйти» из настоящего приложения'); await pg.wait_for_timeout(1500)
        ok(await pg.locator('#fd-login').is_visible(), 'после «Выйти» — экран входа')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
