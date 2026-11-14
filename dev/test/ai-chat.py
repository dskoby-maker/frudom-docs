"""«Помощник» (Code.gs ≥ 38, действие aiChat): кнопка «Спросить» только у Даниила; вопрос → Claude просит данные (search_docs) →
сайт сам находит накладные и отдаёт строки → ответ со ссылкой на накладную; ссылка открывает окно накладной; долги; телефон — во весь экран."""
import asyncio, os, re, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
def srv(js):
    r=urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode()
    try:
        x=json.loads(r); return x if isinstance(x,str) else r
    except Exception: return r
FAKE = r"""__chatLog=[]; __chat=function(bd){ const last=bd.messages[bd.messages.length-1];
  if(Array.isArray(last.content) && last.content[0].type==='text' && /Файл «/.test(last.content[0].text)){ const cn=(bd.system.match(/__CN=([^\n]+)/)||[])[1];
    return {content:[{type:'tool_use',id:'t3',name:'make_document',input:{customer:'Цирк', date:'2026-11-20', items:[{name:'Картофель',qty:10,unit:'кг'}]}}],stop_reason:'tool_use'}; }
  if(Array.isArray(last.content) && last.content[0].type==='tool_result' && /opened/.test(last.content[0].content)) return {content:[{type:'text',text:'Открыл «Новый документ», проверьте и сохраните.'}],stop_reason:'end_turn'};
  if(typeof last.content==='string' && /запомни/i.test(last.content)) return {content:[{type:'tool_use',id:'t4',name:'remember',input:{text:'Позвонить в Цирк про акт', date:'2026-11-01'}}],stop_reason:'tool_use'};
  if(Array.isArray(last.content) && last.content[0].type==='tool_result' && /saved/.test(last.content[0].content)) return {content:[{type:'text',text:'Запомнил.'}],stop_reason:'end_turn'};
  if(typeof last.content==='string'){ if(/долж/i.test(last.content)) return {content:[{type:'tool_use',id:'t2',name:'debts',input:{}}],stop_reason:'tool_use'};
    return {content:[{type:'text',text:'Смотрю.'},{type:'tool_use',id:'t1',name:'search_docs',input:{product:'картошка',date_from:'2026-11-12',date_to:'2026-11-12'}}],stop_reason:'tool_use'}; }
  const r=JSON.parse(last.content[0].content);
  if(r.customers) return {content:[{type:'text',text:'Всего должны **'+r.total_debt+' ₽**.'}],stop_reason:'end_turn'};
  const d=r.docs[0], t=r.product_totals[0];
  return {content:[{type:'text',text:'12 ноября картофель ушёл в [[cus:'+d.customer_id+'|'+d.customer+']]: **'+t.qty+' '+t.unit+'**, накладная [[doc:'+d.id+'|№ '+d.number+']].\n- цена '+d.lines[0].price}],stop_reason:'end_turn'}; }; 'ok'"""
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('CLAUDE_KEY','sk-ant-test-key-000000000000'); 'ok'"); srv(FAKE)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in (1300, 390):
            ctx=await b.new_context(viewport={'width':W,'height':860}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
            await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
            if W==1300:
                await ev("""(()=>{ const c=D.customers.find(x=>x.id!=='private-buyer'), s=D.suppliers[0];
                  let p=D.products.find(x=>/картоф/i.test(x.name)); if(!p){ p={id:'pKart', name:'Картофель продовольственный', unit:'кг', price:'40'}; D.products.push(p); dirty('products',p.id); }
                  const dr=Object.assign(newDraft(D),{id:'chat1', number:'501', date:'2026-11-12', customerId:c.id, supplierId:s.id, lines:[{productId:p.id, qty:85, price:50}]});
                  D.journal.push({id:'chat1', number:'501', date:'2026-11-12', customerId:c.id, supplierId:s.id, sum:4250, snap:makeSnap(dr)}); dirty('journal','chat1'); window.__cn=cusNm(c.id); })()""")
                for _ in range(20):
                    await ev('flush()'); await pg.wait_for_timeout(150)
                    if not await ev('hasPending()'): break
            await pg.wait_for_selector('#ac-fab:not([hidden])', timeout=5000)
            ok(await pg.is_visible('#ac-fab'), f'{W}: кнопка «Спросить» у Даниила')
            await pg.click('#ac-fab'); await pg.wait_for_selector('#ac-pan:not([hidden])')
            ok(await pg.locator('#ac-list .acsug button').count()>=4, f'{W}: подсказки-примеры')
            await pg.fill('#ac-in', 'Куда уходила картошка 12 числа?'); await pg.press('#ac-in','Enter')
            await pg.wait_for_selector('#ac-list .am.a', timeout=15000)
            t=await pg.text_content('#ac-list .am.a:last-child')
            ok('85' in t and 'кг' in t and '№ 501' in t, f'{W}: ответ по данным сайта: 85 кг, № 501 ({t[:120]})')
            log=json.loads(srv("JSON.stringify(__chatLog)"))
            ok(len(log)>=2 and any(m['role']=='user' and isinstance(m['content'],list) and m['content'][0]['type']=='tool_result' for m in log[-1]['messages']), f'{W}: сайт сам ответил Claude данными (tool_result)')
            ok(log[-1]['system'].find('Сегодня')>=0 and len(log[-1]['tools'])>=6, f'{W}: инструкция и инструменты ушли в Claude')
            tr=json.loads([m for m in log[-1]['messages'] if m['role']=='user' and isinstance(m['content'],list)][-1]['content'][0]['content'])
            ok(tr['found_docs']>=1 and tr['product_totals'][0]['qty']>=85 and 'Картоф' in tr['docs'][0]['lines'][0]['name'], f'{W}: найдено по «картошка» → «Картофель» ({tr["product_totals"]})')
            await pg.click('#ac-list .acl[data-acdoc="chat1"]'); await pg.wait_for_timeout(700)
            ok(await pg.evaluate("!!document.querySelector('dialog[open]') && /501/.test(document.querySelector('dialog[open]').textContent)"), f'{W}: ссылка открывает накладную № 501')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            await pg.fill('#ac-in', 'Кто сколько мне должен?'); await pg.press('#ac-in','Enter')
            await pg.wait_for_function("document.querySelectorAll('#ac-list .am.a').length>=2", timeout=15000)
            t=await pg.text_content('#ac-list .am.a:last-child'); ok('должны' in t and '₽' in t, f'{W}: долги ({t[:80]})')
            if W==390:
                bb=await pg.evaluate("(()=>{const r=document.getElementById('ac-pan').getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight, document.documentElement.scrollWidth]})()")
                ok(bb[0]>=bb[2]-1 and bb[1]>=bb[3]-1 and bb[4]<=bb[2], f'телефон: помощник во весь экран, без прокрутки вбок ({bb})')
            u=await pg.text_content('#ac-use'); ok('Потрачено' in u and '$' in u, f'{W}: расход в шапке ({u})')
            await pg.fill('#ac-in', 'Запомни: позвонить в Цирк про акт'); await pg.press('#ac-in','Enter')
            await pg.wait_for_function("document.querySelectorAll('#ac-list .am.a').length>=3", timeout=15000)
            ok(await pg.locator('#ac-list .acrm').count()==1 and 'Цирк' in await pg.text_content('#ac-list .acrm'), f'{W}: напоминание в памяти и показано сверху')
            ok('Позвонить в Цирк' in json.loads(srv("JSON.stringify(__chatLog)"))[-1]['system'], f'{W}: память уходит в инструкцию')
            await pg.click('[data-acnew]'); ok(await pg.locator('#ac-list .am').count()==0, f'{W}: «Новый разговор» очищает')
            ok(await pg.locator('#ac-list .acrm').count()==1, f'{W}: напоминание остаётся после нового разговора')
            await pg.click('#ac-list [data-acrm]'); await pg.wait_for_timeout(200); ok(await pg.locator('#ac-list .acrm').count()==0, f'{W}: «Готово» убирает напоминание')
            # файл → накладная
            fp='/tmp/claude-0/zayavka.txt'; open(fp,'w').write('Заявка на поставку\nКартофель 10 кг\n')
            await pg.set_input_files('#ac-fin', fp); await pg.wait_for_timeout(500)
            ok('zayavka.txt' in await pg.text_content('#ac-fs'), f'{W}: файл приложен')
            await pg.fill('#ac-in', 'Сделай накладную'); await pg.press('#ac-in','Enter')
            await pg.wait_for_function("document.getElementById('ac-pan').hidden", timeout=15000)
            ok(await ev("curTab")=='doc' and await ev("!!(IMP&&IMP.r&&IMP.r.groups.length)"), f'{W}: открыт «Новый документ» с заполненной накладной')
            g=await ev("JSON.stringify(IMP.r.groups[0].items.map(x=>[x.name||x.productId, x.qty]))"); ok('10' in g, f'{W}: строки накладной ({g[:80]})')
            m=json.loads(srv("JSON.stringify(__chatLog)"))[-1]['messages']; ok(any(isinstance(x['content'],list) and any(c.get('type')=='text' and 'Картофель 10 кг' in c.get('text','') for c in x['content']) for x in m), f'{W}: содержимое файла ушло в Claude')
            await pg.click('#ac-fab'); await pg.wait_for_selector('#ac-pan:not([hidden])')
            await pg.wait_for_function("/проверьте/.test(document.getElementById('ac-list').textContent)", timeout=10000)
            ok(True, f'{W}: ответ про накладную виден после возврата в чат')
            if W==390:
                fb=await pg.evaluate("(()=>{document.querySelector('[data-acx]').click(); const f=document.getElementById('ac-fab').getBoundingClientRect(), m=document.getElementById('mbar').getBoundingClientRect(); return [f.bottom, m.top, f.width]})()")
                ok(fb[0]<=fb[1]+0.5 and fb[2]<=44, f'телефон: кнопка маленькая и над нижним меню ({fb})')
                await pg.click('#ac-fab'); await pg.wait_for_selector('#ac-pan:not([hidden])')
            await pg.click('[data-acx]'); ok(await pg.is_visible('#ac-fab'), f'{W}: закрыли — снова кнопка')
            ok(not errs, f'{W}: без ошибок {errs[:2]}')
            await ctx.close()
        ctx=await b.new_context(viewport={'width':1300,'height':860}); pg=await ctx.new_page()
        await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
        await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Наталья"]'); await pg.fill('#fd-pass','2222'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3500)
        ok(not await pg.evaluate("(()=>{const f=document.getElementById('ac-fab'); return !!f && !f.hidden})()"), 'у Натальи кнопки нет')
        await ctx.close(); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
