# Новый товар в строке документа: выбор единицы стоит на своём месте и не наезжает на количество; все поля с autocomplete
import os, time
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H in [(390,844),(1300,900)]:
        pg=b.new_page(viewport={"width":W,"height":H})
        pg.goto('http://localhost:8787/page'); pg.click('#fd-who [data-who="Даниил"]'); pg.fill('#fd-pass','1111'); pg.click('#fd-enter'); pg.wait_for_timeout(2500)
        pg.evaluate('location.hash="#dokument"'); pg.wait_for_timeout(800)
        ps=pg.locator('#tab-doc .line .ps').last; ps.click(); ps.press_sequentially('Новинка'+str(int(time.time()*1000))[-6:]); pg.wait_for_timeout(600)
        pg.click('[data-psnew]'); pg.wait_for_timeout(600)
        line=pg.locator('#tab-doc .line').filter(has=pg.locator('select.unit')).first
        q=line.locator('.qty').bounding_box(); u=line.locator('select.unit').bounding_box()
        ov = not (u['x']+u['width']<=q['x']+1 or q['x']+q['width']<=u['x']+1 or u['y']+u['height']<=q['y']+1 or q['y']+q['height']<=u['y']+1)
        print(W, 'qty',q,'unit',u,'overlap',ov)
        assert not ov, "выбор единицы наезжает на количество"
        bad=pg.evaluate('''()=>[...document.querySelectorAll('#fd-app input:not([type=hidden]):not([type=password]),#fd-app textarea')].filter(e=>!e.hasAttribute('autocomplete')).length''')
        assert bad==0, bad
        assert pg.evaluate('document.documentElement.scrollWidth')==W
        if W==390: line.screenshot(path='/tmp/newunit.png')
    print("OK"); b.close()
