"""Почта на телефоне (как в почтовых приложениях): шапка с меню папок, письма по дням, смахивания (прочитано / в неважные, с отменой),
долгое нажатие — выбор нескольких писем и действия над ними, письмо и новое письмо — страница поверх списка («Назад» телефона закрывает),
«Все письма», «Прочитать все» (с отменой), без прокрутки вбок. И на ПК: папка «Все письма» и кнопка «Прочитать все».
Запуск: тестовый сервер (node test/server.js), лучше чистый."""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOTS','/tmp')
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
def rows(t):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
NOW=datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
def iso(h): return (NOW-datetime.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
def msg(uid, h, n, a, subj, text):
    return {'uid':uid,'date':iso(h),'from':{'n':n,'a':a},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':subj,'msgid':f'<m{uid}@t.ru>','inReply':'','refs':'','text':text,'html':'','atts':[]}
NAMES=[('Ситникова Екатерина','sitnikova@gpm.ru'),('Андриянова Елена','buh@zoo.ru'),('Ольга Шалдина','olga@mok.ru'),('lk.soft@roseltorg.ru','lk.soft@roseltorg.ru'),('Склад МГУ','sklad@dpmgu.ru')]
M_RU=[msg(100+i, 1+i*7, NAMES[i%5][0], NAMES[i%5][1], f'Письмо номер {i+1}', f'Текст письма {i+1}. Добрый день!') for i in range(24)]
M_TW=[msg(300, 2, 'Цирк бухгалтерия', 'buh@circus.ru', 'Акт сверки за октябрь', 'Пришлите акт сверки.')]
M_TW[0]['to']=[{'n':'','a':'info@frudom.ru'}]
PX='k'*24
async def touch(cdp, typ, x, y): await cdp.send('Input.dispatchTouchEvent', {'type':typ, 'touchPoints':[] if typ=='touchEnd' else [{'x':x,'y':y}]})
async def swipe(pg, cdp, sel, dx):
    b=await pg.locator(sel).bounding_box(); x=b['x']+b['width']/2; y=b['y']+b['height']/2
    await touch(cdp,'touchStart',x,y)
    for k in range(1,13): await touch(cdp,'touchMove',x+dx*k/12,y+(k%2)); await pg.wait_for_timeout(16)
    await touch(cdp,'touchEnd',x+dx,y); await pg.wait_for_timeout(700)
async def longpress(pg, cdp, sel):
    b=await pg.locator(sel).bounding_box(); x=b['x']+b['width']/2; y=b['y']+b['height']/2
    await touch(cdp,'touchStart',x,y); await pg.wait_for_timeout(650); await touch(cdp,'touchEnd',x,y); await pg.wait_for_timeout(400)
async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    acc=[{'id':'mru','email':'frudom.ru@mail.ru','name':'','color':'','ih':'imap.mail.ru','ip':993,'sh':'smtp.mail.ru','sp':465,'user':'frudom.ru@mail.ru','pass':'app-pass-mailru','uidv':'','last':0,'at':'','err':''},
         {'id':'mtw','email':'info@frudom.ru','name':'','color':'','ih':'imap.timeweb.ru','ip':993,'sh':'smtp.timeweb.ru','sp':465,'user':'info@frudom.ru','pass':'tw-pass','uidv':'','last':0,'at':'','err':''}]
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'app-pass-mailru',uidv:5,msgs:%s},'info@frudom.ru':{pass:'tw-pass',uidv:9,msgs:%s}},sent:[]}; __tb={proxy:{key:'%s'}}; var P=PropertiesService.getScriptProperties(); P.setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); P.setProperty('MAIL_ACC', %s); P.deleteProperty('MAIL_SYNC_AT'); write_('mail', []); write_('uprefs', []); write_('mailtags', []); 1"
       % (json.dumps(M_RU,ensure_ascii=False), json.dumps(M_TW,ensure_ascii=False), PX, PX, json.dumps(json.dumps(acc))))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True, device_scale_factor=2); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        cdp=await ctx.new_cdp_session(pg)
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("location.hash='#pochta'")
        ok(await until(pg,"document.querySelectorAll('#ml-list .mlr.mr').length>=20", 80), 'телефон: письма пришли, строки в мобильном виде')
        ok(await pg.locator('#ml-ab').is_visible() and 'Входящие' in await pg.text_content('#ml-ab'), 'шапка «Входящие» с меню и поиском')
        ok(await pg.locator('#ml-list .mlday').count()>=3 and (await pg.locator('#ml-list .mlday').first.text_content())=='Сегодня', 'письма по дням, сверху «Сегодня»')
        ok(await pg.locator('#ml-ov .mlfab').is_visible(), 'кнопка «Написать» внизу справа')
        sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw==390, f'без прокрутки вбок ({sw})')
        await pg.screenshot(path=f'{SHOT}/mlm-list.png')
        un0=await pg.locator('#ml-list .mlr.mr.un').count(); ok(un0==25, f'все 25 писем не прочитаны ({un0})')
        # смахнуть вправо — прочитано
        first='#ml-list .mlr.mr >> nth=0'; fid=await pg.locator(first).get_attribute('data-mlid')
        await swipe(pg, cdp, first, 230)
        ok(await pg.evaluate(f"!document.querySelector('#ml-list .mlr[data-mlid=\"{fid}\"]').classList.contains('un')"), 'смахнуть вправо — письмо прочитано')
        await pg.wait_for_timeout(600); R={r['ID (не менять)']:r for r in rows('Почта')}; ok(R[fid]['Прочитано']=='1', 'отметка «прочитано» ушла в таблицу')
        ok(await pg.evaluate(f"!document.querySelector('#ml-view').classList.contains('open')"), 'смахивание не открыло письмо')
        # смахнуть влево — в неважные, с отменой
        sec='#ml-list .mlr.mr >> nth=1'; sid=await pg.locator(sec).get_attribute('data-mlid')
        await swipe(pg, cdp, sec, -260); await pg.wait_for_timeout(400)
        ok(await pg.locator(f'#ml-list .mlr[data-mlid="{sid}"]').count()==0, 'смахнуть влево — письмо ушло из «Входящих»')
        ok(await until(pg, "[...document.querySelectorAll('#fd-toasts .fd-toast')].some(t=>/Неважных/.test(t.textContent))", 12), 'уведомление «В «Неважных»» с «Отменить»')
        await pg.wait_for_timeout(500); R={r['ID (не менять)']:r for r in rows('Почта')}; ok('"minor":1' in (R[sid].get('Заявка (не редактировать)') or ''), 'в таблице — неважное')
        await pg.locator('#fd-toasts .fd-toast:has-text("Неважных") .ta').click(); await pg.wait_for_timeout(700)
        ok(await pg.locator(f'#ml-list .mlr[data-mlid="{sid}"]').count()==1, '«Отменить» — письмо вернулось')
        # долгое нажатие — выбор
        await longpress(pg, cdp, '#ml-list .mlr.mr >> nth=2')
        ok(await pg.locator('#ml .mlm.selm').count()==1 and (await pg.text_content('#ml-ab .mlabn')).strip()=='1', 'долгое нажатие — режим выбора, выбрано 1')
        await pg.locator('#ml-list .mlr.mr >> nth=3').tap(); await pg.locator('#ml-list .mlr.mr >> nth=4').locator('.mrav').tap(); await pg.wait_for_timeout(300)
        ok((await pg.text_content('#ml-ab .mlabn')).strip()=='3', 'нажатие на строку и на кружок добавляет к выбору (3)')
        ok(await pg.evaluate("!document.querySelector('#ml-view').classList.contains('open')"), 'в режиме выбора письмо не открывается')
        await pg.screenshot(path=f'{SHOT}/mlm-pick.png')
        P=await pg.evaluate("[...document.querySelectorAll('#ml-list .mlr.picked')].map(x=>x.dataset.mlid)")
        await pg.locator('#ml-ab [data-mm="pact"][data-a="spam"]').tap(); await pg.wait_for_timeout(800)
        left=await pg.evaluate("ids=>ids.filter(i=>document.querySelector('#ml-list .mlr[data-mlid=\"'+i+'\"]')).length", P)
        ok(len(P)==3 and await pg.locator('#ml .mlm.selm').count()==0 and left==0, '«В спам» — 3 письма ушли, выбор закрыт')
        # меню папок
        await pg.locator('#ml-ab [data-mm="dr"] >> nth=0').tap(); await pg.wait_for_timeout(450)
        ok(await pg.evaluate("document.getElementById('ml-dr').classList.contains('open')"), '☰ — меню папок открылось')
        await pg.screenshot(path=f'{SHOT}/mlm-drawer.png')
        sp=await pg.text_content('#ml-drp [data-f="spam"]'); ok('Спам' in sp, f'в меню есть «Спам» ({sp.strip()})')
        await pg.go_back(); await pg.wait_for_timeout(450)
        ok(await pg.evaluate("!document.getElementById('ml-dr').classList.contains('open') && location.hash==='#pochta'"), '«Назад» телефона закрывает меню, вкладка та же')
        await pg.locator('#ml-ab [data-mm="dr"] >> nth=0').tap(); await pg.wait_for_timeout(400)
        await pg.locator('#ml-drp [data-f="all"]').tap(); await pg.wait_for_timeout(600)
        ok('Все письма' in await pg.text_content('#ml-ab') and await pg.locator('#ml-list .mlr.mr').count()==25, '«Все письма» — все 25, и спам тоже')
        nsp=int(''.join(ch for ch in sp if ch.isdigit()) or 0); ok(nsp>=3 and await pg.locator('#ml-list .mlwh.sp').count()==nsp, f'в «Все письма» у спама метка «Спам» ({nsp} — все письма этих отправителей)')
        await pg.locator('#ml-ab [data-mm="dr"] >> nth=0').tap(); await pg.wait_for_timeout(400); await pg.locator('#ml-drp [data-f="in"]').tap(); await pg.wait_for_timeout(500)
        # открыть письмо
        await pg.locator('#ml-list .mlr.mr >> nth=0').tap(); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("document.querySelector('#ml-view').classList.contains('open')") and await pg.locator('#ml-view .mlpb [data-ml="back"]').is_visible(), 'письмо — страница поверх списка, со стрелкой «Назад»')
        ok(await pg.locator('#ml-view .mlpf [data-ml="reply"]').is_visible(), 'внизу «Ответить» / «Переслать»')
        sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw==390, f'письмо: без прокрутки вбок ({sw})')
        await pg.screenshot(path=f'{SHOT}/mlm-view.png')
        await pg.go_back(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!document.querySelector('#ml-view').classList.contains('open') && location.hash==='#pochta'"), '«Назад» телефона закрывает письмо, остаёмся в почте')
        await pg.locator('#ml-list .mlr.mr >> nth=1').tap(); await pg.wait_for_timeout(700)
        await pg.locator('#ml-view .mlpb [data-ml="back"]').tap(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!document.querySelector('#ml-view').classList.contains('open')"), 'стрелка «Назад» закрывает письмо')
        ok(await pg.evaluate("!(history.state&&history.state.fdml)"), 'после стрелки лишнего шага «Назад» не осталось')
        # действия в письме: в неважные из письма
        await pg.locator('#ml-list .mlr.mr >> nth=0').tap(); await pg.wait_for_timeout(700); vid=await pg.evaluate("document.querySelector('#ml-view .mlpc') && document.querySelector('#ml-list .mlr.sel') ? document.querySelector('#ml-list .mlr.sel').dataset.mlid : ''")
        await pg.locator('#ml-view .mlpb [data-a="minor"]').tap(); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("!document.querySelector('#ml-view').classList.contains('open')") and await pg.locator(f'#ml-list .mlr[data-mlid="{vid}"]').count()==0, 'в письме «В неважные» — письмо закрылось и ушло из «Входящих»')
        # написать
        await pg.locator('#ml-ov .mlfab').tap(); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("document.querySelector('#ml-view').classList.contains('open')") and 'Новое письмо' in await pg.text_content('#ml-view .mlpb'), '«Написать» — новое письмо на весь экран')
        await pg.fill('#mlc-text','черновик'); await pg.wait_for_timeout(200)
        await pg.evaluate("window.dispatchEvent(new Event('resize'))")
        await pg.go_back(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!document.querySelector('#ml-view').classList.contains('open')"), '«Назад» закрывает новое письмо')
        # поиск
        await pg.locator('#ml-ab [data-mm="srch"]').tap(); await pg.wait_for_timeout(300); await pg.fill('#ml-q','Акт сверки'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#ml-list .mlr.mr').count()==1, 'поиск в шапке')
        await pg.locator('#ml-ab [data-mm="srchx"]').tap(); await pg.wait_for_timeout(400)
        # прочитать все
        n=await pg.locator('#ml-list .mlr.mr.un').count(); U=await pg.evaluate("[...document.querySelectorAll('#ml-list .mlr.un')].map(x=>x.dataset.mlid)")
        await pg.locator('#ml-ab [data-mm="more"]').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#ml-menu [data-a="readall"]').tap(); await pg.wait_for_timeout(800)
        ok(n>0 and await pg.locator('#ml-list .mlr.mr.un').count()==0, f'«⋯» → «Прочитать все» ({n} писем)')
        await pg.wait_for_timeout(800); R={r['ID (не менять)']:r for r in rows('Почта')}; ok(all(R[i]['Прочитано']=='1' for i in U), 'в таблице все прочитаны')
        await pg.locator('#fd-toasts .fd-toast:has-text("Прочитано") .ta').tap(); await pg.wait_for_timeout(700)
        ok(await pg.locator('#ml-list .mlr.mr.un').count()==n, '«Отменить» — снова не прочитаны')
        # прокрутка вниз — подгрузка не нужна (25 писем), но и без ошибок
        await pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); await pg.wait_for_timeout(400)
        ok(not errs, f'телефон: без ошибок {errs}'); await ctx.close()
        # ПК: «Все письма» и «Прочитать все»
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("location.hash='#pochta'"); await until(pg,"document.querySelectorAll('#ml-list .mlr').length>5")
        ok(await pg.locator('#ml-list .mlr.mr').count()==0, 'ПК: обычный вид списка')
        await pg.click('#ml [data-mlf="all"]'); await pg.wait_for_timeout(400)
        ok(await pg.locator('#ml-list .mlr').count()==25 and await pg.locator('#ml-list .mlwh.sp').count()>=3, 'ПК: «Все письма» — все, спам с меткой')
        await pg.click('#ml [data-mlf="in"]'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#ml [data-ml="readall"]').is_visible(), 'ПК: кнопка «Прочитать все»')
        await pg.click('#ml [data-ml="readall"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#ml-list .mlr.un').count()==0 and await pg.locator('#ml [data-ml="readall"]').count()==0, 'ПК: всё прочитано, кнопка спряталась')
        ok(not errs, f'ПК: без ошибок {errs}'); await ctx.close(); await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
