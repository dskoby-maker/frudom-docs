"""«Заказ из файла» — несколько готовых документов сразу (счета из банка): каждый файл — своя накладная со своим номером, датой и ценами из файла.
Короткие названия в PDF («Лайм», «Тыква») не теряются; похожее название не подставляется само; «+ Создать новый товар» подставляется во все документы;
сумма сверяется с «Итого к оплате»; повтор номера пропускается; «Сохранить все в журнал». PDF рисуются здесь же (reportlab), pdf.js — PDFJS_DIR. Телефон — PH=1 (на чистом сервере)."""
import asyncio, os, tempfile
from playwright.async_api import async_playwright
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PJ=os.environ.get('PDFJS_DIR','/tmp/pdfjs'); TMP=tempfile.mkdtemp()
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
def money(v): s=f"{v:,.2f}".replace(","," ").replace(".",","); return s
def inv(num, date_words, rows, name):
    p=os.path.join(TMP,name); c=canvas.Canvas(p); c.setFont('DV',9); y=800
    c.drawString(40,y,'АО «ТБанк»   БИК 044525974'); y-=40
    c.setFont('DV',13); c.drawString(40,y,f'Счет на оплату № {num} от {date_words} г.'); c.setFont('DV',9); y-=24
    c.drawString(40,y,'Поставщик: ИП СКОБЁЛКИН ДАНИИЛ ВЛАДИМИРОВИЧ, ИНН 773120115806'); y-=14
    c.drawString(40,y,'Покупатель: АО "ДЕВЕЛОПМЕНТ ЗВЕНИГОРОД", ИНН 5015008227, КПП 501501001'); y-=28
    X=[42,140,330,370,400,460,530]; H=['№','Товары (работы, услуги)','кол-во','Ед.','НДС','Цена','Сумма']
    for x,h in zip(X,H): c.drawCentredString(x if h!='Товары (работы, услуги)' else 150,y,h)
    tot=0
    for i,(n,q,pr) in enumerate(rows,1):
        y-=16; sm=round(q*pr,2); tot+=sm; c.drawString(42,y,str(i)); c.drawString(60,y,n); c.drawRightString(345,y,str(q)); c.drawString(365,y,'кг'); c.drawString(392,y,'10 %'); c.drawRightString(485,y,money(pr)); c.drawRightString(560,y,money(sm))
    y-=24; c.drawString(40,y,f'Всего наименований на сумму {money(tot)} руб.'); c.drawString(360,y,'Итого к оплате:'); c.drawRightString(560,y,money(tot)); c.save(); return p, round(tot,2)
