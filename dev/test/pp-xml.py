"""XML УПД для Портала поставщиков: «Ещё» → «XML для Портала поставщиков» в журнале; не хватает ID спецификации / артикула / страны — список и переход к сопоставлению;
всё есть — полный УПД 5.03 в windows-1251; PPSAMPLE — УПД, собранный самим Порталом: теги и их порядок сверяются с ним."""
import asyncio, os, re, subprocess, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'; XSD=os.environ.get('PPXSD','')
SAMPLE=os.environ.get('PPSAMPLE','')   # УПД, который собрал сам Портал (ON_NSCHFDOPPR_….xml, windows-1251)
def shape(x):
    """для каждого тега — порядок дочерних тегов (как они идут в файле)"""
    import xml.etree.ElementTree as ET
    r={}; 
    def walk(e):
        r.setdefault(e.tag, [])
        for ch in e:
            if ch.tag not in r[e.tag]: r[e.tag].append(ch.tag)
            walk(ch)
    walk(ET.fromstring(x.split('?>',1)[1].strip())); return r
def sameShape(ours, smp):
    """каждый наш тег есть у Портала у того же родителя и в том же порядке"""
    bad=[]
    for t,kids in ours.items():
        ref=smp.get(t)
        if ref is None: bad.append('нет тега '+t); continue
        pos=[ref.index(k) if k in ref else -1 for k in kids]
        if -1 in pos: bad.append(t+': лишние '+str([k for k in kids if k not in ref]))
        elif pos!=sorted(pos): bad.append(t+': порядок '+str(kids))
    return bad
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
            ok('Не хватает данных у 1' in t and n1 in t and 'ID спецификации' in t, f'{W}: без сопоставления — понятный список, чего не хватает')
            ok(await pg.locator('.ppdlg [data-ppgo="dl"]').count()==0, f'{W}: скачать нельзя, пока не хватает')
            await pg.click('.ppdlg [data-ppgo="x"]')
            await ev("(()=>{const c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'); D.specs[c.id][__ps[1].id]={spec:'5080332-2', ste:'', art:'ART-2'};})()")
            await ev(f"document.querySelector('[data-ppx=\"{jid}\"]').click()"); await pg.wait_for_timeout(400)
            async with pg.expect_download() as di:
                await pg.click('.ppdlg [data-ppgo="dl"]')
            d=await di.value; path=f'/tmp/claude-0/s/pp{W}.xml'; await d.save_as(path)
            raw=open(path,'rb').read(); x=raw.decode('cp1251')
            TD=__import__('datetime').date.today().strftime('%d.%m.%Y')
            ok(d.suggested_filename.startswith('УПД № 77 от '+TD), f'{W}: имя файла «УПД № 77 от {TD} (сегодня — день отправки) — Портал поставщиков.xml»')
            ok('encoding="windows-1251"' in x and 'ВерсФорм="5.03"' in x and 'КНД="1115131"' in x and 'Функция="ДОП"' in x and 'ИдФайл="ON_NSCHFDOPPR_' in x, f'{W}: полный УПД 5.03 (как собирает Портал)')
            ok('НомерДок="77"' in x and 'ДатаДок="'+TD+'"' in x and 'ДатаИнфПр="'+TD+'"' in x, f'{W}: номер; дата документа — сегодня (день отправки)')
            ok('Идентиф="ИдСпецификации" Значен="5080332-1"' in x and 'АртикулТов="ART-2"' in x and 'АртикулТов=""' not in x and 'Идентиф="ИдСТЕ" Значен="1234567"' in x and 'КодТов="1234567"' in x, f'{W}: ID спецификации, артикул, СТЕ по строкам')
            ok('КолТов="12.5"' in x and 'ЦенаТов="133.95"' in x and 'СтТовБезНДС="1674.38"' in x and 'НалСт="без НДС"' in x and 'ОКЕИ_Тов="166" НаимЕдИзм="Килограмм"' in x and 'Значен="УЗБЕКИСТАН"' in x, f'{W}: количество, цена, сумма строки (12,5 × 133,95 = 1674,38), единица, страна')
            ok('<СвПрод><ИдСв>' in x and '<СвПокуп><ИдСв><СвЮЛУч' in x and 'АдрТекст="г. Москва, ул. Полбина, д. 72, стр. 1"' in x and '<ГрузОт><ОнЖе>он же</ОнЖе></ГрузОт>' in x, f'{W}: продавец, покупатель, адрес доставки')
            ok('СодОпер="Товары переданы, работы сданы, услуги оказаны" ДатаПер="12.11.2026"' in x and '<Подписант СпосПодтПолном="1">' in x, f'{W}: дата отгрузки из накладной, подписант')
            if SAMPLE:
                smp=shape(open(SAMPLE,'rb').read().decode('cp1251'))
                # ГрузПолуч (адрес доставки не равен адресу покупателя) — обычный элемент 5.03 после ГрузОт; в образце его нет, потому что адреса совпали
                sf=smp['СвСчФакт']; sf.insert(sf.index('ГрузОт')+1,'ГрузПолуч'); smp['ГрузПолуч']=['ИдСв','Адрес']
                bad=sameShape(shape(x), smp)
                ok(not bad, f'{W}: те же теги и порядок, что в УПД от Портала ({bad[:4]})')
            ok(await pg.locator('.ppdlg').count()==0, f'{W}: окно закрылось после скачивания')
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: без ошибок {errs[:2]}')
            await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
