"""Оплата по общему счёту: счёт за прошлый месяц (по умолчанию, дата — сегодня), «Отметить оплату» закрывает все
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
        chip=await pg.text_content('#inv-list .invr .invps'); ok(chip and 'не оплачен' in chip, f'в списке статус «не оплачен»: {chip}')
        await pg.click('#inv-list .invr'); await pg.wait_for_timeout(1200)
        tx=(await pg.text_content('#fd-dcard .invpay')).replace(' ',' ').replace(' ',' ')
        ok('Оплачено 0 из 3' in tx and '2 100' in tx, f'карточка: оплачено 0 из 3, сумма 2 100: {tx[:120]}')
        v=await pg.evaluate("document.querySelector('#invpay-sum').value"); ok(v=='2100', f'в поле суммы — весь остаток: {v!r}')
        await pg.fill('#invpay-sum','1050'); await pg.click('#fd-dcard [data-dc="pay"]'); await pg.wait_for_timeout(700)
        P=[await pg.evaluate(PAY+f"('{i}')") for i in ('ip1','ip2','ip3')]
        ok(P[0]['st']=='paid' and P[1]['st']=='part' and abs(P[1]['s']-50)<.01 and P[2]['st']=='due', f'1 050 ₽: первая оплачена, вторая частично 50, третья ждёт: {[(x["st"],x["s"]) for x in P]}')
        tx=(await pg.text_content('#fd-dcard .invpay')).replace(' ',' ').replace(' ',' ')
        ok('Оплачено 1 из 3' in tx and 'осталось 1 050' in tx, f'карточка пересчиталась: {tx[:140]}')
        await pg.screenshot(path=f'{SHOT}/inv-pay-part.png')
        await pg.click('#fd-dcard [data-dc="pay"]'); await pg.wait_for_timeout(700)
        P=[await pg.evaluate(PAY+f"('{i}')") for i in ('ip1','ip2','ip3')]
        ok(all(x['st']=='paid' for x in P) and P[2]['d']==t.isoformat(), 'остаток — все три накладные оплачены, дата оплаты сегодня')
        ok('Оплачен' in await pg.text_content('#fd-dcard .invpay-h') and await pg.locator('#invpay-sum').count()==0, 'счёт «Оплачен», поля оплаты больше нет')
        ok(await pg.locator('#fd-dcard .invdc.paid').count()==3, 'накладные в счёте отмечены ✓')
        await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
        C=[r for r in rows('Себестоимость накладных') if r.get('ID','') in ('ip1','ip2','ip3') or any(v in ('ip1','ip2','ip3') for v in r.values())]
        ok(len(C)==3 and all('_pay' in json.dumps(r,ensure_ascii=False) for r in C), f'оплата записана в «Себестоимость накладных» у 3 накладных: {len(C)}')
        R=rows('Счета на оплату'); ok(len(R)==1 and 'оплата' in R[0].get('Данные', json.dumps(R[0],ensure_ascii=False)), 'в истории счёта — запись об оплате')
        ok(len(rows('Журнал'))==jn, 'журнал не изменился — счёт не накладная')
        await pg.click('#fd-dcard [data-dc="unpay"]'); await pg.wait_for_timeout(700)
        P=[await pg.evaluate(PAY+f"('{i}')") for i in ('ip1','ip2','ip3')]
        ok(all(x['st']=='due' for x in P), '«Снять оплату» — все три снова ждут оплату')
        # телефон
        await pg.set_viewport_size({'width':360,'height':760}); await pg.wait_for_timeout(500)
        sw=await pg.evaluate("[document.documentElement.scrollWidth, document.querySelector('#fd-dcard').scrollWidth, document.querySelector('#fd-dcard').clientWidth]")
        ok(sw[0]==360 and sw[1]<=sw[2]+2, f'телефон 360: без прокрутки вбок {sw}')
        await pg.screenshot(path=f'{SHOT}/inv-pay-phone.png')
        ok(not errs, f'ошибок страницы нет: {errs[:3]}')
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
