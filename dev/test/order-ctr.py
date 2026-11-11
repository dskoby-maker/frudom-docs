"""Заявка: выбор договора. Договор задаёт поставщика, основание, список товаров (по «Товарам по договору» / истории / названию),
цены (прайс заказчика, нет — цена договора), остаток; товары с годом поставки — только своего года; документы сохраняются с этим договором."""
import asyncio, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SETUP="""(()=>{const D=__fd.D(); const s1=D.suppliers[0], s2=D.suppliers[1]||D.suppliers[0];
 const c={id:'zoo-t',name:'ГАУ «Московский зоопарк» тест',short:'Зоопарк',inn:'7710031380',address:'123242, г. Москва, ул. Большая Грузинская, д. 1',ship:'123242, г. Москва, ул. Большая Грузинская, д. 1, стр. 101'};
 if(!D.customers.some(x=>x.id===c.id)) D.customers.push(c);
 const P=[['zt-s26','Стружка древесная (поставка 2026 г.)','кг',128.45],['zt-s27','Стружка древесная (поставка 2027 г.)','кг',131.10],['zt-s28','Стружка древесная (поставка 2028 г.)','кг',131.29],
   ['zt-m','Молоко сухое коровье цельное','кг',1070.34],['zt-gs','Перчатки резиновые общего назначения, размер S','пар',61.91],['zt-gm','Перчатки резиновые общего назначения, размер M','пар',62.41],['zt-k','Рукавицы для защиты от внешних воздействий','пар',808.43]];
 D.prices['zoo-t']=D.prices['zoo-t']||{};
 P.forEach(([id,name,unit,pr])=>{ if(!D.products.some(x=>x.id===id)) D.products.push({id,name,unit,price:String(pr)}); if(id!=='zt-k') D.prices['zoo-t'][id]=String(pr); });
 D.contracts=D.contracts||[];
 const C=[{id:'zc-s',customerId:'zoo-t',supplierId:s1.id,basis:'Гражданско-правовой договор № 32615608427_ЗК260007(Ц)',maxSum:'2900000',dateTo:'2028-12-31',short:'Древесная шерсть'},
   {id:'zc-m',customerId:'zoo-t',supplierId:s2.id,basis:'Гражданско-правовой договор № 3215376073 от 01.12.2025',maxSum:'1000',dateTo:'2028-12-31',short:'Сухое молоко',spec:JSON.stringify([{name:'Молоко сухое коровье цельное',pid:'zt-m',unit:'кг',price:'1070.34',qty:'600'}])},
   {id:'zc-g',customerId:'zoo-t',supplierId:s2.id,basis:'Гражданско-правовой договор № 32514660839 от 20.05.2025',maxSum:'2990000',dateTo:'2027-12-20',short:'Перчатки'},
   {id:'zc-k',customerId:'zoo-t',supplierId:s2.id,basis:'Гражданско-правовой договор № 32515239228 от 20.10.2025',maxSum:'990000',dateTo:'2028-12-20',short:'Краги',spec:JSON.stringify([{name:'Рукавицы для защиты от внешних воздействий',pid:'zt-k',unit:'пар',price:'808.43',qty:'100'}])}];
 C.forEach(x=>{ if(!D.contracts.some(y=>y.id===x.id)) D.contracts.push(x); });
 const o=__fd.D().order||(D.order={qty:{},extra:[]}); o.customerId='zoo-t'; o.contractId=''; o.noCtr=false; o.supKeep=false; o.qty={}; o.date='2026-11-12';
 return [s1.id,s2.id]})()"""
async def pick(pg, v):
    await pg.evaluate(f"(s=>{{s.value='{v}';s.dispatchEvent(new Event('change',{{bubbles:true}}))}})(document.querySelector('#o-ctr'))"); await pg.wait_for_timeout(300)
