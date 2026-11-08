"""Суммы в полях ввода — с пробелами по тысячам при вводе; сохраняется число без пробелов; курсор не прыгает."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SHOW="(s=>{ const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value'); return d.get.call(document.querySelector(s)); })"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    # 1) цена в документе
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
    pr=pg.locator('#d-lines input.price').first
    await pr.click(); await pr.press('Control+a'); await pr.type('125000,5'); await pg.wait_for_timeout(200)
    ok(await pg.evaluate(SHOW+"('#d-lines input.price')")=='125 000,5', f'{tag}: цена в документе показывается «125 000,5»')
    v=await pg.evaluate("String(__fd.D().draft.lines[0].price)"); ok(v.replace(',','.') in ('125000.5',), f'{tag}: в документ сохранилось число без пробелов ({v})')
    # курсор: вставить цифру в середину
    await pr.click(); await pg.evaluate("(()=>{ const e=document.querySelector('#d-lines input.price'); e.setSelectionRange(1,1); })()")
    await pr.type('9'); await pg.wait_for_timeout(100)
    sh=await pg.evaluate(SHOW+"('#d-lines input.price')"); cp=await pg.evaluate("document.querySelector('#d-lines input.price').selectionStart")
    ok(sh=='1 925 000,5' and cp==3, f'{tag}: цифра в середине — разряды пересчитаны, курсор на месте ({sh}, {cp})')
    # 2) запись расхода
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500)
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
    btn=pg.locator('[data-pva="exp"]').first
    ok(await btn.count()>0, f'{tag}: есть кнопка расхода')
    if await btn.count():
        await btn.click(); await pg.wait_for_timeout(500)
        s=pg.locator('#pvi-sum'); await s.click(); await s.type('60000'); await pg.wait_for_timeout(100)
        ok(await pg.evaluate(SHOW+"('#pvi-sum')")=='60 000', f'{tag}: сумма расхода «60 000»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    # 3) закупка одной суммой в окне накладной: любое поле .dzs
    await pg.evaluate("(()=>{ const i=document.createElement('input'); i.className='dzs'; i.id='tmoney'; document.querySelector('#fd-app').appendChild(i); i.value='1500000'; })()")
    await pg.wait_for_timeout(200)
    ok(await pg.evaluate(SHOW+"('#tmoney')")=='1 500 000' and await pg.evaluate("document.querySelector('#tmoney').value")=='1500000', f'{tag}: поле, заполненное кодом, тоже с пробелами, а читается без них')
    # 4) количество — без разрядов (это не деньги)
    q=pg.locator('#d-lines input.qty').first
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await q.click(); await q.press('Control+a'); await q.type('1200'); await pg.wait_for_timeout(100)
    ok(await pg.evaluate(SHOW+"('#d-lines input.qty')")=='1200', f'{tag}: количество остаётся без пробелов')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
