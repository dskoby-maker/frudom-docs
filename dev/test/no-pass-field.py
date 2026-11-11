# Поле пароля есть в странице только на экране входа (иначе автозаполнение телефона предлагает почты в поиске товара)
import os
from playwright.sync_api import sync_playwright
URL=os.environ.get("URL","http://localhost:8787/page")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":390,"height":844})
    pg.goto(URL); pg.wait_for_selector('#fd-who [data-who="Даниил"]')
    assert pg.locator('input[type=password]').count()==1, "на входе поле пароля есть"
    pg.click('#fd-who [data-who="Даниил"]'); pg.fill('#fd-pass','1111'); pg.keyboard.press('Enter')
    pg.wait_for_selector('#fd-main:not([hidden])'); pg.wait_for_timeout(800)
    assert pg.locator('input[type=password]').count()==0, "после входа поля пароля нет"
    pg.reload(); pg.wait_for_selector('#fd-main:not([hidden])'); pg.wait_for_timeout(800)
    assert pg.locator('input[type=password]').count()==0, "после перезагрузки поля пароля нет"
    pg.click('#fd-user'); pg.click('#fd-user'); pg.wait_for_selector('#fd-pass', state='visible')
    pg.click('#fd-who [data-who="Наталья"]'); pg.fill('#fd-pass','2222'); pg.keyboard.press('Enter')
    pg.wait_for_selector('#fd-main:not([hidden])'); pg.wait_for_timeout(500)
    assert pg.locator('input[type=password]').count()==0
    print("OK"); b.close()
