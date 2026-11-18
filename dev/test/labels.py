"""Наклейки на коробки (цирк): кнопка в окне накладной, число наклеек по коробкам, данные товара для наклейки
(сохраняются в «Товары»), печать одним заданием 55,4 × 40 мм, текст влезает в наклейку, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw, who='Даниил', pw='1111'):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def open_lbl(pg, did):
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
    await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{did}\"]').click()"); await pg.wait_for_timeout(600)
    await pg.click('#fd-dcard [data-dc="lbl"]'); await pg.wait_for_timeout(600)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        cid=await pg.evaluate("(__fd.D().customers.find(c=>c.inn==='7736039722')||{}).id")
        ok(bool(cid), 'цирк есть в заказчиках')
        oth=await pg.evaluate("__fd.D().customers.find(c=>c.inn!=='7736039722').id")
        await pg.evaluate("""(()=>{const D=__fd.D(); D.products.push({id:'p-apl', name:'Яблоки свежие тест', code:'', unit:'кг', country:'792', price:'100'},{id:'p-pcs', name:'Ананас тест', code:'', unit:'шт', country:'643', price:'300'}); })()""")
        async def save(did, c):
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{did}', customerId:'{c}', number:'', lines:[{{productId:'p-apl',qty:'25',price:'100',qOk:'25',pOk:'100'}},{{productId:'p-pcs',qty:'4',price:'300',qOk:'4',pOk:'300'}}]}}); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2000)
        await save('lb-1', cid); await save('lb-2', oth)
        ok(await pg.evaluate("__fd.D().journal.some(j=>j.id==='lb-1') && __fd.D().journal.some(j=>j.id==='lb-2')"), 'накладные сохранены')
        # у другого заказчика кнопки нет
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"lb-2\"]').click()"); await pg.wait_for_timeout(500)
        ok(await pg.locator('#fd-dcard [data-dc="lbl"]').count()==0, 'у другого заказчика кнопки «Наклейки» нет')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await open_lbl(pg,'lb-1')
        ok(await pg.locator('#fd-dcard.lbwin').count()==1, 'окно «Наклейки» открылось из накладной цирка')
        n=await pg.text_content('#fd-dcard .lbsum b'); ok(n.strip()=='4', f'25 кг по 10 кг = 3 наклейки + ананас 1 = 4: {n}')
        al=await pg.evaluate("__lbl.all()"); ok([x[1] for x in al]==[10,10,5,None], f'массы 10, 10, 5 кг: {al}')
        pv=await pg.text_content('#fd-dcard .lbpv'); ok('Страна происхождения Турция' in pv and 'Импортер' in pv and 'Масса нетто 10кг' in pv and 'Упаковщик (фасовщик)' in pv, f'образец наклейки: {pv[:200]}')
        # коробка 5 кг → 5 наклеек
        await pg.fill('#fd-dcard [data-lbb$=":0"]','5'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(400)
        n=await pg.text_content('#fd-dcard .lbsum b'); ok(n.strip()=='6', f'по 5 кг — 5 наклеек + 1 = 6: {n}')
        # данные товара: изготовитель
        await pg.click('#fd-dcard [data-lbk="data"][data-k$=":0"]'); await pg.wait_for_timeout(300)
        await pg.fill('#fd-dcard [data-lf="m"]','SNR GIDA TARIM'); await pg.fill('#fd-dcard [data-lf="d"]','10 дней'); await pg.fill('#fd-dcard [data-lf="b"]','8')
        await pg.click('#fd-dcard [data-lbk="save"]'); await pg.wait_for_timeout(2500)
        pr=[r for r in rows('Товары') if r.get('ID (не менять)')=='p-apl']
        lb=json.loads((pr[0].get('Данные для наклейки (заполняется с сайта)') if pr else '') or '{}')
        ok(lb.get('m')=='SNR GIDA TARIM' and lb.get('d')=='10 дней' and lb.get('b')=='8', f'данные наклейки сохранены в «Товары»: {lb}')
        n=await pg.text_content('#fd-dcard .lbsum b'); ok(n.strip()=='5', f'вес коробки товара 8 кг → 25 кг = 4 наклейки + 1: {n}')
        pv=await pg.text_content('#fd-dcard .lbpv'); ok('Изготовитель SNR GIDA TARIM' in pv and 'Срок годности 10 дней' in pv, 'образец обновился')
        # печать
        await pg.evaluate("window.__pr=0; HTMLIFrameElement.prototype.__p=1")
        await pg.click('#fd-dcard [data-lbk="print"]'); await pg.wait_for_timeout(1500)
        last=await pg.evaluate("__lbl.last()")
        ok(last.count('class="lb"')==5 and 'Масса нетто 8кг' in last and 'Масса нетто 1кг' in last and 'Количество 4 шт' in last, f'на печать 5 наклеек: {last.count(chr(34)+"lb"+chr(34))}')
        ok('Импортер' not in last.split('Ананас тест')[1][:400] if 'Ананас тест' in last else False, 'у товара из России нет строки «Импортер»')
        fit=await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].pop(); const d=f.contentWindow.document; return [...d.querySelectorAll('.lbi')].map(b=>b.scrollHeight<=b.clientHeight+1)})()")
        ok(fit and all(fit), f'текст влезает в наклейку: {fit}')
        size=await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].pop(); return f.contentWindow.document.querySelector('style').textContent.includes('size:55.4mm 40mm')})()")
        ok(size, 'размер страницы 55,4 × 40 мм')
        g=await pg.evaluate("""(()=>{const D=__fd.D(); D.products.push({id:'o1',name:'Лук репчатый',unit:'кг'},{id:'o2',name:'Лук репчатый красный',unit:'кг'},{id:'o3',name:'Лук красный',unit:'кг'},{id:'o4',name:'Картофель продовольственный',unit:'кг'},{id:'o5',name:'Картофель беби',unit:'кг'});
          const N=id=>(D.products.find(p=>p.id===id)||{}).name||''; return [__lbl.guess('ЛУК РЕПЧАТЫЙ  КРАСНЫЙ.btw','Лук репчатый красный',''), __lbl.guess('ЛУК РЕПЧАТЫЙ.btw','Лук репчатый',''), __lbl.guess('ЛУК КРАСНЫЙ.btw','Лук красный',''), __lbl.guess('Картофель беби.btw','Картофель беби',''), __lbl.guess('ГРИБЫ.btw','Шампиньоны свежие','')].map(N)})()""")
        ok(g[:4]==['Лук репчатый красный','Лук репчатый','Лук красный','Картофель беби'], f'похожие названия не путаются: {g}')
        # загрузка готовой наклейки из BarTender (файл .btw — путь в BTW, в репозиторий не кладём)
        if os.environ.get('BTW'):
            await pg.set_input_files('#lb-up', os.environ['BTW']); await pg.wait_for_timeout(2500)
            up=await pg.text_content('#fd-dcard .lbup'); ok('Яблоки свежие' in up and 'Страна происхождения' in up, f'наклейка из BarTender прочитана: {up[:160]}')
            await pg.select_option('#fd-dcard [data-lbup="0"]','p-apl'); await pg.wait_for_timeout(300)
            await pg.click('#fd-dcard [data-lbk="upsave"]'); await pg.wait_for_timeout(2500)
            pr=[r for r in rows('Товары') if r.get('ID (не менять)')=='p-apl']; lb=json.loads((pr[0].get('Данные для наклейки (заполняется с сайта)') if pr else '') or '{}')
            ok(isinstance(lb.get('x'),list) and lb['x'][0]=='Яблоки свежие' and lb.get('p')=='080326' and 'SNR GIDA' in lb.get('m',''), f'текст наклейки сохранён у товара: {lb.get("x",[])[:3]} партия {lb.get("p")}')
            await pg.click('#fd-dcard [data-lbk="print"]'); await pg.wait_for_timeout(1500)
            last=await pg.evaluate("__lbl.last()")
            ok('Мелитопольская' in last and 'Партия: 080326' in last and '17.11.2026' not in last and 'Масса нетто 8кг' in last, 'печать — текст из BarTender, дата и масса новые')
            fit=await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].pop(); const d=f.contentWindow.document; return [...d.querySelectorAll('.lbi')].map(b=>b.scrollHeight<=b.clientHeight+1)})()")
            ok(fit and all(fit), f'текст из BarTender влезает: {fit}')
        ok(not errs, f'ошибок нет {errs[:3]}')
        await pg.keyboard.press('Escape')
        # Склад и телефон
        c2,p2,e2=await login(b,(390,800),'Склад','4444')
        await open_lbl(p2,'lb-1')
        ok(await p2.locator('#fd-dcard.lbwin').count()==1, 'Склад на телефоне открыл наклейки')
        pv=await p2.text_content('#fd-dcard .lbpv'); ok('SNR GIDA' in pv, 'у Склада те же данные товара')
        w=await p2.evaluate("[document.documentElement.scrollWidth, innerWidth, [...document.querySelectorAll('#fd-dcard *')].filter(e=>e.getBoundingClientRect().right>document.querySelector('#fd-dcard').getBoundingClientRect().right+1 && !e.closest('.lbpv')).length]")
        ok(w[0]<=w[1] and w[2]==0, f'телефон: ничего не вылезает {w}')
        await p2.screenshot(path='/tmp/labels-phone.png')
        await pg.screenshot(path='/tmp/labels-pc.png')
        ok(not e2, f'телефон: ошибок нет {e2[:3]}')
        await b.close()
    print('\nИТОГ:', 'всё хорошо' if not fails else f'{len(fails)} ошибок'); return 1 if fails else 0
import sys; sys.exit(asyncio.run(main()))
