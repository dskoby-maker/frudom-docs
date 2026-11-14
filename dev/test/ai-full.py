"""Помощник видит весь сайт: site_data (любой раздел: заказчики, цены, договоры, задачи, склад, почта…), screen (что на экране),
site_help (как пользоваться), business_review (разбор месяца для советов). Картинки печатей и ключи в Claude не уходят."""
import asyncio, os, re, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
def srv(js): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode()
FAKE = r"""__chat=function(bd){ const last=bd.messages[bd.messages.length-1];
  if(typeof last.content==='string') return {content:[{type:'tool_use',id:'s1',name:'screen',input:{}}],stop_reason:'tool_use'};
  const r=JSON.parse(last.content[0].content); return {content:[{type:'text',text:'Вы на вкладке «'+r.tab_title+'».'}],stop_reason:'end_turn'}; }; 'ok'"""
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('CLAUDE_KEY','sk-ant-test-key-000000000000'); 'ok'"); srv(FAKE)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in (1300, 390):
            pg=await b.new_page(viewport={'width':W,'height':860}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
            await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
            if W==1300:
                L=await ev("AC_RUN.site_data({})"); names=[x['collection'] for x in L['collections']]
                ok(all(k in names for k in ('customers','prices','contracts','day_tasks','stock_items','mail','bank','purchases_said')), f'список разделов: {names}')
                c=await ev("AC_RUN.site_data({collection:'customers', text:'цирк'})"); ok(c['found']>=1 and 'цирк' in json.dumps(c,ensure_ascii=False).lower(), 'заказчики по тексту')
                pr=await ev("AC_RUN.site_data({collection:'prices', limit:5})"); ok(pr['total']>0 and len(pr['rows'])==5 and pr['rows'][0].get('product'), f'прайсы: {pr["rows"][:1]}')
                await ev("D.suppliers[0].stamp='data:image/png;base64,AAAA'; D.suppliers[0].sealX={i:'data:image/png;base64,BBBB'}")
                s=json.dumps(await ev("AC_RUN.site_data({collection:'suppliers'})"),ensure_ascii=False); ok('base64' not in s and 'data:image' not in s, 'картинки печатей не уходят')
                await ev("AC_RUN.site_data({collection:'other_money'})"); ok(True,'расходы грузятся')
                h=await ev("AC_RUN.site_help({topic:'портал поставщиков'})"); ok(h['help'] and 'Портал' in h['help'][0]['topic'], f'справка: {h["help"][0]["topic"] if h["help"] else h}')
                t=await ev("AC_RUN.site_help({})"); ok(len(t['topics'])>15, 'темы справки')
                r=await ev("AC_RUN.business_review({})"); ok('this' in r and 'previous' in r and 'top_products' in r, f'разбор месяца: {list(r)[:8]}')
                sc=await ev("AC_RUN.screen()"); ok(sc['tab']=='doc' and sc.get('screen_text') and 'new_document_form' in sc, 'экран: вкладка и форма')
                ok('советник' in await ev("acSystem()"), 'в инструкции — советы')
                n=await ev("AC_TOOLS.length"); sz=await ev("JSON.stringify(AC_TOOLS).length"); ok(sz<16000, f'описание инструментов не раздуто: {n} шт., {sz} знаков')
            await pg.click('#ac-fab'); await pg.wait_for_timeout(300)
            await pg.fill('#ac-in', 'Где я сейчас?'); await pg.keyboard.press('Enter')
            await pg.wait_for_function("document.querySelector('#ac-pan').innerText.includes('Вы на вкладке')", timeout=15000)
            ok('Новый документ' in await pg.inner_text('#ac-pan') or 'Календарь' in await pg.inner_text('#ac-pan'), f'{W}: помощник видит экран')
            ok(not errs, f'{W}: без ошибок {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
