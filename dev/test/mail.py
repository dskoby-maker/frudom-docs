"""Вкладка «Почта»: подключение двух ящиков (Mail.ru, Timeweb) через посредника, письма, вложение, прочитано, ответ с того же ящика,
заявка в письме → «Сделать документы» через ИИ (текст письма — Code.gs aiRead с text), роли (Наталья видит, Гриша — нет), телефон.
Запуск: тестовый сервер с AI_FAKE=<файл с ответом ИИ> (тест сам его пишет в MAILAI, по умолчанию /tmp/mail-ai.json)."""
import asyncio, os, json, base64, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOTS','/tmp')
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
def rows(t):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
b64=lambda s: base64.b64encode(s if isinstance(s,bytes) else s.encode()).decode()
PX='k'*24
M_RU=[{'uid':11,'date':'2026-11-12T06:15:00.000Z','from':{'n':'МГУ Комбинат','a':'zakaz@msu.ru'},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':'Заявка на 14.11',
  'msgid':'<m11@msu.ru>','inReply':'','refs':'','text':'Добрый день!\nПрошу поставить:\nПомидоры тест 10 кг\nОгурцы тест 5 кг\n\nС уважением, Комбинат питания','html':'',
  'atts':[{'name':'заявка.pdf','mime':'application/pdf','size':13,'data':b64('%PDF-1.4 test')}]},
  {'uid':12,'date':'2026-11-11T08:00:00.000Z','from':{'n':'Рассылка','a':'news@shop.ru'},'to':[{'n':'','a':'frudom.ru@mail.ru'}],'cc':[],'replyTo':'','subject':'Скидки недели','msgid':'<n12@shop.ru>','inReply':'','refs':'',
  'text':'Только сегодня скидки','html':'<p>Только <b>сегодня</b> скидки <img src="https://track.example/x.png"></p>','atts':[]}]
