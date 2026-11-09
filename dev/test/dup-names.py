"""Одинаковые на экране названия товаров: сайт сам подписывает отличие в скобках (лапша / макароны фигурные).
«Заявка» (оба вида таблицы), подсказки при вводе товара, строка документа. В документ (snap) название идёт как есть."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
REN="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SETUP="""(()=>{ const D=__fd.D(), c=D.customers[0], pl=D.prices[c.id]=D.prices[c.id]||{};
  const add=(id,name,al)=>{ if(!D.products.find(p=>p.id===id)) D.products.push({id,name,unit:'кг',code:'',country:'643',price:'104.18',aliases:JSON.stringify(al||[])}); pl[id]='104.18'; };
  add('m1','Изделия макаронные (лапша)',['Лапша']); add('m2','Изделия макаронные (макароны фигурные)',['Спирали']);
  add('t1','Томаты грунтовые',['Помидоры розовые']); add('t2','Томаты грунтовые',['Помидоры черри','Черри']);
  add('k1','Капуста провансаль',[]); add('k2','Капуста провансаль',[]);
  return c.id; })()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            cid=await pg.evaluate(SETUP)
            await pg.evaluate(f"(()=>{{ const D=__fd.D(); D.order=Object.assign(D.order||{{}},{{qty:{{}},extra:[],customerId:'{cid}'}}); }})()")
            await pg.evaluate(REN+"('order')"); await pg.wait_for_timeout(500)
            for view in ['h','v']:
                await pg.evaluate(f"document.querySelector('#o-view [data-v=\"{view}\"]').click()")
                await pg.wait_for_timeout(400)
                sel='#o-body .oprod b' if view=='v' else '#o-head th'
                names=[t.strip() for t in await pg.locator(sel).all_text_contents()]
                txt=' | '.join(names)
                ok('Изделия макаронные (лапша)' in txt and 'Изделия макаронные (макароны фигурные)' in txt, f'{W}/{view}: макароны подписаны из скобок названия')
                ok('Томаты грунтовые (помидоры розовые)' in txt and ('Томаты грунтовые (помидоры черри)' in txt or 'Томаты грунтовые (черри)' in txt), f'{W}/{view}: одинаковые названия — уточнение из заявок')
                ok(sum(1 for n in names if n.startswith('Капуста провансаль (')) ==2 and len({n for n in names if n.startswith('Капуста провансаль')})==2, f'{W}/{view}: без подсказок — всё равно различаются')
                ok(not any(n.startswith('Ягоды') and '(' in n for n in names), f'{W}/{view}: у уникальных названий скобок не добавилось')
            # подсказки и строка документа
            await pg.evaluate(f"(()=>{{ const D=__fd.D(); D.draft.customerId='{cid}'; D.draft.lines=[{{productId:'t1',qty:'1',price:'104.18'}}]; }})()")
            await pg.evaluate(REN+"('doc')"); await pg.wait_for_timeout(500)
            ok((await pg.text_content('#d-lines .line[data-i="0"] .pdcl-l') or '').strip()=='помидоры розовые', f'{W}: в строке документа — уточнение под названием')
            await pg.click('#d-lines .line[data-i="0"] input.ps'); await pg.fill('#d-lines .line[data-i="0"] input.ps','Томаты грунт'); await pg.wait_for_timeout(500)
            sug=' | '.join(await pg.locator('[data-psi]').all_text_contents())
            ok('помидоры розовые' in sug and 'черри' in sug, f'{W}: в подсказках два томата различаются: {sug[:120]}')
            await pg.keyboard.press('Escape')
            await pg.evaluate("(()=>{ const D=__fd.D(); D.draft.lines=[{productId:'t1',qty:'1',price:'104.18'}]; })()"); await pg.evaluate(REN+"('doc')")
            await pg.click('#d-save'); await pg.wait_for_timeout(1200)
            nm=await pg.evaluate("(()=>{ const j=__fd.D().journal.slice(-1)[0]; return j && j.snap && j.snap.lines && j.snap.lines[0] && (j.snap.lines[0].name||'') })()")
            ok('(' not in (nm or ''), f'{W}: в сохранённый документ уточнение не попало: «{nm}»')
            sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{W}: без прокрутки вбок {sw}')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}')
            await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
