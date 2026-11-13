"""Месячный акт (вкладка «Заказчики и цены»): сборка из накладных за месяц, проверки, Word-файл, загрузка прошлого акта.
Нужен тестовый сервер: node test/server.js. Свой прошлый акт можно проверить: AKT_DOCX=путь python3 test/akt.py"""
import asyncio, os, io, re, json, urllib.request
from playwright.async_api import async_playwright
import docx
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOTS','/tmp'); OUT=os.environ.get('AKT_OUT','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SETUP="""(()=>{const D=__fd.D(), c=D.customers.find(x=>/цирк/i.test(x.name)), x=D.contracts.find(y=>y.customerId===c.id), s=D.suppliers.find(y=>y.id===x.supplierId)||D.suppliers[0];
  x.supplierId=s.id; Object.assign(s,{fio:'Суховерхова Анастасия Дмитриевна', ogrn:'325774600007405', inn:'772148337370', name:'ИП Суховерхова Анастасия Дмитриевна'});
  const P=[['a1','Апельсины','792',174],['a2','Картофель продовольственный','643',63.95],['a3','Шиповник','643',350.8],['a4','Авокадо','604',535.65]];
  D.prices[c.id]=D.prices[c.id]||{}; P.forEach(([id,n,ct,pr])=>{ D.products.push({id,name:n,code:'',unit:'кг',country:ct,price:String(pr)}); D.prices[c.id][id]=String(pr); });
  const mk=(id,num,date,lines)=>{ const dr={id, supplierId:s.id, customerId:c.id, contractId:x.id, number:String(num), date, basis:x.basis, lines:lines.map(([pid,q,pr])=>({productId:pid, qty:String(q), price:String(pr)}))};
    const prods={}; P.forEach(([id,n,ct])=>prods[id]={name:n,unit:'кг',country:ct}); const snap={dr, s, c, prods, meta:{}}; const k=__fd.calc(dr,snap); D.journal.push({id, supplierId:s.id, customerId:c.id, number:String(num), date, sum:k.t.sum, snap}); };
  mk('k1',101,'2026-10-02',[['a1',40,174],['a2',400.3,63.95]]); mk('k2',102,'2026-10-15',[['a1',43.2,174],['a2',450,63.95],['a4',1,535.65]]);
  mk('k3',103,'2026-10-29',[['a3',2,360]]); mk('k4',104,'2026-09-20',[['a2',100,63.95]]); mk('k5',105,'2026-11-02',[['a1',5,174]]);
  window.__cid=c.id; window.__ctr=x.id; })()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(SETUP)
            await pg.evaluate(TAB+"('customers')"); await pg.wait_for_timeout(500)
            await pg.evaluate("(()=>{const s=document.querySelector('#cus-editor select.pick'); s.value=window.__cid; s.dispatchEvent(new Event('change'));})()"); await pg.wait_for_timeout(400)
            await pg.fill('#akt-ym','2026-10'); await pg.dispatch_event('#akt-ym','change'); await pg.wait_for_timeout(300)
            t=await pg.text_content('#akt-box')
            ok('Документов3' in t.replace(' ','').replace('\xa0',''), f'{W}: за октябрь 3 документа (сентябрь и ноябрь не вошли)')
            exp=round(40*174+400.3*63.95,2)+round(43.2*174+450*63.95+535.65,2)+720
            tot=await pg.evaluate("__akt.model().total"); ok(abs(tot-round(exp,2))<0.02, f'{W}: сумма за месяц {tot} = сумме накладных {round(exp,2)}')
            ok('цена в накладных 360,00' in t, f'{W}: замечание — цена шиповника не как в договоре')
            ok('ещё не настроен' in t or W!=1300, f'{W}: подсказка — шаблон не настроен')
            await pg.screenshot(path=f'{SHOT}/akt-{W}.png', full_page=False)
            await pg.locator('#akt-card').screenshot(path=f'{SHOT}/akt-card-{W}.png')
            # шаблон
            await pg.click('#akt-edit'); await pg.wait_for_timeout(300)
            await pg.fill('#akt-box [data-akt="subject"]','Поставка овощей и фруктов свежих и консервированных для столовой')
            await pg.fill('#akt-box [data-akt="cusFull"]','Государственное унитарное предприятие города Москвы «Большой Московский государственный цирк на проспекте Вернадского»')
            await pg.fill('#akt-box [data-akt="from"]','2026-10-01'); await pg.fill('#akt-box [data-akt="to"]','2027-02-28'); await pg.fill('#akt-box [data-akt="prior"]','1000')
            qs=pg.locator('#akt-box .aktspec [data-s="qty"]'); n=await qs.count()
            for i in range(n): await qs.nth(i).fill('1000')
            await pg.screenshot(path=f'{SHOT}/akt-edit-{W}.png')
            await pg.click('#akt-save'); await pg.wait_for_timeout(1500)
            ct=await pg.evaluate("JSON.parse(__fd.D().contracts.find(x=>x.id===window.__ctr).akt||'{}')"); ok(ct.get('subject','').startswith('Поставка') and len(ct.get('spec',[]))==n, f'{W}: шаблон сохранён в договор ({n} строк)')
            dump=json.load(urllib.request.urlopen('http://localhost:8787/dump'))['Контракты']; ok(any('Поставка овощей' in ''.join(r) for r in dump[1:]), f'{W}: шаблон дошёл до таблицы (лист «Контракты»)')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ww=await pg.evaluate("innerWidth"); ok(sw<=ww, f'{W}: нет прокрутки вбок ({sw}≤{ww})')
            # скачать
            async with pg.expect_download() as dl: await pg.click('#akt-dl')
            d=await dl.value; path=os.path.join(OUT, f'akt-{W}.docx'); await d.save_as(path); ok(d.suggested_filename.endswith('октябрь 2026.docx'), f'{W}: имя файла {d.suggested_filename}')
            D=docx.Document(path); text='\n'.join(p.text for p in D.paragraphs)
            ok(len(D.tables)==4, f'{W}: в акте 4 таблицы (шапка, договор, факт, подписи)')
            ok('«31» октября 2026 г., Москва' in '\n'.join(c.text for c in D.tables[0].rows[0].cells), f'{W}: дата акта — последний день месяца')
            ok('Договором № Х' in text or 'Договором №' in text, f'{W}: п.1 — «в соответствии с Договором № …»')
            ok('именуемая в дальнейшем «Поставщик», действующая от своего имени' in text and 'ОГРНИП 325774600007405' in text, f'{W}: поставщик ИП с ОГРНИП, женский род')
            fact=[[c.text for c in r.cells] for r in D.tables[2].rows[1:]]
            ok([r[0] for r in fact]==['Апельсины','Картофель продовольственный','Шиповник','Авокадо'] or len(fact)==4, f'{W}: раздел 3 — 4 позиции: {[r[0] for r in fact]}')
            ok(any(r[0]=='Апельсины' and r[2]=='83,2' and r[4]=='14 476,80' and r[5]=='Турецкая Республика' for r in fact), f'{W}: апельсины 83,2 кг на 14 476,80, Турецкая Республика')
            totS=f"{tot:,.2f}".replace(',',' ').replace('.',',')
            ok(f'за отчетный период (октябрь 2026 г.) {totS} руб.' in text, f'{W}: п.7 — за отчётный период {totS}')
            cum=round(1000+tot+100*63.95,2); cumS=f"{cum:,.2f}".replace(',',' ').replace('.',',')
            ok(f'поставлено товара на сумму {cumS} руб.' in text, f'{W}: п.7 — с начала договора {cumS} (сентябрь + до сайта)')
            ok(re.search(r'— '+re.escape(totS)+r' руб\. \([А-Я][а-я ]+\) рубл', text) is not None, f'{W}: п.8 — сумма прописью')
            ok('с 02.10.2026г. по 29.10.2026г.' in text and 'с 01.10.2026г. по 28.02.2027г.' in text, f'{W}: сроки поставки')
            # снять документ галочкой
            await pg.click('#akt-box details.aktdocs summary'); await pg.uncheck('#akt-box [data-aktoff="k3"]'); await pg.wait_for_timeout(300)
            t2=await pg.evaluate("__akt.model().docs.length"); ok(t2==2, f'{W}: документ снят галочкой — в акте 2')
            # обратная загрузка своего акта
            await pg.set_input_files('#akt-imp', path); await pg.wait_for_timeout(800)
            sp=await pg.evaluate("__akt.st.cfg.spec.length+'|'+__akt.st.cfg.spec.filter(r=>r.pid).length+'|'+__akt.st.cfg.subject+'|'+__akt.st.cfg.from+'|'+__akt.st.cfg.to")
            ok(sp.startswith(f'{n}|{n}|Поставка овощей') and sp.endswith('2026-10-01|2027-02-28'), f'{W}: прошлый акт прочитан и связан: {sp}')
            if os.environ.get('AKT_DOCX') and W==1300:
                await pg.set_input_files('#akt-imp', os.environ['AKT_DOCX']); await pg.wait_for_timeout(800)
                r=await pg.evaluate("JSON.stringify({n:__akt.st.cfg.spec.length, m:__akt.st.cfg.spec.filter(r=>r.pid).length, sub:__akt.st.cfg.subject, from:__akt.st.cfg.from, to:__akt.st.cfg.to, full:__akt.st.cfg.cusFull, first:__akt.st.cfg.spec[0]})")
                print('   ваш акт:', r)
            # файлы актов: у цирка сборщик + загрузка, у другого заказчика — только загрузка
            async with pg.expect_download() as dl2: await pg.click('#akt-dl')
            await pg.wait_for_timeout(300); await pg.click('#fd-toasts .ta >> text=Сохранить копию'); await pg.wait_for_timeout(1500)
            ok(await pg.locator('#akt-files .skfile').count()>=1, f'{W}: копия акта сохранена в акты заказчика')
            rowsA=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Акты заказчиков') or [[]]; ok(len(rowsA)>=2, f'{W}: лист «Акты заказчиков» заполнен')
            await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers.find(x=>/МГУ/.test(x.name)); const s=document.querySelector('#cus-editor select.pick'); s.value=c.id; s.dispatchEvent(new Event('change'));})()"); await pg.wait_for_timeout(800)
            ok(await pg.locator('#akt-box .aktbar').count()==0 and await pg.locator('#aktf-file').count()==1, f'{W}: у МГУ нет сборщика — только загрузка файла')
            await pg.set_input_files('#aktf-file', path); await pg.wait_for_timeout(1500)
            ok('за' in (await pg.text_content('#akt-files')) and await pg.locator('#akt-files .skfile').count()>=1, f'{W}: файл акта привязан к МГУ')
            async with pg.expect_download() as dl3: await pg.locator('#akt-files [data-aktfg]').first.click()
            ok((await dl3.value).suggested_filename.endswith('.docx'), f'{W}: акт скачивается обратно')
            await pg.locator('#akt-card').screenshot(path=f'{SHOT}/akt-mgu-{W}.png')
            ok(not errs, f'{W}: ошибок JS: {errs[:3]}')
            await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё ок' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