M_TW=[{'uid':3,'date':'2026-11-12T09:30:00.000Z','from':{'n':'Цирк бухгалтерия','a':'buh@circus.ru'},'to':[{'n':'','a':'info@frudom.ru'}],'cc':[{'n':'Кассир','a':'kassa@circus.ru'}],'replyTo':'','subject':'Акт сверки за октябрь',
  'msgid':'<c3@circus.ru>','inReply':'','refs':'','text':'Пришлите, пожалуйста, акт сверки.','html':'','atts':[{'name':'big.xlsx','mime':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','size':3000000,'big':1,'data':b64('PK fake')}]}]
AIF=os.environ.get('MAILAI','/tmp/mail-ai.json')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, who, pw, W=1300, H=900):
    ctx=await b.new_context(viewport={'width':W,'height':H}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    ev("__mail={boxes:{'frudom.ru@mail.ru':{pass:'app-pass-mailru',uidv:5,msgs:%s},'info@frudom.ru':{pass:'tw-pass',uidv:9,msgs:%s}},sent:[]}; __tb={proxy:{key:'%s'}}; PropertiesService.getScriptProperties().setProperty('TB_PROXY', JSON.stringify({url:'https://functions.yandexcloud.net/dtest', key:'%s'})); PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); PropertiesService.getScriptProperties().deleteProperty('MAIL_ACC'); PropertiesService.getScriptProperties().deleteProperty('MAIL_SYNC_AT'); write_('mail', []); write_('uprefs', []); 1" % (json.dumps(M_RU,ensure_ascii=False), json.dumps(M_TW,ensure_ascii=False), PX, PX))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,'Даниил','1111')
        cid=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv)||D.customers[0]; D.prices[c.id]=D.prices[c.id]||{};
          [['ml-p1','Помидоры тест','200'],['ml-p2','Огурцы тест','100']].forEach(([id,n,pr])=>{ if(!D.products.find(p=>p.id===id)) D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); return c.id; })()""")
        cname=await pg.evaluate(f"__fd.D().customers.find(c=>c.id==='{cid}').name")
        open(AIF,'w').write(json.dumps({"customer":cname,"date":"2026-11-14","items":[{"name":"Помидоры тест","unit":"кг","qty":10},{"name":"Огурцы тест","unit":"кг","qty":5}]},ensure_ascii=False))
        ok(await pg.locator('nav.tabs button[data-tab="mail"]').is_visible(), 'вкладка «Почта» видна Даниилу')
        await pg.evaluate("location.hash='#pochta'"); await pg.wait_for_timeout(1500)
        ok('Ящики ещё не подключены' in (await pg.text_content('#ml')), 'пока ящиков нет — подсказка «Подключить ящики»')
        await pg.click('#ml [data-ml="set"]'); await pg.wait_for_timeout(500)
        ok(await pg.input_value('#mla-email')=='frudom.ru@mail.ru' and await pg.input_value('#mla-ih')=='imap.mail.ru', 'форма: сразу frudom.ru@mail.ru и серверы Mail.ru')
        ok('Пароли для внешних приложений' in (await pg.text_content('#ml .mlhow')), 'подсказка, где взять пароль Mail.ru')
        ok(await pg.evaluate("document.querySelectorAll('#ml input[type=password]').length")==0, 'нет полей type=password (правило автозаполнения)')
        await pg.fill('#mla-pass','wrong'); await pg.click('#ml [data-ml="accsave"]')
        ok(await until(pg,"/не пустил/.test((document.querySelector('#ml .mlmsg')||{}).textContent||'')"), 'неверный пароль — понятная ошибка')
        await pg.fill('#mla-pass','app-pass-mailru'); await pg.click('#ml [data-ml="accsave"]')
        ok(await until(pg,"__fd && document.querySelectorAll('#ml .mlsa').length===1"), 'ящик Mail.ru подключён')
        await pg.click('#ml [data-ml="accadd"]'); await pg.wait_for_timeout(300)
        ok(await pg.input_value('#mla-email')=='info@frudom.ru' and await pg.input_value('#mla-ih')=='imap.timeweb.ru' and await pg.input_value('#mla-sh')=='smtp.timeweb.ru', 'второй — info@frudom.ru с серверами Timeweb')
        await pg.fill('#mla-pass','tw-pass'); await pg.click('#ml [data-ml="accsave"]')
        ok(await until(pg,"document.querySelectorAll('#ml .mlsa').length===2"), 'ящик Timeweb подключён')
        acc=json.loads(ev("PropertiesService.getScriptProperties().getProperty('MAIL_ACC')"))
        ok(len(acc)==2 and acc[0]['pass']=='app-pass-mailru' and acc[1]['last']==3, 'пароли и последний UID — в свойствах скрипта')
        ok('app-pass' not in await pg.evaluate("JSON.stringify(localStorage)"), 'пароль не хранится на устройстве')
        await pg.click('#ml [data-ml="setclose"]'); await pg.wait_for_timeout(500)
        n=await pg.locator('#ml-list .mlr').count(); ok(n==3, f'во «Входящих» 3 письма из двух ящиков ({n})')
        R=rows('Почта'); ok(len(R)==3 and all(r['Файл письма на Диске'] for r in R), 'письма на листе «Почта», текст — файлом на Диске')
        big=[r for r in R if r['Тема']=='Акт сверки за октябрь'][0]; ok('"f"' not in big['Вложения (не редактировать)'], 'большое вложение не скачано заранее')
        ok(await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"mail\"]').dataset.n")=='3', 'на вкладке счётчик непрочитанных 3')
        ok(await pg.locator('#ml [data-mlf="ord"] em').text_content()=='1', 'фильтр «Заявки» — 1')
        ok(await pg.locator('#ml-list .mlord').count()==1, 'у письма с заявкой метка «Заявка»')
        await pg.screenshot(path=f'{SHOT}/mail-1300.png')
        # письмо с заявкой
        await pg.click('#ml-list .mlr:has-text("Заявка на 14.11")'); await until(pg,"/Прошу поставить/.test(document.querySelector('#ml-view').textContent)")
        ok(await pg.locator('#ml-view .mlordbox').count()==1, 'открытое письмо: плашка «Похоже на заявку»')
        ok(await pg.locator('#ml-view [data-mlmk="0"]').count()==1 and await pg.locator('#ml-view [data-mlmk="text"]').count()==1, 'кнопки «из заявка.pdf» и «из текста письма»')
        await pg.wait_for_timeout(800)
        R=rows('Почта'); ok([r for r in R if r['Тема']=='Заявка на 14.11'][0]['Прочитано']=='1', 'письмо отмечено прочитанным в таблице')
        ok(await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"mail\"]').dataset.n")=='2', 'счётчик стал 2')
        # вложение
        await pg.click('#ml-view [data-mlatt="0"][data-how="view"]'); await pg.wait_for_timeout(1200)
        ok(await pg.locator('dialog.skview iframe').count()==1, 'PDF-вложение открывается в окне')
        await pg.click('dialog.skview .dc-x'); await pg.wait_for_timeout(500)
        ok(await pg.locator('dialog.skview').count()==0, '× закрывает окно вложения')
        # ответ
        await pg.click('#ml-view [data-ml="reply"]'); await pg.wait_for_timeout(400)
        ok(await pg.input_value('#mlc-to')=='zakaz@msu.ru' and await pg.input_value('#mlc-sub')=='Re: Заявка на 14.11', 'ответ: кому и тема Re:')
        ok('> Прошу поставить:' in await pg.input_value('#mlc-text'), 'в ответе цитата письма')
        await pg.fill('#mlc-text','Принято, привезём 14.11.\n\n'+(await pg.input_value('#mlc-text')))
        await pg.set_input_files('#mlc-file', files=[{'name':'счёт.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 bill'}]); await pg.wait_for_timeout(300)
        await pg.click('#ml [data-ml="send"]'); ok(await until(pg,"!document.querySelector('#mlc-to')"), 'письмо отправлено')
        S=ev("JSON.stringify(__mail.sent)"); S=json.loads(S)
        ok(len(S)==1 and S[0]['acc']['user']=='frudom.ru@mail.ru' and S[0]['msg']['inReply']=='<m11@msu.ru>' and S[0]['msg']['atts'][0]['name']=='счёт.pdf', 'ушло с того же ящика, с In-Reply-To и вложением')
        R=rows('Почта'); ok(any(r['Папка']=='sent' for r in R) and [r for r in R if r['Тема']=='Заявка на 14.11'][0]['Ответили'], 'в «Отправленных» и отметка «ответили»')
        await pg.click('#ml [data-mlf="sent"]'); await pg.wait_for_timeout(300); ok(await pg.locator('#ml-list .mlr').count()==1, 'фильтр «Отправленные»')
        await pg.click('#ml [data-mlf="in"]'); await pg.wait_for_timeout(300)
        # рассылка: HTML, картинки скрыты
        await pg.click('#ml-list .mlr:has-text("Скидки недели")'); await until(pg,"!!document.querySelector('#ml-view [data-ml=html]')")
        ok(await pg.locator('#ml-view .mlordbox').count()==0, 'рассылка — не заявка')
        await pg.click('#ml-view [data-ml="html"]'); await pg.wait_for_timeout(400)
        sd=await pg.evaluate("document.querySelector('#ml-view iframe.mlhtml').getAttribute('srcdoc')")
        ok("img-src data: ;" in sd and 'sandbox' in await pg.evaluate("document.querySelector('#ml-view iframe.mlhtml').outerHTML"), 'HTML письма — в песочнице, картинки из интернета скрыты')
        # большое вложение — по запросу через посредника
        await pg.click('#ml-list .mlr:has-text("Акт сверки")'); await until(pg,"/акт сверки/.test(document.querySelector('#ml-view').textContent)")
        ok(await pg.locator('#ml-view [data-ml="replyall"]').count()==1, 'есть копия — кнопка «Ответить всем»')
        async with pg.expect_download() as dl: await pg.click('#ml-view [data-mlatt="0"][data-how="get"]')
        d=await dl.value; ok(d.suggested_filename=='big.xlsx', 'большое вложение скачалось через посредника')
        ok('"f"' in [r for r in rows('Почта') if r['Тема']=='Акт сверки за октябрь'][0]['Вложения (не редактировать)'], 'и сохранилось на Диске')
        # заявка → документы через ИИ (текст письма)
        await pg.click('#ml-list .mlr:has-text("Заявка на 14.11")'); await until(pg,"!!document.querySelector('#ml-view [data-mlmk=text]')")
        await pg.select_option('#ml-ocus', cid)
        await pg.click('#ml-view [data-mlmk="text"]')
        ok(await until(pg,"!document.querySelector('#tab-doc').hidden && /Позиций: 2/.test((document.querySelector('#imp-res')||{}).textContent||'') && __fd.D().draft.lines.some(l=>l.productId==='ml-p1' && +l.qty===10) && __fd.D().draft.customerId==='"+cid+"'", 120), 'текст письма прочитан ИИ → «Новый документ»: заказчик и товары (10 кг помидоров)')
        ok(await pg.locator('#fd-tback').is_visible(), 'сверху «‹ Назад: Почта»')
        pr=await pg.evaluate("JSON.parse(localStorage.getItem('frudom-docs-prefs:Даниил')||'{}').mlCus||{}"); ok(pr.get('zakaz@msu.ru')==cid, 'отправитель запомнен как этот заказчик')
        await pg.click('#fd-tback'); await pg.wait_for_timeout(800)
        ok(not await pg.locator('#tab-mail').is_hidden() and 'Документы сделаны' in await pg.text_content('#ml-list'), 'назад в «Почту», у письма «Документы сделаны»')
        ok(not errs, f'без ошибок {errs}'); await ctx.close()
        # Наталья — видит почту, но не настройки; Гриша — нет вкладки
        ctx,pg,errs=await login(b,'Наталья','2222')
        await pg.evaluate("location.hash='#pochta'"); await pg.wait_for_timeout(2500)
        ok(await pg.locator('#ml-list .mlr').count()>=3 and await pg.locator('#ml [data-ml="set"]').count()==0, 'Наталья видит письма, без «⚙ Ящики»')
        ok(not errs, f'Наталья: без ошибок {errs}'); await ctx.close()
        ctx,pg,errs=await login(b,'Гриша','3333')
        ok(await pg.locator('nav.tabs button[data-tab="mail"]').is_hidden(), 'Гриша вкладку «Почта» не видит')
        r=ev("JSON.stringify(doPost({postData:{contents:JSON.stringify({key:'3333',user:'Гриша',action:'mail',op:'list'})}}).t)"); ok('forbidden' in r, 'и сервер Грише не отдаёт')
        await ctx.close()
        # телефон
        ctx,pg,errs=await login(b,'Даниил','1111',390,844)
        await pg.evaluate("location.hash='#pochta'"); await pg.wait_for_timeout(2500)
        ok(await pg.locator('#ml-view').is_hidden(), 'телефон: сначала только список')
        await pg.click('#ml-list .mlr:has-text("Акт сверки")'); await pg.wait_for_timeout(1200)
        ok(await pg.locator('#ml-list').is_hidden() and await pg.locator('#ml-view [data-ml="back"]').is_visible(), 'телефон: письмо на весь экран, «‹ Письма»')
        sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw==390, f'телефон: без прокрутки вбок ({sw})')
        await pg.screenshot(path=f'{SHOT}/mail-390.png')
        await pg.click('#ml-view [data-ml="back"]'); await pg.wait_for_timeout(400); ok(await pg.locator('#ml-list').is_visible(), 'телефон: назад к списку')
        ok(not errs, f'телефон: без ошибок {errs}'); await ctx.close(); await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
