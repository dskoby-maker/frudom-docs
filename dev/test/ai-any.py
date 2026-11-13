"""«Распознать с ИИ» — любой файл: Word/Excel/PowerPoint/RTF/HTML/письмо уходят в ИИ текстом, голосовое — как есть (Gemini),
GIF/BMP — картинкой JPG; итог разбирается в форму. Сервер: AI_FAKE=/tmp/ai-any.json."""
import asyncio, os, json, zipfile, io, struct, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
DIR='/tmp/ai-any'; os.makedirs(DIR, exist_ok=True)
def z(name, files):
    p=f'{DIR}/{name}'; 
    with zipfile.ZipFile(p,'w') as zf:
        for k,v in files.items(): zf.writestr(k,v)
    return p
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; A='http://schemas.openxmlformats.org/drawingml/2006/main'
files={
 'docx': z('заявка.docx', {'word/document.xml':f'<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>Заявка Цирк</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Петрушка</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>3 кг</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'}),
 'pptx': z('заявка.pptx', {'ppt/slides/slide1.xml':f'<p:sld xmlns:p="x" xmlns:a="{A}"><a:p><a:r><a:t>Петрушка 3 кг</a:t></a:r></a:p></p:sld>'}),
 'odt':  z('заявка.odt', {'content.xml':'<o:doc xmlns:o="o" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><text:p>Петрушка 3 кг</text:p></o:doc>'}),
}
open(f'{DIR}/заявка.rtf','w').write(r'{\rtf1\ansi\ansicpg1251 \par Petrushka 3 kg\par}'); files['rtf']=f'{DIR}/заявка.rtf'
open(f'{DIR}/заявка.html','w').write('<html><body><table><tr><td>Петрушка</td><td>3 кг</td></tr></table><script>x()</script></body></html>'); files['html']=f'{DIR}/заявка.html'
open(f'{DIR}/заявка.eml','w').write('From: a@b.ru\nSubject: Заявка\n\nПетрушка 3 кг\n'); files['eml']=f'{DIR}/заявка.eml'
open(f'{DIR}/заявка.csv','w').write('Наименование;Кол-во\nПетрушка;3\n'); files['csv']=f'{DIR}/заявка.csv'
open(f'{DIR}/голосовое.ogg','wb').write(b'OggS'+bytes(200)); files['ogg']=f'{DIR}/голосовое.ogg'
open(f'{DIR}/скан.gif','wb').write(bytes.fromhex('47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b')); files['gif']=f'{DIR}/скан.gif'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        JSZ=os.environ.get('JSZIP'); XL=os.environ.get('XLSXJS')
        if JSZ: await pg.route('**/jszip.min.js', lambda r: r.fulfill(path=JSZ, content_type='application/javascript'))
        if XL: await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=XL, content_type='application/javascript'))
        ev("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        pname=await pg.evaluate("__fd.D().products[0].name"); cname=await pg.evaluate("__fd.D().customers[0].name")
        json.dump({"customer":cname,"items":[{"name":pname,"unit":"кг","qty":3}]}, open('/tmp/ai-any.json','w'), ensure_ascii=False)
        ok('accept' not in (await pg.evaluate("document.getElementById('imp-aifile').outerHTML")), 'выбор файла для ИИ — любой тип')
        for k,path in files.items():
            if k in ('docx','pptx','odt') and not JSZ: print('—  ',k,'без JSZIP — пропуск'); continue
            if k=='csv' and not XL: print('—   csv без XLSXJS — пропуск'); continue
            ev("globalThis.__lastGem=null; 1")
            await pg.evaluate("(()=>{ const b=document.querySelector('#imp-res [data-impclear], #imp-clear'); })()")
            await pg.set_input_files('#imp-aifile', path); await pg.wait_for_timeout(2500)
            g=ev("JSON.stringify(globalThis.__lastGem||null)"); g=json.loads(g) if g else None
            parts=(g or {}).get('contents',[{}])[0].get('parts',[]) if g else []
            txt=' '.join(x.get('text','') for x in parts); inl=[x['inline_data']['mime_type'] for x in parts if 'inline_data' in x]
            res=await pg.text_content('#imp-res') or ''
            if k=='ogg': ok(inl==['audio/ogg'], f'{k}: голосовое ушло в Gemini как audio/ogg {inl}')
            elif k=='gif': ok(inl==['image/jpeg'], f'{k}: картинка ушла как JPG {inl}')
            else: ok(not inl and ('Петрушка' in txt or 'Petrushka' in txt) and 'содержимое файла' in txt and '<td>' not in txt and 'x()' not in txt, f'{k}: ушёл в ИИ текстом')
            ok('прочитан ИИ' in res and 'не прочитал' not in res, f'{k}: заявка разобрана ({res[:80]!r})')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
