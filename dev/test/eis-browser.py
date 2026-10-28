"""Browser regression: EIS import/download and UPD 5a, desktop + narrow phone.
Requires EIS_SAMPLE pointing to a private original archive; no private fixture is committed.
"""
import asyncio, os, json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    sample=os.environ.get('EIS_SAMPLE')
    assert sample, 'Set EIS_SAMPLE to the original EIS ZIP'
    with zipfile.ZipFile(sample) as z:
        main_xml=next(z.read(n) for n in z.namelist() if Path(n).name.startswith('ON_') and n.endswith('.xml'))
        supplement=next(z.read(n) for n in z.namelist() if Path(n).name.startswith('PRIL_') and n.endswith('.xml'))
    m=ET.fromstring(main_xml); p=ET.fromstring(supplement)
    sin=m.find('.//СвПрод/ИдСв/СвИП').get('ИННФЛ'); c=m.find('.//СвПокуп/ИдСв/СвЮЛУч'); bs=m.find('.//ОснПер');row=m.find('.//СведТов');pos=p.find('.//НедеталТРУ')
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for width in [1300,390,360]:
            page=await browser.new_page(viewport={'width':width,'height':900},accept_downloads=True)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto('http://localhost:8787/page')
            await page.click('[data-who="Даниил"]');await page.fill('#fd-pass','1111');await page.click('#fd-enter');await page.wait_for_selector('#fd-main:not([hidden])');await page.wait_for_timeout(1800)
            await page.evaluate('async()=>{await __fd.flush();await __fd.pull();await __fd.flush()}')
            await page.evaluate('''x=>{const D=__fd.D(),s=D.suppliers[0],c=D.customers[0],p=D.products[0];s.inn=x.sinn;s.rs='';c.inn=x.cinn;c.kpp=x.ckpp;p.unit='кг';p.country='643';const ctr={id:'eis-test-contract',customerId:c.id,supplierId:s.id,basis:x.basis};D.contracts.push(ctr);D.draft={id:'eis-test-doc',supplierId:s.id,customerId:c.id,contractId:ctr.id,number:'3012',date:'2026-09-17',ship:'Тестовый адрес',basis:x.basis,lines:[{productId:p.id,qty:2,price:100}]};__fd.showPreview('upd',__fd.calc(D.draft));}''',{'sinn':sin,'cinn':c.get('ИННЮЛ'),'ckpp':c.get('КПП'),'basis':'Контракт № '+bs.get('РеквНомерДок')+' от '+bs.get('РеквДатаДок')})
            assert await page.locator('#pv-pages').get_by_text('Универсальный передаточный документ № 3012 от 17.09.2026',exact=True).count()==1
            assert '№ п/п 1-' not in await page.locator('#pv-pages').inner_text()
            await page.click('#pv-eis-setup')
            edo=b'<export><EDOInfo><nsiEDOSupplier><supplierID>TEST</supplierID><fullName>TEST</fullName></nsiEDOSupplier><contractEDOAddInfo><id>1</id><regNum>TEST</regNum><url>https://zakupki.gov.ru/epz/contract/integration/viewXml.html?guid=TEST</url></contractEDOAddInfo></EDOInfo></export>'
            await page.set_input_files('#eis-files',{'name':'EDOInfo.xml','mimeType':'application/xml','buffer':edo})
            await page.wait_for_selector('#eis-source-info a')
            assert await page.locator('#eis-save').is_disabled()
            await page.set_input_files('#eis-files',sample)
            await page.wait_for_selector('[data-eis-pos]')
            pid=await page.evaluate('__fd.D().products[0].id')
            await page.locator('[data-eis-pos]').first.select_option(pid)
            await page.check('#eis-ship');await page.click('#eis-save');await page.wait_for_selector('#fd-eis',state='detached')
            async with page.expect_download() as info: await page.click('#pv-xml')
            download=await info.value
            packet=ET.fromstring(Path(await download.path()).read_bytes())
            assert packet.tag=='ФайлПакет'
            assert len(packet.findall('.//Контент'))==2
            # All three signature slots when explicitly requested; use an obvious TEST marker.
            count=await page.evaluate('''()=>{const k=__fd.calc(__fd.D().draft);k.sig={all:true,sign:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'};__fd.showPreview('upd',k);return document.querySelectorAll('#pv-pages .sgi').length}''')
            assert count==3, count
            await page.click('#pv-eis-setup')
            size=await page.evaluate('({screen:innerWidth,doc:document.documentElement.scrollWidth,dialog:document.querySelector("#fd-eis").getBoundingClientRect().width})')
            assert size['doc']==width,size
            assert size['dialog']<=width,size
            assert not errors,errors
            print(width,'PASS EIS ZIP import + saved mapping + downloaded packet; 5a; 3 signature slots; no horizontal overflow')
            await page.close()
        await browser.close()
asyncio.run(main())
