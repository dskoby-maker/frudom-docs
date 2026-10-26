"""Быстрая проверка: mock-сервер (node dev/test/server.js) + Playwright. Тестовые пароли: Даниил 1111, Наталья 2222, Гриша 3333, Склад 4444."""
import asyncio
from playwright.async_api import async_playwright
TABS=['doc','order','calendar','journal','archive','customers','products','suppliers','data','profit','events','tasks']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vw in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            for t in TABS:
                await pg.evaluate(f"(document.querySelector('nav.tabs button[data-tab=\"{t}\"]')||{{click(){{}}}}).click()"); await pg.wait_for_timeout(250)
            print(vw, 'ошибок:', len(errs), errs[:3]); await pg.close()
        await b.close()
asyncio.run(main())
