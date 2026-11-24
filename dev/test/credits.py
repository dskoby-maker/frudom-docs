"""«Прибыль» → «Долги» → «Кредиты»: кредит с одинаковым платежом и кредитная карта; платёж делится на проценты и долг,
проценты бизнеса — в «Расходы и доходы» («Банк и кредит»), личный — весь платёж «Личное»; напоминание в «Сайт нашёл сам»
и в утреннем уведомлении (Code.gs ≥ 52). Запуск на чистом тестовом сервере. PH=1 — только телефон."""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
fails=[]
N=lambda t:(t or '').replace('\xa0',' ').replace('\u202f',' ')
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def post(d): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/exec', data=json.dumps(d).encode(), method='POST')).read().decode())
def rows(t):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
D2=(datetime.date.today()+datetime.timedelta(days=2)).isoformat()
async def login(b, W):
    ctx=await b.new_context(viewport={'width':W,'height':880}, has_touch=W<500, is_mobile=W<500); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def goCr(pg):
    await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"profit\"]').click()"); await pg.wait_for_timeout(1500)
    await pg.click('#pv-seg [data-pv="debt"]'); await pg.wait_for_timeout(400)
    await pg.click('#mb-sw [data-dbv="credit"]'); await pg.wait_for_timeout(500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in ((390,) if os.environ.get('PH') else (1300,390)):
            ctx,pg,errs=await login(b,W); await goCr(pg)
            ok(await pg.locator('.cr h2').text_content()=='Кредиты', f'{W}: раздел «Кредиты» открыт')
            T=f'Сбер {W}'
            await pg.click('[data-cra="new:loan"]'); await pg.wait_for_selector('#cr-dlg[open]'); await pg.wait_for_timeout(300)
            await pg.fill('#cre-title', T); await pg.fill('#cre-bank','Сбербанк'); await pg.fill('#cre-bal0','500000'); await pg.fill('#cre-rate','12'); await pg.fill('#cre-pmt','20000')
            await pg.fill('#cre-first', D2); await pg.wait_for_timeout(200)
            prev=N(await pg.text_content('#cre-prev')); ok('5 000,00' in prev and 'закончится' in prev, f'{W}: подсказка до сохранения — проценты и когда закончится ({prev.strip()[:110]})')
            await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(700)
            card=pg.locator('.crc', has_text=T); ok(await card.count()==1, f'{W}: кредит появился')
            t=N(await card.text_content()); ok('500 000,00' in t and 'через 2 дня' in t, f'{W}: остаток и ближайший платёж «через 2 дня»')
            await card.locator('[data-cra="op:pay"]').click(); await pg.wait_for_selector('#cr-dlg[open] #cro-pct')
            ok(await pg.input_value('#cro-s')=='20 000' and await pg.input_value('#cro-pct')=='5 000', f'{W}: платёж подставлен 20 000, проценты 5 000')
            await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(700)
            t=N(await card.text_content()); ok('485 000,00' in t, f'{W}: после платежа осталось 485 000')
            po=await pg.evaluate(f"__fd.D().pother.filter(x=>/{T}/.test(x.note)).map(x=>x.kind+'|'+x.sum+'|'+(x.catName||''))")
            ok(po==['Расход|5000|Банк и кредит'], f'{W}: в «Расходы и доходы» — только проценты 5 000 ({po})')
            await card.locator('[data-cra="sched"]').click(); await pg.wait_for_timeout(300)
            ok(await card.locator('.crsch .crsr').count()>20, f'{W}: график платежей раскрылся')
            # удалить платёж — расход убирается
            await card.locator('[data-crdel]').first.click(); await card.locator('[data-crdel]').first.click(); await pg.wait_for_timeout(500)
            ok('500 000,00' in N(await card.text_content()) and not await pg.evaluate(f"__fd.D().pother.some(x=>/{T}/.test(x.note))"), f'{W}: удалили платёж — долг и расходы вернулись')
            # кредитная карта, личная
            C=f'Тинькофф {W}'
            await pg.click('[data-cra="new:card"]'); await pg.wait_for_selector('#cr-dlg[open] #cre-limit'); await pg.wait_for_timeout(300)
            await pg.fill('#cre-title', C); await pg.click('[data-cro="me"]'); await pg.fill('#cre-limit','100000'); await pg.fill('#cre-bal0','30000'); await pg.fill('#cre-rate','34,9')
            await pg.fill('#cre-day', D2[8:]); await pg.fill('#cre-minp','3'); await pg.fill('#cre-minf','500'); await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(700)
            cc=pg.locator('.crc', has_text=C); t=N(await cc.text_content())
            ok('30 000,00' in t and '900,00' in t and 'Личный' in t, f'{W}: карта — долг 30 000, минимум 900, «Личный»')
            ok(await cc.evaluate('e=>e.classList.contains("open")'), f'{W}: новая карта сразу раскрыта')
            await cc.locator('[data-cra="op:spend"]').click(); await pg.fill('#cro-s','5000'); await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(500)
            await cc.locator('[data-cra="op:fee"]').click(); await pg.fill('#cro-s','700'); await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(500)
            await cc.locator('[data-cra="op:cpay"]').click(); await pg.fill('#cro-s','10000'); await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(500)
            t=N(await cc.text_content()); ok('25 700,00' in t and '74 300,00' in t, f'{W}: долг 30000+5000+700−10000 = 25 700, доступно 74 300')
            po=await pg.evaluate(f"__fd.D().pother.filter(x=>/{C}/.test(x.note)).map(x=>x.kind+'|'+x.sum)")
            ok(po==['Личное|700'], f'{W}: проценты личной карты — «Личное» 700 ({po})')
            ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'{W}: нет прокрутки вбок')
            # «Сайт нашёл сам»
            ok(await pg.locator('#mb-sw [data-dbv="credit"] em').count()==1, f'{W}: на «Кредиты» — значок с числом ближайших платежей')
            ok(not errs, f'{W}: без ошибок {errs[:2]}')
            # как в Т-Банке: 700 000, 34,9%, платёж 45 560, 24 платежа 02.12.2026–02.11.2028 (в платёж входит страховка)
            K=f'Т-Банк {W}'
            await pg.click('[data-cra="new:loan"]'); await pg.wait_for_selector('#cr-dlg[open]'); await pg.wait_for_timeout(300)
            await pg.fill('#cre-title', K); await pg.fill('#cre-bal0','1093059,78'); await pg.fill('#cre-sum','700000'); await pg.fill('#cre-rate','34,9'); await pg.fill('#cre-pmt','45560')
            await pg.fill('#cre-first','2026-12-02'); await pg.fill('#cre-end','2028-11-02'); await pg.wait_for_timeout(200)
            prev=N(await pg.text_content('#cre-prev')); ok('сумма всех платежей' in prev, f'{W}: вписали «Всего заплатите» — предупреждение')
            await pg.click('[data-crd="tot"]'); await pg.wait_for_timeout(200)
            ok(await pg.input_value('#cre-bal0')=='700 000', f'{W}: кнопка поставила 700 000')
            prev=N(await pg.text_content('#cre-prev')); ok('2 ноября 2028' in prev and '24 платежа' in prev and 'подогнан' in prev, f'{W}: закончится 2 ноября 2028, 24 платежа ({prev[:160]})')
            await pg.click('[data-crd="save"]'); await pg.wait_for_timeout(700)
            kc=pg.locator('.crc', has_text=K); t=N(await kc.text_content()); ok('2 ноября 2028' in t and 'страховка' in t, f'{W}: на карточке — 2 ноября 2028 и пояснение')
            await pg.wait_for_timeout(2500); await ctx.close()
        ctx,pg,errs=await login(b,1300); await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"tasks\"]').click()"); await pg.wait_for_timeout(4000)
        t=N(await pg.text_content('#tab-tasks')); ok('Платёж по кредиту' in t and 'Сбер ' in t, 'вкладка «Задачи» → «Сайт нашёл сам»: платёж по кредиту через 2 дня')
        await ctx.close()
        R=rows('credits') or rows('Кредиты'); ok(len(R)>=2 and all(r.get('Ближайший платёж') for r in R), f'таблица: лист «Кредиты» — {len(R)} строк, ближайший платёж записан')
        r=post({'key':'1111','user':'Даниил','action':'notes','kinds':'tasks'}); it=[x for x in r.get('items',[]) if x.get('t')=='tasks']
        ok(it and 'Кредиты:' in it[0]['text'], f'сервер: в утреннем уведомлении есть платежи по кредитам ({(it[0]["title"]+" | "+it[0]["text"][:160]) if it else r})')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
