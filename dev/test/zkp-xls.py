"""«Закупка» → «Excel»: окно периода, таблица из трёх листов с верными суммами. Библиотека Excel подменяется заглушкой, которая ловит листы
(с настоящей xlsx: XLSXJS=путь к xlsx.full.min.js — тогда проверяется, что файл скачался)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
STUB="""window.XLSX={utils:{aoa_to_sheet:a=>{const ws={__a:a}; const R=a.length-1, C=Math.max(...a.map(r=>r.length))-1; a.forEach((r,i)=>r.forEach((v,j)=>{ if(v!=null&&v!=='') ws[String.fromCharCode(65+j)+(i+1)]={v,t:typeof v==='number'?'n':'s'}; })); ws['!ref']='A1:'+String.fromCharCode(65+C)+(R+1); return ws;},
 decode_range:r=>{const [a,b]=r.split(':'); const p=x=>({c:x.charCodeAt(0)-65, r:+x.slice(1)-1}); return {s:p(a), e:p(b)};},
 encode_cell:({r,c})=>String.fromCharCode(65+c)+(r+1), encode_range:({s,e})=>String.fromCharCode(65+s.c)+(s.r+1)+':'+String.fromCharCode(65+e.c)+(e.r+1),
 book_new:()=>({S:{},N:[]}), book_append_sheet:(wb,ws,n)=>{wb.S[n]=ws.__a; wb.N.push(n);}}, writeFile:(wb,f)=>{window.__wb={f,S:wb.S,N:wb.N};}};"""
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    if not os.environ.get('XLSXJS'): await pg.evaluate(STUB)
    else: await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ['XLSXJS']))
    t=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'zx-a', name:'Яблоки', code:'', unit:'кг', country:'', price:'100'},{id:'zx-b', name:'Груши', code:'', unit:'кг', country:'', price:'200'}); return new Date().toISOString().slice(0,10);})()")
    for i,lines in enumerate(["[{productId:'zx-a',qty:'10',price:'100'},{productId:'zx-b',qty:'5',price:'200'}]","[{productId:'zx-a',qty:'4',price:'100'}]"]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'zxd{i}', customerId:window.__cid, number:'', date:'{t}', lines:{lines}}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    # закупка: яблоки 60 ₽ в первой накладной (куплено 11 кг), груши без цены; вторая — одной суммой 250
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.evaluate("""(()=>{const D=__fd.D(), A=(D.doccosts=Array.isArray(D.doccosts)?D.doccosts:[]); const set=(id,lines)=>{ let r=A.find(x=>x.id===id); if(!r){ r={id}; A.push(r);} r.lines=JSON.stringify(lines); r.expense=''; };
      set('zxd0',{'zx-a':'60',_bq:{'zx-a':11}}); set('zxd1',{_src:[{n:'Саид',s:250}]}); })()""")
    await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1200)
    await pg.click('#zkp [data-zkxls]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#fd-dcard #zkx-a').count()==1, f'{tag}: открылось окно выбора периода')
    await pg.click('#fd-dcard [data-zkxp="today"]'); await pg.wait_for_timeout(200)
    n=await pg.text_content('#zkx-n'); ok('2 накладные' in n, f'{tag}: окно считает накладные за день ({n})')
    await pg.screenshot(path=f'/tmp/claude-0/zkx-{tag}.png')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    if os.environ.get('XLSXJS'):
        async with pg.expect_download() as d: await pg.click('#fd-dcard [data-zkxgo]')
        ok((await d.value).suggested_filename.endswith('.xlsx'), f'{tag}: файл скачан')
    else:
        await pg.click('#fd-dcard [data-zkxgo]'); await pg.wait_for_timeout(600)
        W=await pg.evaluate("window.__wb")
        ok(W and W['N']==['Товары','Накладные','Итого по товарам'], f'{tag}: три листа {W and W["N"]}')
        T=W['S']['Товары']; rows=[r for r in T[3:] if r and r[0] and r[0]!='Итого']
        ok(len(rows)==3, f'{tag}: 3 строки товаров ({len(rows)})')
        ap=[r for r in rows if r[4]=='Яблоки' and r[6]==10][0]
        ok(ap[10]==11 and ap[11]==60 and ap[12]==660 and ap[13]==340, f'{tag}: яблоки — куплено 11 × 60 = 660, прибыль 340 ({ap[10:]})')
        gr=[r for r in rows if r[4]=='Груши'][0]; ok(gr[12] in (None,''), f'{tag}: у груш без цены закупка пустая')
        one=[r for r in rows if r[6]==4][0]; ok(one[9]=='Одной суммой', f'{tag}: вторая накладная — «Одной суммой»')
        N=W['S']['Накладные']; nr=[r for r in N[3:] if r and r[0] and r[0]!='Итого']; tot=[r for r in N if r and r[0]=='Итого'][0]
        ok(len(nr)==2 and tot[4]==2400 and tot[5]==660+250, f'{tag}: итог по накладным: выручка 2400, закупка 910 ({tot[4]}, {tot[5]})')
        ok(any('одной суммой' in str(r[11]) for r in nr) and any('нет закупки'!=r[10] and 'частично'==r[10] for r in nr), f'{tag}: статусы и способ записи ({[r[10:] for r in nr]})')
        G=W['S']['Итого по товарам']; g=[r for r in G[3:] if r and r[0]=='Яблоки'][0]; ok(g[2]==11 and g[3]==660 and g[4]==60, f'{tag}: итого яблоки 11 кг на 660 по 60 ({g})')
        ok(await pg.locator('#fd-dcard').count()==0, f'{tag}: окно закрылось после скачивания')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
