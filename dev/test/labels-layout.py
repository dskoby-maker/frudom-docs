"""Наклейки: настройки принтера (поворот на 90°, размер, сдвиг) и макет наклейки (строки, жирный, размер, центр, рамка, EAC). PH=1 — телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    cid=await pg.evaluate("(__fd.D().customers.find(c=>c.inn==='7736039722')||{}).id")
    await pg.evaluate("__fd.D().products.push({id:'p-or', name:'Апельсины свежие', code:'', unit:'кг', country:'792', price:'100'})")
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'lbl-l1', customerId:'{cid}', number:'', lines:[{{productId:'p-or',qty:'15',price:'100',qOk:'15',pOk:'100'}}]}}); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2000)
    await pg.evaluate("__lbl.open(['lbl-l1'])"); await pg.wait_for_timeout(700)
    ok(await pg.locator('#fd-dcard.lbwin .lbprn').count()==1, 'есть «Настройки принтера»')
    # печать как есть
    await pg.click('#fd-dcard [data-lbk="test"]'); await pg.wait_for_timeout(1200)
    css=await pg.evaluate("[...document.querySelectorAll('iframe')].pop().contentWindow.document.querySelector('style').textContent")
    ok('size:55.4mm 40mm' in css, 'по умолчанию — лист 55,4 × 40 мм')
    # поворот
    await pg.evaluate("document.querySelector('#fd-dcard .lbprn').open=true"); await pg.wait_for_timeout(200)
    await pg.click('#fd-dcard [data-lbk="pr:r"][data-r="90"]'); await pg.wait_for_timeout(400)
    ok(await pg.locator('#fd-dcard [data-r="90"][aria-pressed="true"]').count()==1, 'выбрано «Повернуть ↻»')
    ok(await pg.evaluate("document.querySelector('#fd-dcard .lbprn').open"), 'настройки остались открыты')
    await pg.click('#fd-dcard [data-lbk="pr:x+"]'); await pg.click('#fd-dcard [data-lbk="pr:y-"]'); await pg.wait_for_timeout(400)
    sm=await pg.inner_text('#fd-dcard .lbprn summary'); ok('повёрнуто' in sm and 'сдвиг' in sm, f'в заголовке видно настройки ({sm})')
    await pg.click('#fd-dcard [data-lbk="test"]'); await pg.wait_for_timeout(1200)
    d=await pg.evaluate("(()=>{const d=[...document.querySelectorAll('iframe')].pop().contentWindow.document, l=d.querySelector('.pg>.lb'), i=d.querySelector('.lbi'), r=l.getBoundingClientRect(), pg=d.querySelector('.pg').getBoundingClientRect(); return {css:d.querySelector('style').textContent, tr:getComputedStyle(l).transform, w:r.width, h:r.height, pw:pg.width, ph:pg.height, it:i.style.transform}})()")
    ok('size:40mm 55.4mm' in d['css'], 'с поворотом лист 40 × 55,4 мм')
    ok(abs(d['w']-d['pw'])<2 and abs(d['h']-d['ph'])<2 and d['ph']>d['pw'], f"наклейка повёрнута и ровно в листе {d['w']:.0f}×{d['h']:.0f} в {d['pw']:.0f}×{d['ph']:.0f}")
    ok('translate(0.5mm, -0.5mm)' in d['it'], f"сдвиг текста ({d['it']})")
    st=await pg.evaluate("JSON.parse(localStorage.getItem('frudom-lblprn'))"); ok(st['r']==90 and st['dx']==0.5, f'настройки запомнены на устройстве {st}')
    # размер
    await pg.fill('#fd-dcard #lb-pw','58'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(400)
    ok('58 × 40' in await pg.inner_text('#fd-dcard .lbsum'), 'размер 58 × 40 в подписи')
    await pg.click('#fd-dcard [data-lbk="pr:0"]'); await pg.click('#fd-dcard [data-lbk="pr:r"][data-r="0"]'); await pg.wait_for_timeout(300)
    # макет
    await pg.click('#fd-dcard [data-lbk="ed"]'); await pg.wait_for_timeout(400)
    n=await pg.locator('#fd-dcard .lbmk input[data-lmt]').count(); ok(n>=6, f'макет: строки наклейки ({n})')
    f=pg.locator('#fd-dcard [data-lmt="0"]'); await f.fill('Апельсины свежие (Турция)'); await pg.wait_for_timeout(200)
    ok('Апельсины свежие (Турция)' in await pg.inner_text('#fd-dcard .lbpv'), 'образец меняется сразу при наборе')
    ok(await pg.evaluate("document.activeElement && document.activeElement.dataset.lmt==='0'"), 'курсор остаётся в поле')
    await pg.click('#fd-dcard [data-lbm="c"]'); await pg.click('#fd-dcard [data-lbm="z+"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#fd-dcard .lbpv p.ce').count()==1, 'первая строка по центру')
    ok(await pg.evaluate("document.activeElement && document.activeElement.dataset.lmt==='0'"), 'после кнопки курсор в той же строке')
    await pg.locator('#fd-dcard .lbpv [data-pl="1"]').click(); await pg.wait_for_timeout(300)
    ok('Строка 2' in await pg.inner_text('#fd-dcard .lbtb'), 'нажатие на строку образца выбирает её')
    await pg.click('#fd-dcard [data-lbm="b"]'); await pg.wait_for_timeout(200)
    ok(await pg.locator('#fd-dcard [data-lbm="b"][aria-pressed="false"]').count()==1 and await pg.locator('#fd-dcard .lbpv [data-pl="1"].bo').count()==0, 'вторая строка не жирная')
    await pg.locator('#fd-dcard [data-lmt="2"]').focus(); await pg.wait_for_timeout(200)
    ok('Строка 3' in await pg.inner_text('#fd-dcard .lbtb') and await pg.locator('#fd-dcard [data-lbm="b"][aria-pressed="true"]').count()==1, 'переход в поле — панель показывает его оформление')
    n0=await pg.locator('#fd-dcard .lbmk input[data-lmt]').count(); last=n0-1
    await pg.locator(f'#fd-dcard [data-lmt="{last}"]').focus(); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
    await pg.keyboard.type('Дата производства {дата}')
    ok(await pg.locator('#fd-dcard .lbmk input[data-lmt]').count()==n0+1, 'Enter — новая строка')
    await pg.click('#fd-dcard [data-lbm="f"]'); await pg.click('#fd-dcard [data-lbm="up"]'); await pg.wait_for_timeout(300)
    await pg.click('#fd-dcard [data-lbm="eac"]'); await pg.wait_for_timeout(200)
    pv=await pg.inner_text('#fd-dcard .lbpv'); ok('{дата}' not in pv and 'Дата производства' in pv, f'{"{дата}"} подставлено')
    ok(await pg.locator('#fd-dcard .lbpv .eac').count()==0 and await pg.locator('#fd-dcard .lbpv p.fr').count()==1, 'знак EAC убран, строка в рамке')
    await pg.click('#fd-dcard [data-lbk="edsave"]'); await pg.wait_for_timeout(2500)
    pr=[r for r in rows('Товары') if r.get('ID (не менять)')=='p-or']; lb=json.loads((pr[0].get('Данные для наклейки (заполняется с сайта)') if pr else '') or '{}')
    ok(lb.get('x',[''])[0]=='Апельсины свежие (Турция)' and lb.get('xs',[{}])[0].get('c')==1 and lb.get('eac')==0, f'макет сохранён в «Товары» ({str(lb)[:160]})')
    ok(any('{партия}' in x for x in lb.get('x',[])), 'партия — по дате фасовки ({партия})')
    await pg.fill('#fd-dcard #lb-date','2026-11-25'); await pg.dispatch_event('#fd-dcard #lb-date','change'); await pg.wait_for_timeout(400)
    pv=await pg.inner_text('#fd-dcard .lbpv'); ok('25.11.2026' in pv and '251126' in pv, 'другая дата фасовки — дата и партия поменялись')
    await pg.click('#fd-dcard [data-lbk="print"]'); await pg.wait_for_timeout(1200)
    fit=await pg.evaluate("(()=>{const d=[...document.querySelectorAll('iframe')].pop().contentWindow.document; return [...d.querySelectorAll('.lbi')].map(b=>b.scrollHeight<=b.clientHeight+1)})()")
    ok(fit and all(fit), f'текст влезает в наклейку {fit}')
    await pg.screenshot(path=f'/tmp/lbl-{"ph" if PH else "pc"}.png')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
