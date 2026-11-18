"""«Расходы и доходы»: «По категориям» и «Записи» свёрнуты по умолчанию, раскрываются, у каждого свой порядок; ПК и телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def add(pg, kind, s, note, cat=None):
    await pg.click(f'#pv-fin [data-pva="{kind}"]'); await pg.wait_for_timeout(450)
    await pg.fill('#pvi-sum', s); await pg.fill('#pvi-note', note)
    if cat: await pg.click(f'#pvi-cats [data-pvcat="{cat}"]')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
async def run(b, vw, tag, first):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1800)
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
    if first:
        await add(pg,'exp','500','Бензин','c-fuel'); await add(pg,'exp','9000','Аренда склада'); await add(pg,'exp','2000','Бензин 2','c-fuel'); await add(pg,'inc','300','Возврат')
    ok(await pg.locator('#pv-fin .pvfold').count()==2, f'{tag}: два раздела')
    ok(await pg.locator('#pv-fin .pvfold.open').count()==0, f'{tag}: по умолчанию свёрнуты')
    h=await pg.evaluate("document.querySelector('#pv-fin [data-pvfo=\"cats\"] .pvfob').getBoundingClientRect().height"); ok(h<2, f'{tag}: тело категорий скрыто ({h})')
    t=await pg.text_content('#pv-fin [data-pvfo="cats"] .pvfot'); ok('расходы' in t and 'доходы' in t, f'{tag}: в шапке итоги ({t.strip()[:60]})')
    await pg.click('#pv-fin [data-pvfold="cats"]'); await pg.wait_for_timeout(450)
    ok(await pg.locator('#pv-fin [data-pvfo="cats"].open').count()==1, f'{tag}: категории раскрылись')
    nm=lambda: pg.evaluate("[...document.querySelectorAll('#pv-fin [data-pvfo=\"cats\"] .pvcb[data-pvf^=\"exp:\"] .pvcbn b')].map(x=>x.textContent)")
    a=await nm(); await pg.click('#pv-fin [data-pvsort="cs:u"]'); await pg.wait_for_timeout(300); b2=await nm()
    ok(len(a)>=2 and a==list(reversed(b2)), f'{tag}: «Меньше сумма» переворачивает {a} → {b2}')
    await pg.click('#pv-fin [data-pvsort="cs:a"]'); await pg.wait_for_timeout(300); c=await nm(); ok(c==sorted(c, key=str.lower), f'{tag}: А–Я {c}')
    await pg.click('#pv-fin [data-pvfold="list"]'); await pg.wait_for_timeout(450)
    await pg.click('#pv-fin [data-pvsort="ls:s"]'); await pg.wait_for_timeout(300)
    v=await pg.evaluate("[...document.querySelectorAll('#pv-fin [data-pvfo=\"list\"] .pvits')].map(x=>Math.abs(parseFloat(x.textContent.replace(/[^\\d,−-]/g,'').replace('−','-').replace(',','.'))))")
    ok(len(v)>=3 and v==sorted(v, reverse=True), f'{tag}: записи по сумме {v[:5]}')
    await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500); await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#pv-fin .pvfold.open').count()==2, f'{tag}: открытость запомнилась')
    sw=await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"); ok(sw, f'{tag}: нет прокрутки вбок')
    await pg.screenshot(path=f'/tmp/pvfold-{tag}.png', full_page=False)
    ok(not errs, f'{tag}: ошибок нет {errs[:2]}'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); await run(b,(1300,900),'ПК',True); await run(b,(390,844),'телефон',False); await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else fails)
asyncio.run(main())
