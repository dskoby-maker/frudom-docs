"""«Озон» → «Выплаты на р/с»: из чего сложилась выплата, товар Тани (мамы) на FBO, закупка realFBS одной суммой, «Отдал Тане».
Чистый тестовый сервер, XLSXJS (npm pack xlsx@0.18.5). PH=1 — телефон."""
import asyncio, os, sys, tempfile, json, importlib.util
from playwright.async_api import async_playwright
spec=importlib.util.spec_from_file_location('oz', os.path.join(os.path.dirname(__file__),'ozon.py')); oz=importlib.util.module_from_spec(spec); spec.loader.exec_module(oz)
BASE=oz.BASE; fails=[]
def ok(c,m):
    print(('✓ ' if c else '✗ ')+m)
    if not c: fails.append(m)
num=lambda s: float(s.replace(' ','').replace('\xa0','').replace('₽','').replace('−','-').replace('≈','').replace(',','.'))
async def main():
    ph=os.environ.get('PH')=='1'; W=390 if ph else 1300
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ['XLSXJS']))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon'); localStorage.removeItem('frudom-oz-ui')}catch(e){}"); await pg.reload()
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("(()=>{const b=document.querySelector('nav.tabs button[data-tab=ozon]'); if(b) b.click(); else goTab('ozon');})()"); await pg.wait_for_timeout(800)
        f=tempfile.mktemp(suffix='.xlsx'); tot=oz.mk_xlsx(f)
        await pg.set_input_files('#oz-file', f); await pg.wait_for_timeout(1500)
        ch=await pg.eval_on_selector_all('#oz .ozspc b', 'L=>L.map(x=>x.textContent)')
        vals=[num(x) for x in ch]
        ok(len(vals)==3 and abs(sum(vals)-tot)<0.01, f'«Из чего сложилась»: FBO + realFBS + общие = {tot} ({ch})')
        ok(abs(vals[0]-458)<0.01 and abs(vals[1]-1746)<0.01 and abs(vals[2]+300)<0.01, 'FBO 458 · realFBS 1746 · общие −300')
        # одна схема — всё равно видно, почему не сходится
        await pg.click('#oz [data-ozsch="FBO"]'); await pg.wait_for_timeout(300)
        ok('Вы смотрите одну схему' in await pg.inner_text('#oz .ozsplit'), 'при FBO видна строка «весь магазин» и пояснение')
        await pg.click('#oz .ozsch [data-ozsch="all"]'); await pg.wait_for_timeout(300)
        # товар Тани
        await pg.click('#oz [data-oz="own"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#fd-dcard [data-ozowna="смесь"]').count()==1, 'окно «Товар Тани»: смесь продавалась с FBO')
        ok(await pg.locator('#fd-dcard [data-ozowna="курага"]').count()==0, 'realFBS-товара в списке нет')
        await pg.click('#fd-dcard [data-ozowna="смесь"] [data-ozown="t"]'); await pg.wait_for_timeout(500)
        inp=pg.locator('#fd-dcard input[data-ozc="смесь~t"]'); await inp.fill('400'); await inp.press('Tab'); await pg.wait_for_timeout(500)
        pr=await pg.evaluate("__oz.prefs()"); ok(pr.get('ozOwn',{}).get('смесь')=='t' and pr.get('ozTp',{}).get('смесь')==400, 'смесь — товар Тани, её цена 400 (в личных настройках)')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        ok('товар Тани' in await pg.inner_text('#oz .ozsplit'), 'в разбивке — «FBO · товар Тани»')
        ok(await pg.locator('#oz .ozr[data-ozp="смесь~t"] .ozt').count()==1, 'в таблице у смеси метка «Таня»')
        # выплаты
        await pg.click('#oz [data-ozv="pay"]'); await pg.wait_for_timeout(800)
        k=await pg.evaluate("(()=>{ const d=new Date(); const D1=d.toISOString().slice(0,8)+'01'; return __oz.pers(10).find(x=>x.a<=D1&&x.b>=D1).k; })()")
        card=pg.locator(f'#oz [data-ozpay="{k}"]'); ok(await card.count()==1, 'выплата за неделю с 1-м числом есть в списке')
        ok(num((await card.locator('.ozpy1 b').inner_text()))==round(tot), 'сумма выплаты = начислениям')
        ok('Тане' in await card.inner_text(), 'в строке выплаты — сколько Тане')
        await card.click(); await pg.wait_for_timeout(600)
        g=await pg.evaluate(f"(()=>{{const x=__oz.pay('{k}').X; return [x.ft,x.fm,x.rf,x.gen,x.tg];}})()")
        tg=g[3]*g[0]/(g[0]+g[1]+g[2]); ok(g[3]<0 and abs(g[4]-tg)<0.01, f'доля Тани в общих расходах = общие × её часть выплаты: {g}')
        tan=round(400+tg,2)
        tl=await pg.eval_on_selector_all('#fd-dcard .oztile b','L=>L.map(x=>x.textContent)')
        ok(num(tl[0])==tot and abs(num(tl[1])-tan)<0.01, f'в окне: выплата {tot}, Тане 400 − доля общих = {tan} ({tl[:2]})')
        ok('Доля общих расходов магазина' in await pg.inner_text('#fd-dcard .ozd'), 'в расчёте с Таней — строка «Доля общих расходов магазина»')
        rf=pg.locator('#fd-dcard #oz-rfz'); await rf.fill('500'); await rf.press('Tab'); await pg.wait_for_timeout(700)
        want=round(tot-tan-tot*0.08-500,2)
        tl=await pg.eval_on_selector_all('#fd-dcard .oztile b','L=>L.map(x=>x.textContent)')
        ok(abs(num(tl[3])-want)<0.01, f'вам чистыми = выплата − Тане − налог − закупка realFBS 500 = {want} ({tl[3]})')
        if ph:
            sw=await pg.evaluate("(()=>{const d=document.querySelector('#fd-dcard'), R=d.getBoundingClientRect().right; return [d.scrollWidth,d.clientWidth,[...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>R+1).map(e=>e.tagName+'.'+e.className).slice(0,5)]})()")
            ok(sw[0]<=sw[1]+2, f'окно выплаты без прокрутки вбок {sw}')
        await pg.click('#fd-dcard [data-ozpaid="on"]'); await pg.wait_for_timeout(600)
        ok('Отдал Тане' in await pg.inner_text('#fd-dcard .ozpaid'), '«Отдал Тане» отмечено')
        # провалиться в товар и вернуться
        await pg.click('#fd-dcard .ozd-c [data-ozp="смесь~t"]'); await pg.wait_for_timeout(500)
        ok('товар' in await pg.inner_text('#fd-dcard .dc-kicker'), 'из выплаты — в товар')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#fd-dcard [data-ozpaid]').count()>0, 'Esc — назад к выплате')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        ok('отдал' in await pg.inner_text(f'#oz [data-ozpay="{k}"]'), 'в списке выплат — «отдал ✓»')
        # режим «всё, что перечислил Озон»
        await pg.evaluate("(()=>{ const p=__oz.prefs(); })()")
        await pg.click('#oz [data-oz="own"]'); await pg.wait_for_timeout(400); await pg.click('#fd-dcard [data-oztm="net"]'); await pg.wait_for_timeout(400)
        x=await pg.evaluate(f"__oz.pay('{k}').tanya"); ok(abs(x-(458*0.92+tg))<0.01, f'режим «всё, что перечислил Озон, минус налог»: Тане {x}')
        await pg.click('#fd-dcard [data-oztg="me"]'); await pg.wait_for_timeout(400)
        x=await pg.evaluate(f"__oz.pay('{k}').tanya"); ok(abs(x-458*0.92)<0.01, f'«Все на мне» — Тане без доли общих: {x}')
        await pg.click('#fd-dcard [data-oztg="split"]'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate(f"document.documentElement.scrollWidth")==W, f'нет прокрутки вбок ({W})')
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
