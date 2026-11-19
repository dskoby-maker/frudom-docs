"""Прайс поставщика: «Примечание» шаблона (упаковка и граммовка) сохраняется у позиции, видно в проверке, в окне прайса и во «Товарах»;
₽/кг считается по весу из упаковки («1,5г*25пак*12шт» — пачка 37,5 г). Много товаров сохраняются без падения страницы (dirtyMany).
Библиотека Excel подменена заглушкой. Сервер: AI_FAKE=/tmp/claude-0/vpk-ai.json PORT=8787 node test/server.js (на чистом сервере)."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
B='http://localhost:8787'
def srv(js): return urllib.request.urlopen(urllib.request.Request(B+'/eval', data=js.encode(), method='POST')).read().decode()
json.dump({"c":[]}, open('/tmp/claude-0/vpk-ai.json','w'))
ROWS=[["Чай Ахмад черный персик маракуйя 1,5г *25пак*12шт","шт",100.47,"Чай","упак. 12 шт по 37,5 г · 1 205,64 ₽ за упак."],
      ["Вафли Артек 6,5кг.(ОБК)","кг",245.4,"Вафли","кор. 6,5 кг · 1 595,10 ₽ за кор."]]+[[f"Конфеты тест вариант {i} 200г*10шт","шт",50+i,"Конфеты","кор. 10 шт по 200 г · 500,00 ₽ за кор."] for i in range(600)]
AOA=[["Прайс"],[],["Поставщик","ТД Палитра Вкуса"],["Дата прайса","17.09.2026"],["Цены",""],[],["Наименование","Ед.","Цена, ₽","Категория","Примечание"]]+ROWS
FAKE="window.XLSX={read:()=>({SheetNames:['П'],Sheets:{'П':1}}),utils:{sheet_to_json:()=>"+json.dumps(AOA,ensure_ascii=False)+"}};"
F='/tmp/claude-0/vpk.xlsx'; open(F,'wb').write(b'PK')
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(FAKE)
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"suppliers\"]').click()"); await pg.wait_for_selector('#vp-card:not([hidden]) .vph', timeout=8000)
        await pg.set_input_files('#vp-file', F); await pg.wait_for_selector('#vp-card .vpuph', timeout=60000)
        ok('602' in await pg.inner_text('#vp-card .vpuph'), 'прочитано 602 позиции по шаблону')
        ok('упак. 12 шт по 37,5 г' in await pg.inner_text('#vp-card .vpu'), 'упаковка видна в проверке')
        await pg.click('#vp-card [data-vp="save"]'); await pg.wait_for_selector('#vp-card .vpl', timeout=90000); await pg.wait_for_timeout(2500)
        d=json.loads(urllib.request.urlopen(B+'/dump').read()); V=d['Цены поставщиков']; i=V[0].index('Примечание')
        a=[r for r in V[1:] if 'Ахмад' in r[2]]
        ok(len(V)-1==602 and a and a[0][i]=='Чай · уп: упак. 12 шт по 37,5 г, 1 205,64 ₽ за упак.', f'на листе 602 позиции, упаковка в примечании ({a[0][i] if a else ""})')
        ok(await pg.evaluate("__fd.D().products.filter(p=>/Конфеты тест вариант/.test(p.name)).length")==600, '600 новых товаров созданы')
        await pg.click('#vp-card [data-vp="win"]'); await pg.wait_for_timeout(800)
        ok('кор. 6,5 кг' in await pg.inner_text('#fd-dcard'), 'в окне прайса видна упаковка')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"products\"]').click()"); await pg.wait_for_timeout(2000)
        await pg.evaluate("(()=>{const b=[...document.querySelectorAll('#pd-src [data-pdsrc]')].find(x=>x.dataset.pdsrc.startsWith('v:'));b&&b.click()})()"); await pg.wait_for_timeout(1000)
        await pg.fill('#pd-q','Ахмад черный персик'); await pg.wait_for_timeout(1200)
        t=(await pg.inner_text('#pd-body')).replace(' ',' ').replace(' ',' ')
        ok('2 679,2' in t, '₽/кг по весу из упаковки: 100,47 ÷ 37,5 г = 2 679,20')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=390, 'без прокрутки вбок')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
