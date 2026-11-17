"""«+ Новый заказчик» в списке выбора заказчика: «Новый документ» и «Заявка»; проверка полей, разбор карточки предприятия, повтор ИНН, сохранение в таблицу, сразу выбран; Гриша кнопку не видит."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
CARD="""ООО «Ромашка-Тест»
ИНН/КПП 7701234567 / 770101001
Юридический адрес: 123456, г. Москва, ул. Тестовая, д. 1
Банк: АО «ТБанк», г. Москва
БИК 044525974
р/с 40702 81010 0000 123456
к/с 30101810145250000974"""
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx,pg,errs
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    ctx,pg,errs=await login(b,'Даниил','1111')
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(600)
    n0=await pg.evaluate("__fd.D().customers.length")
    await pg.locator('#d-cus').locator('xpath=following-sibling::button[contains(@class,"cpk")]').first.click(); await pg.wait_for_timeout(400)
    ok(await pg.locator('.cpk-pop [data-cpknew]').count()==1, f'{TG}: в списке есть «+ Новый заказчик»')
    if await pg.locator('.cpk-pop .cpk-q').count():
        await pg.fill('.cpk-pop .cpk-q','Ромашка'); await pg.wait_for_timeout(200)
        t=await pg.text_content('.cpk-pop [data-cpknew]'); ok('Ромашка' in t, f'{TG}: в кнопке набранное «{t.strip()}»')
    await pg.click('.cpk-pop [data-cpknew]'); await pg.wait_for_timeout(700)
    ok(await pg.locator('#fd-dcard.cnwin').count()==1, f'{TG}: открылось окно нового заказчика')
    # пустое название → ошибка, окно не закрывается
    await pg.fill('#cn-name',''); await pg.fill('#cn-inn','123'); await pg.click('#fd-dcard [data-cn="save"]'); await pg.wait_for_timeout(300)
    e1=await pg.text_content('[data-cne="name"]'); e2=await pg.text_content('[data-cne="inn"]')
    ok('наименование' in e1 and 'ИНН' in e2 and await pg.locator('#fd-dcard.cnwin').count()==1, f'{TG}: проверка полей ({e1!r}, {e2!r})')
    await pg.fill('#cn-inn','')
    # разбор карточки
    await pg.click('#fd-dcard .cn-paste summary'); await pg.fill('#cn-src', CARD); await pg.click('#fd-dcard [data-cn="parse"]'); await pg.wait_for_timeout(300)
    v=await pg.evaluate("['name','inn','kpp','bik','rs','ks','address','bank'].map(k=>document.querySelector('#cn-'+k).value)")
    print('   разобрано:', v)
    ok(v[0]=='ООО «Ромашка-Тест»' and v[1]=='7701234567' and v[2]=='770101001' and v[3]=='044525974' and v[4]=='40702810100000123456' and v[5]=='30101810145250000974' and 'Тестовая' in v[6] and 'ТБанк' in v[7], f'{TG}: карточка разложена по полям')
    if await pg.locator('#cn-short').count(): await pg.fill('#cn-short','Ромашка')
    sw=await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"); ok(sw, f'{TG}: без прокрутки вбок')
    await pg.screenshot(path=f'/tmp/cn-{TG}.png')
    await pg.click('#fd-dcard [data-cn="save"]'); await pg.wait_for_timeout(1500)
    ok(await pg.locator('#fd-dcard.cnwin').count()==0, f'{TG}: окно закрылось после сохранения')
    st=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers.find(x=>x.inn==='7701234567'); return {n:D.customers.length, id:c&&c.id, sel:document.querySelector('#d-cus').value, dr:D.draft.customerId, kpp:c&&c.kpp, rs:c&&c.rs}; })()")
    ok(st['n']==n0+1 and st['id'] and st['sel']==st['id'] and st['dr']==st['id'], f'{TG}: заказчик добавлен и сразу выбран в документе {st}')
    cbtn=await pg.evaluate("document.querySelector('#d-cus').parentNode.querySelector('.cpk')?.textContent||''"); ok('Ромашка' in cbtn, f'{TG}: в поле «Заказчик» — «{cbtn.strip()}»')
    await pg.wait_for_timeout(2500)
    dump=urllib.request.urlopen('http://localhost:8787/dump').read().decode(); ok('7701234567' in dump and '40702810100000123456' in dump, f'{TG}: сохранён в таблицу')
    # повтор ИНН из «Заявки»
    await pg.evaluate(TAB+"('order')"); await pg.wait_for_timeout(700)
    await pg.locator('#o-cus').locator('xpath=following-sibling::button[contains(@class,"cpk")]').first.click(); await pg.wait_for_timeout(400)
    await pg.click('.cpk-pop [data-cpknew]'); await pg.wait_for_timeout(600)
    await pg.fill('#cn-name','ООО Другое'); await pg.fill('#cn-inn','7701234567'); await pg.fill('#cn-kpp','770101001'); await pg.click('#fd-dcard [data-cn="save"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#cn-dup:not([hidden])').count()==1, f'{TG}: повтор ИНН — предупреждение')
    await pg.click('#fd-dcard [data-cn="pick"]'); await pg.wait_for_timeout(1200)
    st2=await pg.evaluate("[__fd.D().customers.length, document.querySelector('#o-cus').value]")
    ok(st2[0]==n0+1 and st2[1]==st['id'], f'{TG}: «Выбрать» существующего — новый не создан, выбран в заявке {st2}')
    ok(not errs, f'{TG}: ошибок на странице нет {errs}')
    await ctx.close()
    ctx,pg,errs=await login(b,'Гриша','3333')
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(600)
    btn=pg.locator('#d-cus').locator('xpath=following-sibling::button[contains(@class,"cpk")]')
    if await btn.count():
        await btn.first.click(); await pg.wait_for_timeout(400)
    else:
        await pg.evaluate("cpkOpen ? 0 : 0")
    ok(await pg.locator('.cpk-pop [data-cpknew]').count()==0, f'{TG}: у Гриши кнопки нет')
    await b.close()
  print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
