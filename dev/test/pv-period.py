"""«По заказчикам»: выбор периода календарём (15.11.2026) и прибыль с 1-го числа у каждой накладной в окне заказчика.
Сервер: node test/server.js (на чистом сервере). Телефон — PH=1."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    ym=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'pp-a', name:'Гречка', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['pp-a']='100'; const t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0');})()")
    # три накладные: 1-го (2 шт), 3-го — по 500, 300, 200 ₽ выручки
    for i,(dt,q) in enumerate([(ym+'-01','5'),(ym+'-01','3'),(ym+'-03','2')]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'ppd{i}', customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'pp-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1800)
    await pg.click('#pv-seg [data-pv="cus"]'); await pg.wait_for_timeout(600)
    # --- окно заказчика: прибыль с 1-го
    await pg.evaluate("()=>document.querySelector('#pv-cus [data-pvc=\"'+window.__cid+'\"]').click()"); await pg.wait_for_timeout(900)
    cum=await pg.evaluate("[...document.querySelectorAll('#fd-dcard .pvm.op .pvr')].map(r=>[r.querySelector('.pvp>span').textContent, (r.querySelector('.pvcum')||{}).textContent||'', r.querySelector('.pvcum.de')?1:0])")
    tot=await pg.evaluate("document.querySelector('#fd-dcard .pvm.op .pvmh strong').textContent")
    num=lambda t: float(t.split('·')[-1].replace('₽','').replace(' ','').replace(' ','').replace(',','.'))
    ok(len(cum)==3 and all(c[1] for c in cum), f'{tag}: у каждой накладной есть «с 1.ММ · …» {cum}')
    if len(cum)==3:
        p=[num(c[0]) for c in cum]; c=[num(x[1]) for x in cum]
        ok(abs(c[2]-p[2])<0.01 and abs(c[1]-(p[2]+p[1]))<0.01 and abs(c[0]-sum(p))<0.01, f'{tag}: нарастающий итог по порядку {c} из {p}')
        ok(abs(c[0]-num(tot))<0.01, f'{tag}: верхняя = итог месяца ({tot})')
        ok([x[2] for x in cum]==[1,1,0], f'{tag}: итог дня отмечен у последней накладной дня')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    # --- период
    lab=await pg.text_content('#pv-cus .pvrpb'); ok('Период' in lab, f'{tag}: кнопка «Период» ({lab.strip()})')
    await pg.click('#pv-cus .pvrpb'); await pg.wait_for_timeout(400)
    vis=await pg.evaluate("(()=>{const p=document.querySelector('#pv-cus .pvrp'); const r=p.getBoundingClientRect(); return [p.classList.contains('on'), getComputedStyle(p).opacity, r.left>=0 && r.right<=innerWidth+1, document.querySelectorAll('#pv-cus .pvrm').length]})()")
    ok(vis[0] and float(vis[1])>0.9 and vis[2], f'{tag}: календарь открылся и в экране {vis}')
    ok(vis[3]==(1 if tag=='ph' else 2), f'{tag}: месяцев в календаре {vis[3]}')
    # выбрать 1-е — 2-е текущего месяца
    m=pg.locator(f'#pv-cus [data-pvd="{ym}-01"]')
    if not await m.count(): await pg.click('#pv-cus [data-pvrpm="1"]'); await pg.wait_for_timeout(350)
    await pg.click(f'#pv-cus [data-pvd="{ym}-01"]'); await pg.wait_for_timeout(150)
    ok(await pg.locator('#pv-cus .pvrd.pk').count()==1, f'{tag}: первый день отмечен')
    await pg.click(f'#pv-cus [data-pvd="{ym}-02"]'); await pg.wait_for_timeout(600)
    lab=await pg.text_content('#pv-cus .pvrpb b'); ok(lab.startswith('1–2 '), f'{tag}: подпись периода «{lab}»')
    ok(await pg.evaluate("!document.querySelector('#pv-cus .pvrp.on')"), f'{tag}: календарь закрылся')
    txt=await pg.text_content('#pv-cus .pvkpi'); ok('2 накладные' in txt, f'{tag}: за 1–2 число — 2 накладные')
    # стрелка вперёд — следующие 2 дня (3–4)
    await pg.click('#pv-cus [data-pvrp="1"]'); await pg.wait_for_timeout(500)
    lab=await pg.text_content('#pv-cus .pvrpb b'); txt=await pg.text_content('#pv-cus .pvkpi')
    ok(lab.startswith('3–4 ') and '1 накладная' in txt, f'{tag}: стрелка сдвигает период ({lab})')
    # готовый вариант «Текущий месяц» — обычный месяц
    await pg.click('#pv-cus .pvrpb'); await pg.wait_for_timeout(300); await pg.click('#pv-cus [data-pvrpp]:has-text("Текущий месяц")'); await pg.wait_for_timeout(600)
    cr=await pg.evaluate("__fd.D().pfv.cr"); txt=await pg.text_content('#pv-cus .pvkpi')
    ok(not cr and '3 накладные' in txt, f'{tag}: «Текущий месяц» — снова месяц, 3 накладные')
    # Esc и нажатие мимо закрывают
    await pg.click('#pv-cus .pvrpb'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("!document.querySelector('#pv-cus .pvrp.on')"), f'{tag}: Esc закрывает')
    await pg.click('#pv-cus .pvrpb'); await pg.wait_for_timeout(300); await pg.mouse.click(5, vw[1]//2); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("!document.querySelector('#pv-cus .pvrp.on')"), f'{tag}: нажатие мимо закрывает')
    # «Год» → окно заказчика раскрывает месяцы периода, «Всё время»
    await pg.click('#pv-cus .pvrpb'); await pg.wait_for_timeout(300); await pg.click('#pv-cus [data-pvrpp]:text-is("Год")'); await pg.wait_for_timeout(600)
    lab=await pg.text_content('#pv-cus .pvrpb b'); ok('год' in lab, f'{tag}: «Год» ({lab})')
    await pg.click('#pv-cus .pvrpb'); await pg.wait_for_timeout(300); await pg.click('#pv-cus [data-pvrpp]:has-text("Всё время")'); await pg.wait_for_timeout(600)
    lab=await pg.text_content('#pv-cus .pvrpb b'); ok('Всё время' in lab, f'{tag}: «Всё время» ({lab})')
    # «Расходы и доходы» не сломались
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500); ok('Всё время' in (await pg.text_content('#pv-fin [data-rpg="pvfin"]')), f'{tag}: «Расходы и доходы» — тот же период (Всё время)')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
