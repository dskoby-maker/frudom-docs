"""XML УПД для Портала поставщиков: «Ещё» → «XML для Портала поставщиков» в журнале; не хватает ID спецификации / артикула / страны — список и переход к сопоставлению;
всё есть — файл в windows-1251, проверяется по схеме Портала (PPXSD — путь к mini_…_ON_NSCHFDOPPR_1_997_01_05_01_02.xsd, проверка xmllint)."""
import asyncio, os, re, subprocess, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'; XSD=os.environ.get('PPXSD','')
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in (1300, 390):
            ctx=await b.new_context(viewport={'width':W,'height':900}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
            await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
            jid=await ev("""(()=>{const c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'), ps=D.products.slice(0,2), id='pp'+Date.now();
              ps[0].country='643'; ps[1].country='860';
              const dr=Object.assign(newDraft(D),{id, number:'77', date:'2026-11-12', customerId:c.id, ship:'г. Москва, ул. Полбина, д. 72, стр. 1', lines:[{productId:ps[0].id, qty:12.5, price:133.95},{productId:ps[1].id, qty:3, price:1548.6}]});
              const snap=makeSnap(dr); D.journal.push({id, number:'77', date:'2026-11-12', customerId:c.id, supplierId:dr.supplierId, sum:6319.18, snap});
              D.specs=D.specs||{}; D.specs[c.id]={}; D.specs[c.id][ps[0].id]={spec:'5080332-1', ste:'1234567', art:'ART-1'};
              window.__ps=ps; renderJournal(); return id;})()""")
            await ev("showTab('journal'); JF().q='77'; renderJournal()"); await pg.wait_for_timeout(500)
            await ev(f"document.querySelector('[data-ppx=\"{jid}\"]').click()"); await pg.wait_for_timeout(400)
            t=await pg.text_content('.ppdlg')
            n1=await ev('__ps[1].name')
            ok('Не хватает данных у 1' in t and n1 in t and 'ID спецификации' in t and 'артикул' in t, f'{W}: без сопоставления — понятный список, чего не хватает')
            ok(await pg.locator('.ppdlg [data-ppgo="dl"]').count()==0, f'{W}: скачать нельзя, пока не хватает')
            await pg.click('.ppdlg [data-ppgo="x"]')
            await ev("(()=>{const c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'); D.specs[c.id][__ps[1].id]={spec:'5080332-2', ste:'', art:'ART-2'};})()")
            await ev(f"document.querySelector('[data-ppx=\"{jid}\"]').click()"); await pg.wait_for_timeout(400)
            async with pg.expect_download() as di:
                await pg.click('.ppdlg [data-ppgo="dl"]')
            d=await di.value; path=f'/tmp/claude-0/s/pp{W}.xml'; await d.save_as(path)
            raw=open(path,'rb').read(); x=raw.decode('cp1251')
            ok(d.suggested_filename.startswith('УПД № 77 от 12.11.2026'), f'{W}: имя файла «УПД № 77 от 12.11.2026 — Портал поставщиков.xml»')
            ok('encoding="windows-1251"' in x and 'НомерСчФ="77"' in x and 'ДатаСчФ="12.11.2026"' in x, f'{W}: номер и дата документа')
            ok('Идентиф="ИдСпецификации" Значен="5080332-1"' in x and 'АртикулТов="ART-2"' in x and 'Идентиф="ИдСТЕ" Значен="1234567"' in x, f'{W}: ID спецификации, артикул, СТЕ по строкам')
            ok('КолТов="12.5"' in x and 'ЦенаТов="133.95"' in x and 'СтТовБезНДС="1674.38"' in x and 'КодПроисх="860"' in x, f'{W}: количество, цена, сумма строки (12,5 × 133,95 = 1674,38), страна')
            ok('<БезНДС>без НДС</БезНДС>' in x and 'АдрТекст="г. Москва, ул. Полбина, д. 72, стр. 1"' in x , f'{W}: без НДС, адрес доставки')
            if XSD:
                r=subprocess.run(['xmllint','--noout','--schema',XSD,path],capture_output=True,text=True)
                ok(r.returncode==0, f'{W}: файл проходит схему Портала ({(r.stderr or r.stdout).strip()[:300]})')
            ok(await pg.locator('.ppdlg').count()==0, f'{W}: окно закрылось после скачивания')
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: без ошибок {errs[:2]}')
            await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
