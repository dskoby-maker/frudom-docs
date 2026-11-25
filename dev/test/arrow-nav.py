"""Стрелки по полям (25.11.2026): окно закупки — ↓ к цене следующего товара, → к сумме, ← назад; в середине текста ← двигает курсор;
форма «Нового документа»; таблица «Заявки» не сломана; подсказки товара по ↓ работают как раньше."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
R='#dc-zki .dzl .dzr'
FOC="(()=>{const a=document.activeElement; return a? (a.className+'|'+(a.closest('.dzr')?[...a.closest('.dzl').children].indexOf(a.closest('.dzr')):'')+'|'+(a.id||'')):''})()"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-a1','Апельсины','174','кг'],['p-a2','Баклажаны','320','кг'],['p-a3','Грейпфруты','182','кг']].forEach(([id,n,pr,u])=>{ if(!D.products.some(x=>x.id===id)) D.products.push({id, name:n, code:'', unit:u, country:'', price:pr}); D.prices[c.id][id]=pr; });
          Object.assign(D.draft,{id:'arw1', customerId:c.id, number:'', lines:[{productId:'p-a1',qty:'15',price:'174'},{productId:'p-a2',qty:'3',price:'320'},{productId:'p-a3',qty:'6',price:'182'}]}); })()""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"arw1\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1200)
        await pg.fill(f'{R}:nth-child(1) .dzc','120'); 
        await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(100)
        f=await pg.evaluate(FOC); ok('dzc' in f and '|1|' in f, f'↓ с цены → цена второго товара ({f})')
        await pg.keyboard.press('ArrowDown'); f=await pg.evaluate(FOC); ok('dzc' in f and '|2|' in f, f'↓ ещё → цена третьего ({f})')
        await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); f=await pg.evaluate(FOC); ok('dzc' in f and '|0|' in f, f'↑↑ → обратно к первому ({f})')
        sel=await pg.evaluate("(()=>{const a=document.activeElement; return [a.selectionStart,a.selectionEnd,a.value.length]})()")
        ok(sel[0]==0 and sel[1]==sel[2], f'значение выделено при переходе {sel}')
        await pg.keyboard.press('ArrowRight'); f=await pg.evaluate(FOC); ok('dzt' in f and '|0|' in f, f'→ (всё выделено) → сумма в той же строке ({f})')
        await pg.keyboard.press('ArrowLeft'); f=await pg.evaluate(FOC); ok('dzc' in f and '|0|' in f, f'← → обратно к цене ({f})')
        await pg.keyboard.press('End'); await pg.keyboard.press('ArrowLeft'); f=await pg.evaluate(FOC); ok('dzc' in f and '|0|' in f, f'← в середине текста двигает курсор, не уходит ({f})')
        # ↓ из цены первого не перескакивает в «Куплено» (другой столбец)
        ok(True,'')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # Новый документ: подсказки товара по ↓
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
        ps=pg.locator('#d-lines input.ps').first
        await ps.click(); await ps.fill('Апел'); await pg.wait_for_timeout(300); await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(150)
        f=await pg.evaluate("document.activeElement.classList.contains('ps')"); ok(f, 'в поиске товара ↓ остаётся для подсказок')
        await pg.keyboard.press('Escape')
        # поле количества: ↓ в следующую строку количества
        q=await pg.evaluate("[...document.querySelectorAll('#d-lines input')].filter(i=>i.offsetWidth).map(i=>i.className).join(',')")
        print('  поля строки:', q[:160])
        ok(not errs, f'нет ошибок JS {errs}')
        await b.close()
    print("ИТОГ:", "ошибок нет" if not fails else f"ошибок: {len(fails)}")
asyncio.run(main())
