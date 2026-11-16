"""«Оплачен» одним нажатием в «Последних счетах»: папки «К оплате / Оплаченные / Все», счёт уезжает, «Отменить», снять оплату в два нажатия, счёт без накладных. ПК и телефон.
(основа — inv-pay.py) Оплата по общему счёту: счёт за прошлый месяц (по умолчанию, дата — сегодня), «Отметить оплату» закрывает все
накладные счёта (частичная — с самой старой), статус в карточке и списке, «Снять оплату», журнал/контракт не меняются. Телефон."""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
t=datetime.date.today(); pm_end=t.replace(day=1)-datetime.timedelta(days=1); pm=pm_end.replace(day=1)
D1=(pm+datetime.timedelta(days=2)).isoformat(); D2=(pm+datetime.timedelta(days=9)).isoformat(); D3=(pm+datetime.timedelta(days=19)).isoformat()
async def mkdoc(pg, jid, date, lines):
    ls=','.join(f"{{productId:'{a}',qty:'{q}',price:'{p}'}}" for a,q,p in lines)
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, branchId:'', number:'', date:'{date}', lines:[{ls}]}}); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
PAY="(id=>{const j=__fd.D().journal.find(x=>x.id===id); return __fd.payOf?__fd.payOf(j):null})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-ap','Яблоки','100'],['p-gr','Груши','150']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        await mkdoc(pg,'ip1',D1,[('p-ap','10','100')])            # 1000
        await mkdoc(pg,'ip2',D2,[('p-gr','4','150')])             # 600
        await mkdoc(pg,'ip3',D3,[('p-ap','5','100')])             # 500
        jn=len(rows('Журнал'))
        await pg.evaluate(TAB+"('doc')"); await pg.click('#inv-all'); await pg.wait_for_timeout(500); await pg.click('#inv-new'); await pg.wait_for_timeout(400)
        await pg.select_option('#inv-dlg select[data-f="customerId"]', await pg.evaluate("window.__cid")); await pg.wait_for_timeout(300)
        st=await pg.evaluate("(()=>{const s=__inv.st(); return [s.from,s.to,s.date,[...s.docs].sort()]})()")
        if t.day<=20: ok(st[0]==pm.isoformat() and st[1]==pm_end.isoformat(), f'по умолчанию — прошлый месяц: {st[:2]}')
        ok(st[2]==t.isoformat(), f'дата счёта — сегодня: {st[2]}')
        ok(st[3]==['ip1','ip2','ip3'], f'все накладные месяца выбраны сами: {st[3]}')
        await pg.click('#inv-dlg [data-invd="ip3"]'); await pg.wait_for_timeout(200); await pg.click('#inv-dlg [data-invd="ip3"]'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("__inv.st().docs.has('ip3')"), 'накладную можно снять и вернуть галочкой')
        await pg.click('#inv-dlg [data-invsave="0"]') if await pg.locator('#inv-dlg [data-invsave="0"]').count() else await pg.click('#inv-dlg [data-invsave]')
        await pg.wait_for_timeout(900); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await pg.evaluate(TAB+"('doc')"); await pg.click('#inv-all'); await pg.wait_for_timeout(1500)
        INVC="(id=>{const r=__inv.rows().find(x=>x.id===id); return r?JSON.parse(r.data||'{}'):null})"
        inv1=await pg.evaluate("__inv.rows()[0].id")
        # второй счёт — без накладных
        await pg.evaluate("""(()=>{const D=__fd.D(), r={id:'inv-nod', date:new Date().toISOString().slice(0,10), number:'77', supplierId:D.suppliers[0].id, customerId:window.__cid, place:'', period:'', sum:'500', data:JSON.stringify({lines:[{name:'Услуга',unit:'шт',qty:'1',price:'500'}]}), updated:''}; D.invoices.push(r); })()""")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelector('#inv-recent').open=true"); await pg.wait_for_timeout(700)
        cnt=lambda: pg.evaluate("Object.fromEntries([...document.querySelectorAll('#inv-recent [data-invmn]')].map(x=>[x.dataset.invmn||'all',x.textContent]))")
        on=await pg.evaluate("document.querySelector('#inv-recent [data-invmpay].on')?.dataset.invmpay")
        ok(on=='open', f'по умолчанию открыта папка «К оплате»: {on!r}')
        c=await cnt(); ok(c.get('open')=='2' and c.get('paid')=='0' and c.get('all')=='2', f'счётчики папок: {c}')
        ok(await pg.locator('#inv-mlist .invr').count()==2, 'в «К оплате» оба счёта')
        st=await pg.text_content(f'#inv-mlist [data-inv="{inv1}"] .invst'); ok('не оплачен' in st, f'под суммой «не оплачен»: {st}')
        # отметить оплату
        await pg.click(f'#inv-mlist [data-inv="{inv1}"] [data-invpay]'); await pg.wait_for_timeout(150)
        ok(await pg.locator(f'#inv-mlist [data-inv="{inv1}"] .invpb.pop').count()==1, 'кнопка вспыхнула зелёной галочкой')
        await pg.wait_for_timeout(400); ok(await pg.locator('#inv-mlist .invr.invgo').count()==1, 'строка плавно уезжает')
        await pg.wait_for_timeout(700)
        ok(await pg.locator(f'#inv-mlist [data-inv="{inv1}"]').count()==0 and await pg.locator('#inv-mlist .invr').count()==1, 'счёт ушёл из «К оплате»')
        P=[await pg.evaluate(PAY+f"('{i}')") for i in ('ip1','ip2','ip3')]
        ok(all(x['st']=='paid' and x['d']==t.isoformat() for x in P), f'все накладные счёта оплачены сегодня: {[(x["st"],x["d"]) for x in P]}')
        c=await cnt(); ok(c.get('open')=='1' and c.get('paid')=='1', f'счётчики: {c}')
        tt=await pg.text_content('#fd-toasts'); ok('оплачен' in tt and 'Отменить' in tt and 'Оплаченные' in tt, 'уведомление «оплачен · Перенесён в «Оплаченные»» с «Отменить»')
        await pg.screenshot(path=f'{SHOT}/inv-paid-1.png')
        # отменить из уведомления
        await pg.locator('#fd-toasts .fd-toast:has-text("оплачен") .ta').first.click(); await pg.wait_for_timeout(600)
        P=[await pg.evaluate(PAY+f"('{i}')") for i in ('ip1','ip2','ip3')]
        ok(all(x['st']=='due' for x in P) and await pg.locator(f'#inv-mlist [data-inv="{inv1}"]').count()==1, '«Отменить» — всё как было, счёт снова в «К оплате»')
        # снова оплатить и перейти в «Оплаченные»
        await pg.click(f'#inv-mlist [data-inv="{inv1}"] [data-invpay]'); await pg.wait_for_timeout(1300)
        await pg.click('#inv-recent [data-invmpay="paid"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator(f'#inv-mlist [data-inv="{inv1}"] .invpb.on').count()==1, 'в «Оплаченных» счёт с зелёным «✓ Оплачен»')
        st=await pg.text_content(f'#inv-mlist [data-inv="{inv1}"] .invst'); ok('оплачен' in st and t.strftime('%d.%m') in st, f'под суммой «оплачен дд.мм»: {st}')
        b1=pg.locator(f'#inv-mlist [data-inv="{inv1}"] [data-invpay]'); await b1.click(); await pg.wait_for_timeout(200)
        ok('Снять оплату?' in await b1.text_content() and (await pg.evaluate(PAY+"('ip1')"))['st']=='paid', 'первое нажатие — только «Снять оплату?»')
        await b1.click(); await pg.wait_for_timeout(1000)
        ok((await pg.evaluate(PAY+"('ip1')"))['st']=='due' and await pg.locator(f'#inv-mlist [data-inv="{inv1}"]').count()==0, 'второе — оплата снята, счёт ушёл из «Оплаченных»')
        ok(await pg.locator('#inv-mlist .invempty').count()==1, 'пустая папка — понятная подсказка')
        # счёт без накладных
        await pg.click('#inv-recent [data-invmpay="open"]'); await pg.wait_for_timeout(400)
        await pg.click('#inv-mlist [data-inv="inv-nod"] [data-invpay]'); await pg.wait_for_timeout(1300)
        d=await pg.evaluate(INVC+"('inv-nod')"); ok(d and d.get('paid',{}).get('d')==t.isoformat(), f'счёт без накладных — отметка у самого счёта: {d.get("paid") if d else None}')
        await pg.click('#inv-recent [data-invmpay=""]'); await pg.wait_for_timeout(400)
        ok(await pg.locator('#inv-mlist .invr').count()==2, '«Все» — оба счёта')
        await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())"); await pg.locator('#inv-recent').scroll_into_view_if_needed(); await pg.screenshot(path=f'{SHOT}/inv-paid-pc.png')
        await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
        R=[r for r in rows('Счета на оплату') if 'inv-nod' in json.dumps(r,ensure_ascii=False)]
        ok(R and '"paid"' in json.dumps(R[0],ensure_ascii=False).replace('\\"','"'), 'отметка записана в таблицу')
        ok(len(rows('Журнал'))==jn, 'журнал не изменился')
        # телефон
        await pg.set_viewport_size({'width':360,'height':760}); await pg.wait_for_timeout(500)
        await pg.click('#inv-recent [data-invmpay="open"]'); await pg.wait_for_timeout(400)
        await pg.locator('#inv-mlist .invr').first.scroll_into_view_if_needed()
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw==360, f'телефон 360: без прокрутки вбок {sw}')
        await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{SHOT}/inv-paid-phone.png', full_page=False)
        ok(not errs, f'ошибок страницы нет: {errs[:3]}')
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
