"""Смена заказчика: товары и цены подтягиваются по контракту нового госзаказчика, расхождения подсвечиваются."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SETUP="""(()=>{const D=__fd.D(); const P=(id,name)=>{ if(!D.products.find(p=>p.id===id)) D.products.push({id,name,code:'',unit:'кг',country:'',price:'221.15'}); };
P('t1','Томаты (помидоры)'); P('t2','Огурцы'); P('t3','Томаты (помидоры) черри'); P('m1','Огурцы свежие'); P('m2','Помидоры (томаты) свежие'); P('m3','Помидоры черри свежие');
const C=(id,name)=>{ if(!D.customers.find(c=>c.id===id)) D.customers.push({id,name,inn:'',branches:'',points:''}); };
C('cirk','ГУП «Цирк тест»'); C('mgu','МГУ тест'); C('ooo','ООО «Частник тест»');
D.prices.cirk={t1:221.15,t2:218.25,t3:545}; D.prices.mgu={m1:155.67,m2:165.76,m3:326.34}; D.prices.ooo={t1:300};
D.draft.customerId='cirk'; D.draft.lines=[{productId:'t1',qty:'80',price:'221.15',src:'помидор'},{productId:'t2',qty:'60',price:'218.25',src:'огурцов'},{productId:'t3',qty:'5',price:'545',src:'Черри'}]; })()"""
REN="document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(SETUP); await pg.evaluate(REN); await pg.wait_for_timeout(400)
            ok(await pg.locator('#d-lines .line.offc').count()==0 and await pg.is_hidden('#d-ctrwarn'), f'{vw[0]}: у цирка всё по контракту — предупреждений нет')
            await pg.select_option('#d-cus','mgu'); await pg.wait_for_timeout(500)
            L=await pg.evaluate("__fd.D().draft.lines.map(l=>l.productId+'='+l.price)")
            ok(L==['m2=165.76','m1=155.67','m3=326.34'], f'{vw[0]}: заменено на позиции МГУ {L}')
            ok('Заменил на позиции контракта' in (await pg.text_content('#fd-toasts') or ''), f'{vw[0]}: всплыло сообщение о замене')
            ok(await pg.locator('#d-lines .line.offc').count()==0, f'{vw[0]}: после замены всё по контракту')
            # вручную меняем цену — предупреждение
            await pg.fill('#d-lines .line[data-i="0"] input.price','221.15'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#d-lines .line.offc').count()==1 and not await pg.is_hidden('#d-ctrwarn'), f'{vw[0]}: цена не по контракту подсвечена')
            t=await pg.text_content('#d-lines .line[data-i="0"] .ctrnote'); ok('165,76' in t, f'{vw[0]}: подпись с ценой контракта: {t}')
            ok(await pg.evaluate("document.activeElement.matches('#d-lines .line[data-i=\"0\"] input.price')"), f'{vw[0]}: фокус в поле цены не сбит')
            await pg.screenshot(path=f'/tmp/ctr-{vw[0]}.png', full_page=True)
            await pg.click('[data-ctrfixall]'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("__fd.D().draft.lines[0].price")=='165.76' and await pg.locator('#d-lines .line.offc').count()==0, f'{vw[0]}: кнопка поставила цену контракта')
            # товара нет в контракте
            await pg.evaluate("(()=>{const D=__fd.D(); D.products.push({id:'zz',name:'Ананас тест',unit:'кг',price:'99'}); D.draft.lines.push({productId:'zz',qty:'1',price:'99'}); })()"); await pg.evaluate(REN); await pg.wait_for_timeout(300)
            ok('нет в контракте' in await pg.text_content('#d-lines .line[data-i="3"] .ctrnote'), f'{vw[0]}: товар не из контракта отмечен')
            # не тот товар: «Сельдерей (корень)» (лишняя цена 382,50 в прайсе) вместо «…(корнеплод обрезной)» 254,30
            await pg.evaluate("""(()=>{const D=__fd.D(); D.products.push({id:'s1',name:'Сельдерей свежий (корнеплод обрезной)',unit:'кг',price:'254.3'},{id:'s2',name:'Сельдерей (корень)',unit:'кг',price:'382.5'},{id:'s3',name:'Сельдерей свежий черешковый',unit:'кг',price:'204.15'});
              D.prices.cirk={s1:'254.30',s2:'382.5',s3:'204.15'}; D.draft.customerId='cirk'; D.draft.lines=[{productId:'s2',qty:'4',price:'254.3',src:'20.Сельдерей корень'},{productId:'s3',qty:'1.5',price:'204.15'}]; })()"""); await pg.evaluate(REN); await pg.wait_for_timeout(400)
            t=await pg.text_content('#d-lines .line[data-i="0"] .ctrnote') or ''
            ok('не тот товар' in t and 'корнеплод обрезной' in t, f'{vw[0]}: подсказка «не тот товар»: {t[:90]}')
            ok('не тот товар' in (await pg.text_content('#d-ctrwarn') or ''), f'{vw[0]}: в общем блоке тоже')
            await pg.screenshot(path=f'/tmp/ctr-alt-{vw[0]}.png', full_page=False)
            await pg.click('#d-lines .line[data-i="0"] [data-ctrswap]'); await pg.wait_for_timeout(300)
            L=await pg.evaluate("__fd.D().draft.lines.map(l=>l.productId+'='+l.price)")
            ok(L[0]=='s1=254.30' and await pg.locator('#d-lines .line.offc').count()==0, f'{vw[0]}: товар заменён, цена прежняя {L}')
            # общая кнопка тоже меняет товар
            await pg.evaluate("__fd.D().draft.lines[0].productId='s2'"); await pg.evaluate(REN); await pg.wait_for_timeout(300)
            await pg.click('[data-ctrfixall]'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("__fd.D().draft.lines[0].productId")=='s1', f'{vw[0]}: «Исправить по контракту» заменило товар')
            # частник — без проверки
            await pg.select_option('#d-cus','ooo'); await pg.wait_for_timeout(400)
            ok(await pg.locator('#d-lines .line.offc').count()==0 and await pg.is_hidden('#d-ctrwarn'), f'{vw[0]}: у ООО предупреждений нет')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
