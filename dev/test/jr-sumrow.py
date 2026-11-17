"""Журнал на телефоне: строка «Найдено…» — кнопки «Комментарии», «Важные», «Сегодня», «Обновить» и «Сбросить» не налезают друг на друга."""
import asyncio, sys
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
JS_MARK="""()=>{const D=__fd.D();const js=D.journal.filter(j=>!j.snap?.meta?.arch);
 js.forEach((j,i)=>{if(i%3)return;j.snap.meta=j.snap.meta||{};j.snap.meta.cm={t:'тест '+i,by:'Даниил',at:new Date().toISOString(),imp:i%2?0:1};});
 const q=document.querySelector('#jr-q');q.value='';q.dispatchEvent(new Event('input'));}"""
JS_OVL="""()=>{const r=document.querySelector('.jf:has(#jr-q)+.jsum');const els=[...r.querySelectorAll('#jr-sum,#jr-reset,.btn')].filter(e=>e.offsetParent&&getComputedStyle(e).display!='none');
 const bx=els.map(e=>[e.id||e.className,e.getBoundingClientRect()]);const bad=[];
 for(let i=0;i<bx.length;i++)for(let k=i+1;k<bx.length;k++){const a=bx[i][1],b=bx[k][1];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)bad.push(bx[i][0]+' × '+bx[k][0]);}
 const clip=els.filter(e=>e.classList.contains('btn')).flatMap(e=>[...e.children].filter(c=>c.offsetParent&&c.getBoundingClientRect().right>e.getBoundingClientRect().right+1).map(c=>e.id));
 const out=els.filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>e.id);
 const tops=new Set(els.filter(e=>e.classList.contains('btn')&&e.id!='jr-reset').map(e=>Math.round(e.getBoundingClientRect().top)));
 return {bad,clip,out,n:els.length,rows:tops.size};}"""
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def mkdocs(pg, n):
    for _ in range(n):
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'},{productId:'',qty:'',price:''}]; })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await pg.click('#d-new'); await pg.click('#d-new'); await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W in (360,390,412):
            pg=await b.new_page(viewport={'width':W,'height':820}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            if W==360: await mkdocs(pg, 4)
            await pg.evaluate("localStorage.removeItem('frudom-jfopen'); location.hash='#zhurnal'"); await pg.wait_for_timeout(900)
            await pg.evaluate(JS_MARK); await pg.wait_for_timeout(400)
            await pg.click('#jr-more'); await pg.select_option('#jr-sup', value=await pg.evaluate('__fd.D().journal[0].supplierId||__fd.D().journal[0].snap.s.id')); await pg.click('#jr-more'); await pg.wait_for_timeout(400)
            for v in ('#jr-cm','#jr-imp','#jr-today','#jr-refresh','#jr-reset'): ok(await pg.is_visible(v), f'{W}: видно {v}')
            r=await pg.evaluate(JS_OVL)
            ok(not r['bad'], f'{W}: ничего не налезает {r["bad"]}'); ok(not r['clip'], f'{W}: текст не вылезает из кнопок {r["clip"]}'); ok(not r['out'], f'{W}: не за краем {r["out"]}')
            ok(r['rows']==1, f'{W}: кнопки в один ряд ({r["rows"]})')
            ok(await pg.evaluate('document.documentElement.scrollWidth')<=W, f'{W}: без прокрутки вбок')
            await pg.locator('.jf:has(#jr-q)+.jsum').screenshot(path=f'/tmp/claude-0/jsum-{W}.png')
            await pg.click('#jr-imp'); await pg.wait_for_timeout(300)
            r=await pg.evaluate(JS_OVL); ok(not r['bad'] and not r['clip'], f'{W}: с нажатым «Важные» тоже ровно')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}'); sys.exit(1 if fails else 0)
asyncio.run(main())
