"""Задачи на день на телефоне: карточка заказчика с длинной задачей и кнопкой «Накладные № …» не вылезает вправо, кнопка переносится на 2 строки."""
import asyncio, sys
from playwright.async_api import async_playwright
TXT="Отвезти комплект на МГУ, Комбинат питания МГУ: 6 накладных, общий вес 115 кг\\n• Столовая №1 (№ 89): Огурцы 5 кг, Помидоры (томаты) 20 кг\\n• Столовая №9 (№ 92): Огурцы 20 кг\\n• Столовая №11 (№ 93): Огурцы 15 кг, Помидоры (томаты) 15 кг"
SEED="""(()=>{const D=__fd.D(), t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
 const c1=D.customers[0].id, now=new Date().toISOString();
 const mk=(id,addr,text)=>({id,date:iso,customerId:c1,addr,text,by:'Наталья',created:now,photos:'',seen:'{}',drv:'Гриша'});
 D.daytasks=[mk('t1','ст 1','%s'),mk('t2','Юридический адрес очень длинный, г. Москва, ул. Ленинские горы, д. 1, стр. 52','Забрать возврат')];
 try{localStorage.removeItem('frudom-dtg')}catch(e){} })()"""%TXT
FAIL=[]
async def main():
    W=int(sys.argv[1]) if len(sys.argv)>1 else 390
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':W,'height':844})
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(SEED); await pg.evaluate("location.hash='#zhurnal'"); await pg.wait_for_timeout(300); await pg.evaluate("location.hash='#kalendar'"); await pg.wait_for_timeout(800)
        await pg.click('#dt-list .dtg-h'); await pg.wait_for_timeout(600)
        await pg.evaluate("""(()=>{const t=document.querySelector('#dt-list .dtg .dt .dt-t'); t.insertAdjacentHTML('afterend','<button class=\"dtsrc\"><svg viewBox=\"0 0 24 24\"></svg><span>Накладные № 89–94 · 6 шт. · 18 507,45 ₽</span><i>›</i></button>')})()"""); await pg.wait_for_timeout(300)
        bad=await pg.evaluate("""(()=>{const g=document.querySelector('#dt-list .dtg'), R=g.getBoundingClientRect().right; return [...g.querySelectorAll('.dt, .dt-b, .dt-a, .dtsrc, .dt-drvl')].filter(e=>e.getBoundingClientRect().right>R+0.5).length})()""")
        sw=await pg.evaluate('document.documentElement.scrollWidth')
        print(('OK  ' if bad==0 and sw<=W else 'FAIL'), W, 'вылезает вправо:', bad, 'ширина страницы', sw)
        if bad or sw>W: FAIL.append(W)
        await pg.evaluate("document.querySelector('#dt-list .dtg .dt').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'/tmp/claude-0/dtr-{W}.png')
        await b.close()
for W in (360,390,412):
    sys.argv=[0,str(W)]; asyncio.run(main())
print("ИТОГ:", "всё прошло" if not FAIL else f"провалов {len(FAIL)}")
