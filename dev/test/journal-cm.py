"""Журнал (16.11.2026): кнопка «С комментарием · N» — только документы с комментарием, вместе с «Важные»;
поля фильтров одной высоты и на одной линии; календарь периода — ровно под полем «Период»; телефон без прокрутки вбок."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SEED="""(()=>{const D=__fd.D(), now=new Date().toISOString(); const js=D.journal.filter(j=>!j.archived).slice(0,4);
  js.forEach(j=>{ j.snap.meta=j.snap.meta||{}; delete j.snap.meta.cm; });
  js[0].snap.meta.cm={t:'Позвонить перед доставкой',by:'Наталья',at:now}; js[1].snap.meta.cm={t:'Срочно',by:'Даниил',at:now,imp:1};
  return js.slice(0,2).map(j=>j.id); })()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in [(1555,1000),(1300,900),(390,844)]:
            ph=W<500; pg=await b.new_page(viewport={'width':W,'height':H}, is_mobile=ph, has_touch=ph); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            for i in range(4):
                if await pg.evaluate("__fd.D().journal.filter(j=>!j.archived).length")>=4: break
                await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'}]; D.draft.number=''; })()")
                await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200); await pg.click('#d-new'); await pg.wait_for_timeout(300)
            ids=await pg.evaluate(SEED); await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(700)
            await pg.evaluate("(()=>{const f=__fd.D().jf||{}; f.cm=false; f.imp=false;})()"); await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
            ok(await pg.is_visible('#jr-cm'), f'{W}: кнопка «С комментарием» видна')
            n=await pg.text_content('#jr-cmn'); ok(n=='2', f'{W}: счётчик {n}')
            all_n=await pg.locator('#jr-body tr[data-id], #jr-body tr.grp').count()
            await pg.click('#jr-cm'); await pg.wait_for_timeout(600)
            shown=await pg.evaluate("[...document.querySelectorAll('#jr-body [data-card]')].map(x=>x.dataset.card)")
            ok(set(shown)>=set(ids) and len(set(shown))==2, f'{W}: только с комментарием {len(set(shown))}')
            ok(await pg.get_attribute('#jr-cm','aria-pressed')=='true', f'{W}: кнопка нажата')
            await pg.click('#jr-imp'); await pg.wait_for_timeout(500)
            shown=await pg.evaluate("[...new Set([...document.querySelectorAll('#jr-body [data-card]')].map(x=>x.dataset.card))]")
            ok(shown==[ids[1]], f'{W}: вместе с «Важные» — один {shown}')
            await pg.click('#jr-reset'); await pg.wait_for_timeout(500)
            ok(await pg.get_attribute('#jr-cm','aria-pressed')=='false', f'{W}: «Сбросить фильтры» снимает')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            if not ph:
                m=await pg.evaluate("""(()=>{const g=document.querySelector('#tab-journal .jf'); const R=[];
                  g.querySelectorAll(':scope>label.f, :scope>.rpgf').forEach(l=>{ if(l.hidden||!l.offsetParent) return; const c=l.querySelector('.rpgw')||l.querySelector('.cpkw')||l.querySelector('select,input'); const q=c.getBoundingClientRect(); if(q.height) R.push([Math.round(q.top),Math.round(q.height)]); });
                  return R; })()""")
                rows={}; [rows.setdefault(t//60,[]).append((t,h)) for t,h in m]
                okk=all(len({t for t,h in r})==1 and {h for t,h in r}=={42} for r in rows.values())
                ok(okk, f'{W}: поля одной высоты 42 и на одной линии {m}')
                await pg.locator('#tab-journal .rpgw .pvrpb').first.click(); await pg.wait_for_timeout(500)
                d=await pg.evaluate("(()=>{const w=document.querySelector('#tab-journal .rpgw').getBoundingClientRect(), p=document.querySelector('.pvrp.rgp').getBoundingClientRect(); return [Math.round(p.left-w.left), Math.round(p.top-w.bottom)]; })()")
                ok(abs(d[0])<=1 and abs(d[1]-6)<=1, f'{W}: календарь ровно под полем {d}')
                await pg.screenshot(path=f'/tmp/claude-0/jcm-{W}.png'); await pg.keyboard.press('Escape')
            else:
                await pg.evaluate("document.querySelector('#jr-sum').scrollIntoView({block:'center'})"); await pg.screenshot(path=f'/tmp/claude-0/jcm-{W}.png')
            ok(not errs, f'{W}: без ошибок {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
