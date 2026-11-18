"""«Расходы и доходы»: правая кнопка (перенос личные↔бизнес, категория, удаление, переименование), окна по строкам итога
(записи: поиск, выбор, перенос, удаление, добавление; накладные), период календарём; ПК и телефон (PH=1)."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
REC="(id=>{const x=__fd.D().pother.find(y=>y.id===id); return x?{kind:x.kind,cat:x.cat||'',note:x.note}:null})"
async def add(pg, kind, s, note, cat=None):
    await pg.click(f'#pv-fin [data-pva="{kind}"]'); await pg.wait_for_timeout(450)
    await pg.fill('#pvi-sum', s); await pg.fill('#pvi-note', note)
    if cat: await pg.click(f'#pvi-cats [data-pvcat="{cat}"]')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
async def ctx(pg, sel):
    await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())")
    el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150); b=await el.bounding_box()
    await pg.mouse.click(b['x']+30, b['y']+b['height']/2, button='right'); await pg.wait_for_timeout(350)
async def item(pg, txt): await pg.locator('#fd-app .jcx .jcx-i', has_text=txt).first.click(); await pg.wait_for_timeout(500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctxb=await b.new_context(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}, has_touch=PH)
        pg=await ctxb.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); T='тел' if PH else 'ПК'
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500); await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
        await add(pg,'per','300','Йота'); await add(pg,'exp','5000','Аренда офиса'); await add(pg,'exp','800','Бензин','c-fuel'); await add(pg,'inc','1200','Проценты')
        ids=await pg.evaluate("Object.fromEntries(__fd.D().pother.map(x=>[x.note,x.id]))")
        await pg.evaluate("document.querySelectorAll('#pv-fin .pvfold:not(.open) [data-pvfold]').forEach(b=>b.click())"); await pg.wait_for_timeout(400)
        if not PH:
            # 1. ПКМ по группе «Йота» в личных → в расходы бизнеса
            await ctx(pg, '#pv-fin .pvcb[data-pvf="per:йота"]'); ok(await pg.locator("#fd-app .jcx").count()==1, f"{T}: меню у «Йота»")
            await item(pg,'Перенести в расходы бизнеса'); r=await pg.evaluate(REC+f"('{ids['Йота']}')"); ok(r['kind']=='Расход', f'{T}: «Йота» стала расходом {r}')
            await pg.locator('#fd-toasts .fd-toast', has_text='Перенесено').locator('button', has_text='Отменить').first.click(); await pg.wait_for_timeout(400)
            r=await pg.evaluate(REC+f"('{ids['Йота']}')"); ok(r['kind']=='Личное', f'{T}: «Отменить» вернул в личные')
            # 2. ПКМ по записи → категория чипом
            await ctx(pg, f'#pv-fin [data-pvx="{ids["Аренда офиса"]}"]'); chips=await pg.locator('#fd-app .jcx .jcx-ch').count(); ok(chips>2, f'{T}: в меню записи — категории чипами ({chips})')
            await pg.locator('#fd-app .jcx .jcx-ch', has_text='Аренда').first.click(); await pg.wait_for_timeout(400)
            r=await pg.evaluate(REC+f"('{ids['Аренда офиса']}')"); ok(r['cat']!='', f'{T}: категория у записи поставлена {r}')
            # 3. переименовать группу личных
            await ctx(pg, '#pv-fin .pvcb[data-pvf="per:йота"]'); await item(pg,'Переименовать'); await pg.fill('#pvrn-in','Мобильная связь'); await pg.click('#pvrn-go'); await pg.wait_for_timeout(500)
            r=await pg.evaluate(REC+f"('{ids['Йота']}')"); ok(r['note']=='Мобильная связь', f'{T}: переименовано {r}')
            # 4. ПКМ по строке итога
            await ctx(pg, '#pv-fin .pvfr[data-pvflow="exp"]'); ok(await pg.locator('#fd-app .jcx .jcx-i', has_text='Открыть подробно').count()==1, f'{T}: меню у «Расходы»'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        # 5. окно «Расходы»
        await pg.locator('#pv-fin .pvfr[data-pvflow="exp"]').click(); await pg.wait_for_timeout(700)
        ok(await pg.locator('#fd-dcard[open] #pvfw').count()==1, f'{T}: открылось окно «Расходы бизнеса»')
        n=await pg.locator('#pvfw [data-pvwx]').count(); ok(n>=2, f'{T}: в окне записи ({n})')
        await pg.fill('#pvw-q','бенз'); await pg.wait_for_timeout(400); ok(await pg.locator('#pvfw .pvwr').count()==1, f'{T}: поиск «бенз» — одна запись')
        await pg.fill('#pvw-q',''); await pg.wait_for_timeout(300)
        await pg.locator(f'#pvfw [data-pvwck="{ids["Бензин"]}"]').click(); await pg.wait_for_timeout(300)
        ok(await pg.locator('#pvfw .pvwbulk').count()==1, f'{T}: выбрано — панель действий')
        await pg.locator('#pvfw [data-pvwmv="per"]').click(); await pg.wait_for_timeout(500)
        r=await pg.evaluate(REC+f"('{ids['Бензин']}')"); ok(r['kind']=='Личное', f'{T}: из окна перенесено в личные')
        ok(await pg.locator(f'#pvfw [data-pvwx="{ids["Бензин"]}"]').count()==0, f'{T}: и ушло из окна расходов')
        # добавить из окна, вернуться в окно
        await pg.locator('#pvfw [data-pvwadd]').click(); await pg.wait_for_timeout(500); await pg.fill('#pvi-sum','150'); await pg.fill('#pvi-note','Канцелярия'); await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#fd-dcard[open] #pvfw').count()==1 and await pg.locator('#pvfw .pvwr', has_text='Канцелярия').count()==1, f'{T}: добавили из окна — вернулись в окно, запись видна')
        # удалить в два нажатия
        cid=await pg.evaluate("__fd.D().pother.find(x=>x.note==='Канцелярия').id")
        btn=pg.locator(f'#pvfw [data-pvwdel="{cid}"]'); await btn.click(); await btn.click(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(f"!__fd.D().pother.some(x=>x.id==='{cid}')"), f'{T}: удалено в два нажатия')
        sw=await pg.evaluate("[...document.querySelectorAll('#fd-dcard *')].filter(e=>!e.closest('[id*=toast],.fd-toast')&&!e.querySelector('.fd-toast')&&e.getBoundingClientRect().right>document.querySelector('#fd-dcard').getBoundingClientRect().right+1).map(e=>e.className+'/'+e.tagName).slice(0,6)"); ok(not sw, f'{T}: в окне ничего не вылезает ({sw})')
        await pg.screenshot(path=f'/tmp/pvfw-{T}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        # 6. окно накладных
        await pg.locator('#pv-fin .pvfr[data-pvflow="doc"]').click(); await pg.wait_for_timeout(700)
        ok(await pg.locator('#fd-dcard[open] #pvfw.k-doc').count()==1, f'{T}: окно «Прибыль с накладных»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        # 7. период календарём
        await pg.locator('#pv-fin [data-rpg="pvfin"]').click(); await pg.wait_for_timeout(400)
        ok(await pg.locator('[data-rgp]').count()>3, f'{T}: окно выбора периода')
        await pg.get_by_role('button', name='Год', exact=True).first.click(); await pg.wait_for_timeout(600)
        lab=await pg.text_content('#pv-fin [data-rpg="pvfin"]'); ok('год' in lab.lower(), f'{T}: период — год ({lab.strip()})')
        ok(await pg.locator('#pv-fin .pvit, #pv-fin .pvfold').count()>0, f'{T}: записи за год видны')
        sw=await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"); ok(sw, f'{T}: нет прокрутки вбок')
        await pg.screenshot(path=f'/tmp/pvfin-{T}.png')
        ok(not errs, f'{T}: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else fails)
asyncio.run(main())
