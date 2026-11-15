"""Заказчик «Астория» (ООО «АСТОРИЯ») и договор № 121126 заводятся один раз; Гриша их не создаёт; в документе — полное название, в списке — короткое."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(t):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
    return ctx,pg,errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,'Гриша','3333'); await pg.wait_for_timeout(2500); await ctx.close()
        ok(not [c for c in rows('Заказчики') if c.get('ИНН')=='5012099201'], 'Гриша заказчика не создаёт')
        for i in range(2):
            ctx,pg,errs=await login(b,'Даниил','1111'); await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(3000)
            C=[c for c in rows('Заказчики') if c.get('ИНН')=='5012099201']; K=[x for x in rows('Контракты') if '121126' in x.get('Основание (номер и дата)','')]
            ok(len(C)==1 and len(K)==1, f'проход {i+1}: один заказчик и один договор ({len(C)}, {len(K)})')
            if i==0:
                c=C[0]; ok(c['Наименование']=='ООО «АСТОРИЯ»' and c['Короткое название (только на сайте)']=='Астория' and c['КПП']=='501201001' and c['Р/с / казн. счёт']=='40702810902860008565' and c['БИК']=='044525593', 'реквизиты как в договоре')
                ok('Скоб' in K[0].get('Поставщик (исполнитель)',''), 'договор от ИП Скобёлкина')
                txt=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.inn==='5012099201'); const o=[...document.querySelectorAll('#d-cus option')].find(o=>o.value===c.id); return o?o.textContent:''})()""")
                ok(txt.startswith('Астория'), 'в выборе заказчика — «Астория»: '+txt)
            ok(not errs, 'без ошибок: '+str(errs[:2])); await ctx.close()
        await b.close()
    print('ошибок:', len(fails))
asyncio.run(main())