async def rows(pg): return await pg.evaluate("[...document.querySelectorAll('#o-body tr[data-p]')].map(r=>r.dataset.p)")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            s1,s2=await pg.evaluate(SETUP)
            await pg.evaluate("(()=>{const p=__fd.D(); })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"order\"]').click()"); await pg.wait_for_timeout(600)
            await pg.evaluate("document.querySelector('#o-view button[data-v=\"v\"]').click()"); await pg.wait_for_timeout(300)
            ok(await pg.locator('#o-ctr option').count()==5, f'{W}: в выборе 4 договора + «Без договора»')
            await pick(pg,'zc-s')
            r=await rows(pg); ok(r==['zt-s26'], f'{W}: стружка — только 2026 г. (по названию договора и году): {r}')
            ok(await pg.evaluate("document.querySelector('#o-sup').value")==s1, f'{W}: поставщик по договору стружки')
            ok('Древесная' in await pg.inner_text('#o-ctrf') and 'другой год' in await pg.inner_text('#o-ctrf'), f'{W}: подпись «показаны товары договора»')
            await pg.fill('#o-date','2027-03-01'); await pg.dispatch_event('#o-date','input'); await pg.wait_for_timeout(300)
            r=await rows(pg); ok(r==['zt-s27'], f'{W}: дата 2027 → стружка 2027 г.: {r}')
            await pg.fill('#o-date','2026-11-12'); await pg.dispatch_event('#o-date','input'); await pg.wait_for_timeout(300)
            await pick(pg,'zc-m')
            r=await rows(pg); ok(r==['zt-m'], f'{W}: сухое молоко — по «Товарам по договору»: {r}')
            ok(await pg.evaluate("document.querySelector('#o-sup').value")==s2, f'{W}: поставщик сменился на поставщика договора')
            ok('3215376073' in await pg.evaluate("document.querySelector('#o-basis').value"), f'{W}: основание — договор молока')
            ok('осталось 600' in await pg.inner_text('#o-body'), f'{W}: «по договору осталось 600 кг»')
            await pg.fill('#o-body input.q[data-p="zt-m"]','2'); await pg.dispatch_event('#o-body input.q[data-p="zt-m"]','input'); await pg.wait_for_timeout(300)
            t=await pg.inner_text('#o-ctrinfo'); ok('Превышение' in t, f'{W}: превышение цены договора видно: {t[:90]}')
            await pick(pg,'zc-k')
            r=await rows(pg); ok(r==['zt-k'], f'{W}: краги — товар договора, хотя нет в прайсе: {r}')
            ok('808,43' in await pg.inner_text('#o-body'), f'{W}: цена краг из договора')
            await pick(pg,'zc-g')
            r=await rows(pg); ok(sorted(r)==['zt-gm','zt-gs'], f'{W}: перчатки — по названию: {r}')
            await pg.click('#o-allp'); await pg.wait_for_timeout(300)
            r=await rows(pg); ok(len(r)>=5 and r[:2]==['zt-gs','zt-gm'] or sorted(r[:2])==['zt-gm','zt-gs'], f'{W}: «Показать все» — договорные первыми, остальные ниже: {len(r)}')
            ok(await pg.locator('#o-body tr.oout').count()>=3, f'{W}: чужие товары помечены «не по этому договору»')
            await pg.click('#o-allp'); await pg.wait_for_timeout(200)
            if W==1300:
                await pg.fill('#o-body input.q[data-p="zt-gs"]','10'); await pg.dispatch_event('#o-body input.q[data-p="zt-gs"]','input'); await pg.wait_for_timeout(200)
                await pg.click('#o-save'); await pg.wait_for_timeout(1500)
                if 'Всё равно' in (await pg.inner_text('#o-save')+await pg.inner_text('#o-go')): await pg.click('#o-save'); await pg.wait_for_timeout(1500)
                j=await pg.evaluate("__fd.D().journal.filter(j=>j.customerId==='zoo-t').map(j=>[j.snap.dr.contractId,j.snap.dr.basis,j.supplierId])")
                ok(j and j[-1][0]=='zc-g' and '32514660839' in j[-1][1] and j[-1][2]==s2, f'{W}: накладная сохранена по договору перчаток: {j[-1:] }')
                pr=await pg.evaluate("(__fd.D().prefs||{})")
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
