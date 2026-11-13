"""ID СТЕ МОК Талалихина из подписанных УПД (patchMokSte): ставятся в пустые поля «СТЕ» и уходят в таблицу; вписанное раньше не затирается."""
import asyncio, os, re, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
        await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
        await ev("""(()=>{ if(!D.customers.find(c=>c.id==='i2sssar0')) { D.customers.push({id:'i2sssar0', name:'ГАПОУ МОК им. В. Талалихина', inn:'7723920242'}); dirty('customers','i2sssar0'); }
          MOK_STE.forEach(([pid])=>{ if(!prod(pid)) { D.products.push({id:pid, name:'Товар '+pid, unit:'кг'}); dirty('products',pid); } });
          D.specs['i2sssar0']={'cnmx92eg':{spec:'777', ste:'111', art:'A'}}; dirtySpec('i2sssar0','cnmx92eg'); patchMokSte(); })()""")
        for _ in range(20):
            await ev('flush()'); await pg.wait_for_timeout(150)
            if not await ev('hasPending()'): break
        rows=json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=b"JSON.stringify(read_('specs').filter(r=>r.customerId==='i2sssar0'))", method='POST')).read().decode())
        rows=json.loads(rows) if isinstance(rows,str) else rows
        st={r['productId']:r for r in rows}
        ok(st.get('10iyh8dj',{}).get('ste')=='46360446', 'груши: СТЕ 46360446 записан в таблицу')
        ok(st.get('mgd8sl91',{}).get('ste')=='36058953', 'голубика: СТЕ 36058953')
        ok(st.get('cnmx92eg',{}).get('ste')=='111' and st['cnmx92eg'].get('spec')=='777', 'петрушка: вписанное раньше не затёрто')
        ok(len(rows)==12, f'всего строк МОК: {len(rows)} (12 товаров)')
        n=await ev("(patchMokSte(), pend.specs.size)"); ok(n==0, 'повторный запуск ничего не меняет')
        # ID спецификации по выгрузке Портала: одинаковая цена 164,65 у «Айсберга» и «Яблок (поз. 42)» — различаются по названию
        r=await ev("""(()=>{ const cid='i2sssar0'; D.prices[cid]=D.prices[cid]||{};
          [['ms1','Салат овощной Айсберг',164.65],['ms2','Яблоки (поз. 42 спецификации № 5-2026)',164.65],['ms3','Яблоки (поз. 43 спецификации № 5-2026)',151.3],['ms4','Яблоки (поз. 25 спецификации № 5-2026)',156.64]].forEach(([id,n,pr])=>{ D.products.push({id, name:n, unit:'кг'}); dirty('products',id); D.prices[cid][id]=String(pr); dirtyPrice(cid,id); });
          patchMokSpec(); const m=D.specs[cid]; return ['ms1','ms2','ms3','ms4'].map(k=>(m[k]||{}).spec||''); })()""")
        ok(r==['905837023','905837034','905837035','905837017'], f'ID спецификации: айсберг, яблоки поз. 42/43/25 — {r}')
        ok(await ev("(()=>{ const x=D.specs['i2sssar0']; x.ms1.spec='999'; patchMokSpec(); return x.ms1.spec; })()")=='999', 'вписанное руками ID спецификации не затирается')
        # СТЕ из отправленного УПД № 196 заменяют старые; ID ЭДО МОК
        r=await ev("""(()=>{ const cid='i2sssar0', m=D.specs[cid]; m.ms5={spec:'905836998', ste:'36058953', art:''}; m.ms6={spec:'905837003', ste:'777', art:''}; m.ms7={spec:'905837001', ste:'', art:''};
          D.customers.find(c=>c.id===cid).edo=''; patchMokSte2(); return [m.ms5.ste, m.ms6.ste, m.ms7.ste, D.customers.find(c=>c.id===cid).edo]; })()""")
        ok(r==['36056516','777','46376107','2AEC5B4501D-A896-446B-B5D0-BB545760B939'], f'СТЕ из УПД № 196: старый заменён, вписанный руками не тронут, пустой заполнен; ID ЭДО МОК — {r}')
        SENT=os.environ.get('PPSENT','')
        if SENT:
            b64=__import__('base64').b64encode(open(SENT,'rb').read()).decode()
            r=await ev("""(async()=>{ const cid='i2sssar0', m=D.specs[cid]; m.ms6.ste='1'; m.ms8={spec:'905837008', ste:'', art:''};
              const f=new File([Uint8Array.from(atob('%s'),c=>c.charCodeAt(0))],'upd.xml'); const x=await learnFromSentXml(cid,f); return [m.ms6.ste, m.ms8.ste, x.msg]; })()""" % b64)
            ok(r[0]=='39123587' and r[1]=='35235034', f'«Сопоставить с Порталом» → XML отправленного УПД 5.03: СТЕ записаны ({r})')
        ok(not errs, f'без ошибок {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