F1,T1=inv(1,'22 сентября 2026',[('Картофель продовольственный',100,27),('Лайм',5.1,299),('Тыквенная смесь новая',2,150)],'s1.pdf')
F2,T2=inv(2,'24 сентября 2026',[('Картофель продовольственный',50,27),('Тыква',22.2,55),('Тыквенная смесь новая',1,150)],'s2.pdf')
F3,_=inv(1,'22 сентября 2026',[('Картофель продовольственный',1,27)],'s3.pdf')   # повтор № 1
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900)] if os.environ.get('PH')!='1' else [(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/pdf.js/*/pdf.min.js', lambda r: r.fulfill(path=PJ+'/pdf.min.js', content_type='text/javascript'))
            await pg.route('**/pdf.js/*/pdf.worker.min.js', lambda r: r.fulfill(path=PJ+'/pdf.worker.min.js', content_type='text/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            W=vw[0]
            # один готовый документ — форма с номером и датой из файла
            await pg.set_input_files('#imp-file',F1); await pg.wait_for_timeout(3500)
            dr=await pg.evaluate("(()=>{const d=__fd.D().draft; return {n:d.number, d:d.date, m:!!d.numManual}})()")
            ok(dr['n']=='1' and dr['d']=='2026-09-22' and dr['m'], f'{W}: один счёт — № 1 от 22.09.2026 из файла {dr}')
            await pg.click('#imp-close')
            # три файла сразу
            await pg.set_input_files('#imp-file',[F2,F1,F3]); await pg.wait_for_timeout(6000)
            M=await pg.evaluate("__fd.D().multi && __fd.D().multi.docs.map(M=>({n:M.dr.number, d:M.dr.date, L:M.dr.lines.map(l=>[l.productId,l.qty,l.price])}))")
            ok(M and len(M)==2 and [x['n'] for x in M]==['1','2'] and [x['d'] for x in M]==['2026-09-22','2026-09-24'], f'{W}: 2 накладные по порядку дат, повтор № 1 пропущен: {[(x["n"],x["d"]) for x in (M or [])]}')
            head=await pg.inner_text('#imp-res'); ok('повторяется в файлах' in head, f'{W}: сказано про повтор номера')
            I=await pg.evaluate("(()=>{const R=__fd.IMP().r; return R.groups.map(g=>({items:g.items.length, miss:g.miss.map(l=>[l.name, l.sug?l.sug.name:'']), price:g.items.map(x=>x.price)}))})()")
            names=[set(n for n,_ in g['miss']) for g in I]
            ok(all(g['items']+len(g['miss'])==3 for g in I), f'{W}: ни одна строка не потерялась (короткие «Лайм», «Тыква» на месте): {I}')
            ok(all('Тыквенная смесь новая' in s for s in names), f'{W}: неизвестный товар — в «не найден»')
            ok('27' in I[0]['price'], f'{W}: цена из файла (27 ₽)')
            # «+ Создать новый товар» — подставляется и во второй документ
            sel=pg.locator('#mul select[data-impmiss]').filter(has=pg.locator('option[value="__new"]')).first
            v=await pg.evaluate("[...document.querySelectorAll('#mul select[data-impmiss]')].findIndex(s=>/Тыквенная смесь/.test(s.closest('.impmiss').textContent))")
            await pg.locator('#mul select[data-impmiss]').nth(v).select_option('__new'); await pg.wait_for_timeout(500)
            I2=await pg.evaluate("__fd.IMP().r.groups.map(g=>g.miss.map(l=>l.name))")
            ok(all('Тыквенная смесь новая' not in g for g in I2), f'{W}: новый товар подставлен в оба документа: {I2}')
            ok(await pg.evaluate("__fd.D().products.filter(p=>p.name==='Тыквенная смесь новая').length")==1, f'{W}: товар создан один раз')
            # «Да, «Тыква продовольственная»» — одним нажатием, цена остаётся из файла
            await pg.locator('#mul [data-impsug]').filter(has_text='Тыква продовольственная').first.click(); await pg.wait_for_timeout(400)
            L2=await pg.evaluate("__fd.D().multi.docs[1].dr.lines.map(l=>[(__fd.D().products.find(p=>p.id===l.productId)||{}).name, l.price])")
            ok(['Тыква продовольственная','55'] in L2, f'{W}: «Да» подставил похожий товар с ценой из файла: {L2}')
            # оставшиеся «не найдены» — создать тоже, чтобы суммы сошлись
            for _ in range(6):
                n=await pg.locator('#mul select[data-impmiss]').count()
                if not n: break
                await pg.locator('#mul select[data-impmiss]').first.select_option('__new'); await pg.wait_for_timeout(400)
            sums=await pg.evaluate("__fd.D().multi.docs.map(M=>__fd.calc(M.dr).t.sum)")
            ok(abs(sums[0]-T1)<0.01 and abs(sums[1]-T2)<0.01, f'{W}: суммы как в файлах {sums} = {[T1,T2]}')
            ok('Сумма сходится с документом' in await pg.inner_text('#mul'), f'{W}: «Сумма сходится с документом ✓»')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: нет прокрутки вбок')
            n0=await pg.evaluate("__fd.D().journal.length")
            await pg.click('#mul-saveall'); await pg.wait_for_timeout(4000)
            J=await pg.evaluate("__fd.D().journal.filter(j=>['1','2'].includes(String(j.number)) && /Звенигород/.test(j.snap.c.name)).map(j=>[String(j.number), j.date])")
            ok(await pg.evaluate("__fd.D().journal.length")==n0+2 and sorted(J)==[['1','2026-09-22'],['2','2026-09-24']], f'{W}: в журнале № 1 и № 2 с датами из файлов: {J}')
            # повторная загрузка тех же файлов — всё пропущено
            await pg.click('#mul-close'); await pg.wait_for_timeout(300)
            await pg.set_input_files('#imp-file',[F1,F2]); await pg.wait_for_timeout(5000)
            ok('уже есть в журнале' in await pg.inner_text('#imp-res'), f'{W}: повторная загрузка — «уже есть в журнале»')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
