"""Нумерация по договорам (Code.gs ≥ 37): у каждого договора своя серия у одного поставщика и заказчика; без договора — своя;
форма пересчитывает номер при смене договора; таблица не «исправляет» совпадающий номер другого договора, а внутри договора — исправляет."""
import asyncio, os, re, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
        await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
        async def settle():
            for _ in range(25):
                await ev('flush()'); await pg.wait_for_timeout(150)
                if not await ev('flushing||hasPending()'): return
        ok(await ev('numByCtr()'), 'скрипт ≥ 37 — нумерация по договорам включена')
        await ev("""(()=>{ const c=D.customers.find(x=>x.id!=='private-buyer'), s=D.suppliers[0], p=D.products[0]; window.__c=c; window.__s=s; window.__p=p;
          D.contracts.push({id:'kMilk', customerId:c.id, supplierId:s.id, basis:'Договор № 1-МОЛ от 01.12.2025', short:'Молоко'}, {id:'kGlov', customerId:c.id, supplierId:s.id, basis:'Договор № 2-ПЕР от 20.05.2025', short:'Перчатки'});
          dirty('contracts','kMilk'); dirty('contracts','kGlov');
          const mk=(id,n,k,basis)=>{ const dr=Object.assign(newDraft(D),{id, number:String(n), date:'2026-11-0'+n, customerId:c.id, supplierId:s.id, contractId:k, basis, lines:[{productId:p.id, qty:1, price:100}]});
            D.journal.push({id, number:String(n), date:dr.date, customerId:c.id, supplierId:s.id, sum:100, snap:makeSnap(dr)}); dirty('journal',id); };
          mk('nm1',1,'kMilk','Договор № 1-МОЛ от 01.12.2025'); mk('nm2',2,'kGlov','Договор № 2-ПЕР от 20.05.2025'); mk('nm3',3,'kMilk','Договор № 1-МОЛ от 01.12.2025'); mk('nm4',4,'','Договор № 2-ПЕР от 20.05.2025'); })()""")
        await settle()
        ok(await ev("nextNum(__s.id, __c.id, null, null, 'kMilk')")=='4', 'молоко: были № 1 и 3 → следующий № 4')
        ok(await ev("nextNum(__s.id, __c.id, null, null, 'kGlov')")=='5', 'перчатки: № 2 и № 4 (договор найден по основанию) → следующий № 5')
        ok(await ev("nextNum(__s.id, __c.id, null, null, '')")=='1', 'без договора — своя серия с № 1')
        # форма: смена договора меняет номер
        await ev("(()=>{ D.draft=Object.assign(newDraft(D),{supplierId:__s.id, customerId:__c.id, contractId:'kGlov', basis:'Договор № 2-ПЕР от 20.05.2025'}); showTab('doc'); renderDoc(); })()"); await pg.wait_for_timeout(500)
        ok(await pg.input_value('#d-num')=='5', 'форма: договор «Перчатки» → № 5')
        await ev("(()=>{ D.draft.contractId='kMilk'; D.draft.basis='Договор № 1-МОЛ от 01.12.2025'; renderDoc(); })()"); await pg.wait_for_timeout(300)
        ok(await pg.input_value('#d-num')=='4', 'форма: сменили на «Молоко» → № 4')
        ok('Последний по этому договору: № 3' in (await pg.text_content('#d-numinfo')), 'подпись: «Последний по этому договору: № 3»')
        # номер, который есть в другом договоре, не задваивается
        await ev("(()=>{ D.draft.numManual=true; D.draft.number='2'; renderDoc(); })()"); await pg.wait_for_timeout(300)
        ok(not await pg.evaluate("document.querySelector('#d-num').classList.contains('numdup')"), '№ 2 есть только у «Перчаток» — для «Молока» не помечен как повтор')
        await ev("(()=>{ D.draft.number='3'; renderDoc(); })()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('#d-num').classList.contains('numdup')") and 'по этому договору' in (await pg.text_content('#d-numinfo')), '№ 3 уже есть у «Молока» — красное «по этому договору уже есть»')
        # таблица: сохранить молоко № 2 (номер «Перчаток») — остаётся № 2
        cid=await ev('__c.id'); sid=await ev('__s.id')
        r=json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=("""JSON.stringify((()=>{ const c={id:'%s'}, s={id:'%s'};
          const snap=JSON.stringify({dr:{contractId:'kMilk', basis:'', lines:[]}, meta:{}}); return [saveDoc_({id:'nm5', number:'2', date:'2026-11-10', supplierId:s.id, customerId:c.id, sum:1, snap}, {name:'Даниил', admin:true, role:'admin'}),
          saveDoc_({id:'nm6', number:'3', date:'2026-11-10', supplierId:s.id, customerId:c.id, sum:1, snap}, {name:'Даниил', admin:true, role:'admin'})]; })())""" % (cid,sid)).encode(), method='POST')).read().decode())
        r=json.loads(r) if isinstance(r,str) else r
        ok(not r[0].get('conflict'), 'таблица: «Молоко» № 2 сохранён (№ 2 только у «Перчаток»)')
        ok(r[1].get('conflict') and r[1].get('next')==4, f'таблица: «Молоко» № 3 — занят, предложен № 4 ({r[1]})')
        # карточка заказчика: строки по договорам
        await ev("(()=>{ editorSel.customers=__c.id; renderNums(__c.id); })()")
        t=await pg.text_content('#nm-list')
        ok('Договор: Молоко' in t and 'Договор: Перчатки' in t and 'Без договора' not in t, '«Нумерация документов»: строка на каждый договор')
        old=await ev("(()=>{ const v=D.srvVer; D.srvVer=36; const r=[docCk(__c.id,{contractId:'kMilk'}), nextNum(__s.id, __c.id, null, null, docCk(__c.id,{contractId:'kMilk'}))]; D.srvVer=v; return r; })()")
        ok(old[0] is None and old[1]=='5', f'старый скрипт: общая нумерация по заказчику, как раньше ({old})')
        ok(not errs, f'без ошибок {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
