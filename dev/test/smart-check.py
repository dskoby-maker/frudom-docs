"""«Умная проверка»: сайт помнит, сколько заказчик обычно берёт, и переспрашивает необычное.
Количество в разы больше прошлых поставок → жёлтая строка, «Поставить N», «Да, верно»; первое «Сохранить» переспрашивает, второе — сохраняет;
цена не как в прайсе и не как в прошлый раз; второй документ на тот же день; дата далеко от сегодня; клетка «Заявки»; телефон."""
import asyncio, os, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
def ago(n): return (datetime.date.today()-datetime.timedelta(days=n)).isoformat()
async def draft(pg, jid, lines, date):
    ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', date:'{date}', ship:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
async def jn(pg, jid): return await pg.evaluate(f"__fd.D().journal.some(j=>j.id==='{jid}')")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            P=f'p-pt{W}'; Q=f'p-ap{W}'
            await pg.evaluate(f"""(()=>{{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{{}};
              [['{P}','Петрушка {W}','400','кг'],['{Q}','Яблоки {W}','120','кг']].forEach(([id,n,pr,u])=>{{ if(!D.products.some(x=>x.id===id)) D.products.push({{id, name:n, code:'', unit:u, country:'', price:pr}}); D.prices[c.id][id]=pr; }}); }})()""")
            for n,(d,q) in enumerate([(30,'2'),(25,'3'),(20,'1'),(15,'2'),(10,'5')]):
                jid=f'sh{W}{n}'; await draft(pg, jid, [(P,q),(Q,'10')], ago(d)); await pg.click('#d-save'); await pg.wait_for_timeout(900)
                ok(await jn(pg, jid), f'{W}: история {n+1} сохранена без вопросов')
            ok(len(await pg.evaluate("__fd.D().journal.filter(j=>j.id.startsWith('sh')).map(j=>j.id)"))>=5, f'{W}: 5 прошлых поставок')
            # 50 кг петрушки
            await draft(pg, f'sn{W}', [(P,'50'),(Q,'10')], ago(2))
            row='#d-lines .line[data-i="0"]'
            ok(await pg.locator(row+'.qck').count()==1, f'{W}: строка 50 кг — жёлтая')
            t=await pg.text_content(row+' .qcknote') or ''
            ok('Много? 50 кг' in t and '1–5 кг' in t and 'в среднем 2 кг' in t, f'{W}: пояснение «обычно 1–5, в среднем 2»: {t[:120]}')
            ok(await pg.locator(row+' [data-qckfix]').count()==1 and '5 кг' in (await pg.text_content(row+' [data-qckfix]')), f'{W}: кнопка «Поставить 5 кг» (лишний ноль)')
            ok(await pg.locator('#d-lines .line[data-i="1"].qck').count()==0, f'{W}: обычные 10 кг яблок — без подсветки')
            await pg.locator(row).screenshot(path=f'/tmp/smart{W}.png')
            await pg.click('#d-save'); await pg.wait_for_timeout(900)
            ok(not await jn(pg, f'sn{W}'), f'{W}: первое «Сохранить» — переспрашивает, не сохраняет')
            ok('Проверьте' in (await pg.inner_text('#fd-toasts')), f'{W}: уведомление «Проверьте»')
            await pg.click(row+' [data-qckfix]'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("__fd.D().draft.lines[0].qty")=='5' and await pg.input_value(row+' .qty')=='5', f'{W}: «Поставить 5 кг» исправило количество')
            ok(await pg.locator(row+'.qck').count()==0, f'{W}: после исправления подсветки нет')
            await pg.click('#d-save'); await pg.wait_for_timeout(900)
            ok(await jn(pg, f'sn{W}'), f'{W}: с 5 кг сохранилось сразу')
            # «Да, верно» и второе нажатие
            await draft(pg, f'so{W}', [(P,'40')], ago(1))
            await pg.click(row+' [data-qckok]'); await pg.wait_for_timeout(300)
            ok(await pg.locator(row+'.qck').count()==0, f'{W}: «Да, верно» — подсветка ушла')
            await pg.click('#d-save'); await pg.wait_for_timeout(900)
            ok(await jn(pg, f'so{W}'), f'{W}: после «Да, верно» сохраняется')
            await draft(pg, f'sp{W}', [(P,'0.05')], ago(3))
            ok('Мало?' in (await pg.text_content(row+' .qcknote') or ''), f'{W}: 0,05 кг — «Мало?»')
            await pg.click('#d-save'); await pg.wait_for_timeout(700); await pg.click('#d-save'); await pg.wait_for_timeout(900)
            ok(await jn(pg, f'sp{W}'), f'{W}: второе нажатие «Сохранить» — сохраняет')
            # цена
            await draft(pg, f'sq{W}', [(Q,'10')], ago(4)); await pg.fill('#d-lines .line[data-i="0"] .price','900'); await pg.wait_for_timeout(300)
            t=await pg.text_content(row+' .qcknote') or ''
            ok('Проверьте цену' in t and '120' in t, f'{W}: цена 900 вместо 120 — переспрос: {t[:100]}')
            await pg.click(row+' [data-pckfix]'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("+__fd.D().draft.lines[0].price")==120, f'{W}: «Поставить 120 ₽»')
            # второй документ на тот же день
            await draft(pg, f'sr{W}', [(Q,'10')], ago(10))
            t=await pg.text_content('#d-qck') or ''
            ok(await pg.locator('#d-qck:not([hidden])').count()==1 and 'уже есть накладная' in t, f'{W}: на этот день уже есть накладная: {t[:90]}')
            await pg.click('#d-qck [data-qckdupok]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#d-qck[hidden]').count()==1, f'{W}: «Это другая поставка» — убрано')
            # дата далеко
            await draft(pg, f'ss{W}', [(Q,'10')], '2025-11-12')
            ok('Дата документа 12.11.2025' in (await pg.text_content('#d-qck') or ''), f'{W}: дата год назад — переспрос')
            # «Заявка»
            await pg.evaluate(TAB+"('order')"); await pg.wait_for_timeout(500)
            await pg.evaluate("(()=>{const s=document.querySelector('#o-cus'); if(s){ s.value=window.__cid; s.dispatchEvent(new Event('change',{bubbles:true})); }})()"); await pg.wait_for_timeout(600)
            await pg.evaluate("(()=>{const o=__fd.D().order; if(o) o.allP=true; })()")
            inp=pg.locator(f'#o-body input.q[data-p="{P}"]').first
            if await inp.count():
                await inp.fill('500'); await inp.dispatch_event('input'); await pg.wait_for_timeout(400)
                ok('qhi' in (await inp.get_attribute('class') or ''), f'{W}: «Заявка» — клетка 500 кг жёлтая')
                ok('Необычное количество' in (await pg.text_content('#o-qck') or ''), f'{W}: «Заявка» — строка под таблицей')
                await inp.fill(''); await inp.dispatch_event('input')
            else: print('—   в «Заявке» товара нет в списке — пропуск')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
