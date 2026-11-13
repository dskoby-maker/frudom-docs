"""Почта: набранный ответ не пропадает при обновлении/догрузке письма; «Заявки» без счётчика и с подписью; свои папки (создать, переложить, переименовать, удалить), ПК и телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE=os.environ.get('BASE','http://localhost:8787')
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode())
PX='k'*24
def m(uid, frm, sub, text, d): return {'uid':uid,'date':d,'from':{'n':frm,'a':frm.split()[0].lower()+'@ex.ru'},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':sub,'msgid':f'<x{uid}@ex.ru>','inReply':'','refs':'','text':text,'html':'','atts':[]}
MSG=[m(1,'Комбинат','Заявка на 14.11','Прошу поставить:\nПомидоры 10 кг\nОгурцы 5 кг','2026-11-12T06:15:00.000Z'),
     m(2,'Банк','Выписка','Ваша выписка за день','2026-11-12T07:15:00.000Z'),
     m(3,'Поставщик','Прайс на неделю','Новые цены','2026-11-12T08:15:00.000Z')]
ACC=[{'id':'a1','email':'frudom.ru@mail.ru','name':'','ih':'imap.mail.ru','ip':993,'sh':'smtp.mail.ru','sp':465,'user':'frudom.ru@mail.ru','pass':'app-pass-mailru'}]
async def login(b, who, pw, W=1300, H=900, mob=False):
    ctx=await b.new_context(viewport={'width':W,'height':H}, has_touch=mob, is_mobile=mob); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(BASE+'/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'app-pass-mailru',uidv:5,msgs:%s}},sent:[]}; __tb={proxy:{key:'%s'}}; const P=PropertiesService.getScriptProperties(); P.setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); P.setProperty('MAIL_ACC', JSON.stringify(%s)); P.deleteProperty('MAIL_SYNC_AT'); P.deleteProperty('MAIL_FOLDERS'); write_('mail', []); write_('mailtags', []); 1" % (json.dumps(MSG,ensure_ascii=False), PX, PX, json.dumps(ACC)))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate("location.hash='#pochta'"); await pg.wait_for_timeout(800)
        await pg.click('#ml [data-ml="sync"]'); ok(await until(pg,"document.querySelectorAll('#ml-list .mlr').length>=3"), 'письма загрузились')
        # 1. «Заявки» без счётчика + подпись
        ch=pg.locator('#ml [data-mlf="ord"]'); ok((await ch.locator('em').count())==0, '«Заявки»: счётчика нет')
        await ch.click(); await pg.wait_for_timeout(300)
        ok('лучше перепроверяйте' in (await pg.text_content('#ml-list')), 'в «Заявках» подпись: сайт сам определяет, перепроверяйте')
        await pg.click('#ml [data-mlf="in"]'); await pg.wait_for_timeout(300)
        # 2. ответ не пропадает: открыть письмо, «Ответить» до догрузки, печатать, потом догрузка + обновление списка
        async def slow(route):
            if '"op":"get"' in (route.request.post_data or ''): await asyncio.sleep(1.5)
            await route.continue_()
        await pg.route('**/exec**', slow)
        await pg.click('#ml-list .mlr >> text=Выписка'); await pg.wait_for_timeout(150)
        await pg.evaluate("__fd.mail().compose('reply')"); await pg.wait_for_timeout(150)
        await pg.click('#mlc-text'); await pg.keyboard.press('Control+Home'); await pg.keyboard.type('Добрый день, спасибо!')
        await pg.wait_for_timeout(1900)   # письмо догрузилось
        await pg.keyboard.type(' Ещё'); await pg.evaluate("__fd.mail().draw()"); await pg.keyboard.type(' слово')
        v=await pg.input_value('#mlc-text')
        ok('Добрый день, спасибо! Ещё слово' in v, 'набранный ответ сохранился после догрузки письма и перерисовки: '+repr(v[:60]))
        ok(await pg.evaluate("document.activeElement && document.activeElement.id==='mlc-text'"), 'курсор остался в тексте ответа')
        await pg.unroute('**/exec**', slow); await pg.locator("#ml [data-ml=cclose]:visible").first.click(); await pg.wait_for_timeout(200)
        # 3. своя папка
        await pg.click('#ml [data-ml="fldnew"]'); await pg.wait_for_timeout(200)
        await pg.click('.mlfdlg [data-v="1"]'); ok('Напишите название' in (await pg.text_content('.mlfdlg')), 'пустое название не принимается')
        await pg.fill('#mlf-name','Входящие'); await pg.click('.mlfdlg [data-v="1"]'); ok('уже есть' in (await pg.text_content('.mlfdlg')), 'название как у стандартной папки — нельзя')
        await pg.fill('#mlf-name','Банк'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800)
        ok(await pg.locator('.mlfdlg').count()==0, 'окно названия закрылось')
        fl=json.loads(ev("PropertiesService.getScriptProperties().getProperty('MAIL_FOLDERS')||'[]'") or '[]')
        ok(len(fl)==1 and fl[0]['name']=='Банк', 'папка сохранена в таблице (MAIL_FOLDERS)')
        ok('Своя папка' in (await pg.text_content('#ml-list')), 'открыта новая папка, сверху «Своя папка «Банк»»')
        await pg.click('#ml [data-mlf="in"]'); await pg.wait_for_timeout(300)
        # переложить через правую кнопку
        await pg.click('#ml-list .mlr >> text=Выписка', button='right'); await pg.wait_for_timeout(200)
        await pg.click('#ml-menu [data-mlm="fldpick"]'); await pg.wait_for_timeout(250)
        await pg.click('#ml-menu [data-mlfp]:has-text("Банк")'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#ml-list .mlr:has-text("Выписка")').count()==0, 'письмо ушло из «Входящих»')
        fch=pg.locator('#ml .mlf button:has-text("Банк")'); await fch.click(); await pg.wait_for_timeout(300)
        ok(await pg.locator('#ml-list .mlr:has-text("Выписка")').count()==1, 'письмо в папке «Банк»')
        await until(pg,"true",4)
        ok(json.loads(ev("JSON.stringify(read_('mail').map(r=>r.order).filter(Boolean))")) and 'fld' in ev("JSON.stringify(read_('mail').map(r=>r.order))"), 'папка письма записана в таблицу (order.fld)')
        # кнопка в письме «Вернуть во входящие»
        await pg.click('#ml-list .mlr >> text=Выписка'); await pg.wait_for_timeout(800)
        ok('Письмо в папке «Банк»' in (await pg.text_content('#ml-view')), 'в письме видно, в какой оно папке')
        # переименовать
        await pg.click('#ml [data-ml="fldren"]'); await pg.fill('#mlf-name','Банк и налоги'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
        ok(await pg.locator('#ml .mlf button:has-text("Банк и налоги")').count()==1, 'папка переименована')
        # удалить — письма во «Входящие», с отменой
        await pg.click('#ml [data-ml="flddel"]'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#ml-list .mlr:has-text("Выписка")').count()==1 and await pg.evaluate("__fd.mail().ML.f")=='in', 'папка удалена, письмо снова во «Входящих»')
        await pg.click('#fd-toasts .fd-toast:has-text("удалена") .ta'); await pg.wait_for_timeout(800)
        ok(await pg.locator('#ml .mlf button:has-text("Банк и налоги")').count()==1 and await pg.locator('#ml-list .mlr:has-text("Выписка")').count()==1, '«Отменить» вернул папку вместе с письмом')
        ok(not errs, 'ПК без ошибок '+str(errs[:2]))
        # 4. телефон
        c2,pm,e2=await login(b,'Наталья','2222',390,800,True)
        await pm.evaluate("location.hash='#pochta'"); await until(pm,"document.querySelectorAll('#ml-list .mlr').length>=2")
        await pm.click('#ml-ab [data-mm="dr"]'); await pm.wait_for_timeout(400)
        dr=await pm.text_content('#ml-drp'); ok('Мои папки' in dr and 'Банк и налоги' in dr and 'Новая папка' in dr, 'телефон: в меню «Мои папки», папка видна Наталье, «Новая папка»: '+repr(dr[:300]))
        ok(await pm.locator('#ml-drp [data-f="ord"] em').count()==0, 'телефон: у «Заявок» нет счётчика')
        await pm.click('#ml-drp [data-mm="fnew"]'); await pm.wait_for_timeout(400); await pm.fill('#mlf-name','Поставщики'); await pm.keyboard.press('Enter'); await pm.wait_for_timeout(800)
        ok(await pm.evaluate("(m=>m.fname(m.ML.f))(__fd.mail())")=='Поставщики', 'телефон: новая папка создана и открыта')
        await pm.click('#ml-ab [data-mm="dr"]'); await pm.wait_for_timeout(300); await pm.click('#ml-drp [data-f="in"]'); await pm.wait_for_timeout(400)
        await pm.click('#ml-list .mlr >> text=Прайс'); await pm.wait_for_timeout(900)
        await pm.click('#ml-view [data-mm="vfld"]'); await pm.wait_for_timeout(300)
        await pm.click('#ml-menu [data-mlfp]:has-text("Поставщики")'); await pm.wait_for_timeout(700)
        ok(await pm.evaluate("(m=>m.ML.rows.some(r=>r.subject==='Прайс на неделю' && m.fld(r)))(__fd.mail())"), 'телефон: письмо переложено в папку из страницы письма')
        ok(await pm.evaluate("document.documentElement.scrollWidth<=390"), 'телефон: без прокрутки вбок')
        ok(not e2, 'телефон без ошибок '+str(e2[:2]))
        # 5. Гриша — только читает
        c3,pg3,e3=await login(b,'Гриша','3333')
        await pg3.evaluate("location.hash='#pochta'"); await pg3.wait_for_timeout(1500)
        if await pg3.locator('#ml').count():
            ok(await pg3.locator('#ml [data-ml="fldnew"]').count()==0, 'Гриша: кнопки «+ Папка» нет')
        await b.close()
    print('ИТОГ:', 'всё ок' if not fails else f'ошибок: {len(fails)}'); 
    if fails: raise SystemExit(1)
asyncio.run(main())
