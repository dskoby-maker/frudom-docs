"""Прайс поставщика: категории товаров — по разделу прайса и названию, остальное ИИ (заглушка AI_FAKE), новые категории, выбор вручную;
«Товары» → «Разложить по категориям» → «Подобрать ИИ». Сервер: AI_FAKE=/tmp/claude-0/vpc-ai.json PORT=8787 node test/server.js (на чистом сервере)."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
B='http://localhost:8787'; PH=os.environ.get('PH')=='1'
def srv(js): return urllib.request.urlopen(urllib.request.Request(B+'/eval', data=js.encode(), method='POST')).read().decode()
FK='/tmp/claude-0/vpc-ai.json'
F='/tmp/claude-0/price2.txt'; open(F,'w').write('прайс\n')
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
    json.dump({"supplier":"ООО Вкусторг","date":"18.11.2026","items":[["Морковь мытая","кг",40,"Овощи свежие"],["Аджика Пан Консервыч 200г","шт",65,"Консервация"],["Огурцы маринованные 680г","шт",80,"Овощи консервированные"],["Кетчуп Хайнц 350г","шт",120,"Соусы"],["Вода Святой источник 0,5л","шт",30,""]],
               "c":[[1,"Соусы и приправы"],[2,"Бакалея"]]}, open(FK,'w'), ensure_ascii=False)
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        for _ in range(3):   # на чистом сервере категорий ещё нет — «Товары» их создают
            if await pg.evaluate("(__fd.D().cats||[]).length"): break
            await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"products\"]').click()"); await pg.wait_for_timeout(2500); await pg.reload(); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"suppliers\"]').click()"); await pg.wait_for_selector('#vp-card:not([hidden]) .vph', timeout=8000); await pg.wait_for_timeout(800)
        print('   категории сайта:', await pg.evaluate("(__fd.D().cats||[]).map(c=>c.name).join(', ')"), '| srvVer', await pg.evaluate("__fd.D().srvVer"))
        await pg.set_input_files('#vp-file', F); await pg.wait_for_selector('#vp-card .vpuph', timeout=20000); await pg.wait_for_timeout(300)
        sc=await pg.evaluate("""(()=>{ const D=__fd.D(); return [...document.querySelectorAll('#vp-card .vpu')].map(r=>{ const s=r.querySelector('select.vpcs'); return r.querySelector('.vprn b').textContent+' → '+(s?s.options[s.selectedIndex].text:'—'); }); })()""")
        print('   ', sc)
        ok(any(x.startswith('Морковь') and x.endswith('Овощи') for x in sc), 'морковь — «Овощи» по разделу')
        ok(any(x.startswith('Аджика') and 'Соленья' in x for x in sc), 'аджика — «Соленья и консервы» (раздел «Консервация»)')
        ok(any(x.startswith('Огурцы') and 'Соленья' in x for x in sc), 'огурцы маринованные — соленья, не овощи')
        ok(any(x.startswith('Кетчуп') and 'Соусы и приправы (новая)' in x for x in sc), 'кетчуп — новая категория от ИИ')
        ok(any(x.startswith('Вода') and x.endswith('Бакалея') for x in sc), 'вода — «Бакалея» от ИИ')
        ok(await pg.locator('#vp-card .vpcai').count()==2, 'пометка «ИИ» у двух позиций')
        t=await pg.inner_text('#vp-card .vpcats'); ok('Соусы и приправы' in t and 'новая' in t, 'в итогах категорий есть новая')
        # фильтр по категории
        await pg.locator('#vp-card .vpcatc .catc', has_text='Соленья').click(); await pg.wait_for_timeout(200)
        ok(await pg.locator('#vp-card .vpu').count()==2, 'нажатие на категорию — только её позиции')
        await pg.click('#vp-card [data-vpf="all"]'); await pg.wait_for_timeout(200)
        # вручную: воде — «Без категории»
        vi=await pg.evaluate("[...document.querySelectorAll('#vp-card .vpu')].findIndex(r=>r.textContent.includes('Вода'))")
        await pg.locator('#vp-card .vpu select.vpcs').nth(vi).select_option(''); await pg.wait_for_timeout(200)
        ok('Без категории' in await pg.inner_text('#vp-card .vpcats') and await pg.locator('#vp-card [data-vp="catai"]').count()==1, 'сняли категорию — «Без категории» и кнопка «Подобрать ИИ»')
        ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'нет прокрутки вбок')
        await pg.screenshot(path='/tmp/vpc.png', full_page=False)
        await pg.click('#vp-card [data-vp="save"]'); await pg.wait_for_timeout(2500)
        r=await pg.evaluate("""(()=>{ const D=__fd.D(), c=id=>((D.cats||[]).find(x=>x.id===id)||{}).name||''; return Object.fromEntries(D.products.filter(p=>/Морковь мытая|Аджика Пан|Огурцы маринованные 680|Кетчуп Хайнц|Вода Святой/.test(p.name)).map(p=>[p.name, c(p.cat)])); })()""")
        print('   ', r)
        ok(r.get('Морковь мытая')=='Овощи' and r.get('Кетчуп Хайнц 350г')=='Соусы и приправы' and 'Соленья' in r.get('Аджика Пан Консервыч 200г',''), 'товары сохранены с категориями, новая категория создана')
        ok(r.get('Вода Святой источник 0,5л','x')=='', 'снятая вручную — без категории')
        await pg.wait_for_timeout(1500)
        d=json.loads(urllib.request.urlopen(B+'/dump').read().decode()); cats=[x[0] for x in d.get('Категории товаров',[[]])[1:]]
        ok('Соусы и приправы' in cats, 'новая категория в таблице')
        # «Товары» → «Разложить по категориям» → «Подобрать ИИ»
        json.dump({"c":[[1,"Бакалея"]]}, open(FK,'w'), ensure_ascii=False)
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"products\"]').click()"); await pg.wait_for_timeout(900)
        ok(await pg.locator('#pd-auto:not([hidden])').count()==1, 'кнопка «Разложить по категориям» видна')
        await pg.click('#pd-auto'); await pg.wait_for_timeout(500)
        ai=pg.locator('[data-cata="ai"]'); ok(await ai.count()==1, 'в окне есть «Подобрать ИИ»')
        if await ai.count():
            await ai.click(); await pg.wait_for_timeout(2500)
            n=await pg.evaluate("document.querySelector('[data-cata=\"apply\"]').textContent"); ok('Применить' in n and not n.endswith(' 0 товаров'), f'ИИ подобрал — {n}')
            await pg.click('[data-cata="apply"]'); await pg.wait_for_timeout(600)
            ok(await pg.evaluate("__fd.D().products.filter(p=>p.cat).length")>0, 'категории применены')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
