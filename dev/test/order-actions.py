# «Заявка»: сначала «Сохранить в журнал», ниже «Что скачать» с галочками и кнопкой
import os
from playwright.sync_api import sync_playwright
PH=os.environ.get("PH")=="1"; W,H=(390,844) if PH else (1300,900)
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
with sync_playwright() as p:
  b=p.chromium.launch(); pg=b.new_page(viewport={"width":W,"height":H}); errs=[]
  pg.on("pageerror",lambda e:errs.append(str(e)))
  pg.goto("http://localhost:8787/page"); pg.click('#fd-who [data-who="Даниил"]'); pg.fill("#fd-pass","1111"); pg.click("#fd-enter")
  pg.wait_for_timeout(2500)
  if PH: pg.evaluate("location.hash='#zayavka'")
  else: pg.evaluate(TAB+"('order')")
  pg.wait_for_timeout(1200)
  r=pg.evaluate("""()=>{const s=document.querySelector('#o-save').getBoundingClientRect(), h=document.querySelector('.oact-dl h2').getBoundingClientRect(), g=document.querySelector('#o-go').getBoundingClientRect(), k=document.querySelector('#o-k-upd').closest('label').getBoundingClientRect();
   return {save:document.querySelector('#o-save').textContent, go:document.querySelector('#o-go').textContent, order:s.bottom<=h.top, row: g.top>=k.bottom-2 && Math.abs(g.left-document.querySelector('#o-k-invoice').closest('label').getBoundingClientRect().left)<3 && Math.abs(g.left-s.left)<3, sw:document.documentElement.scrollWidth, iw:innerWidth}}""".replace("PH",str(PH).lower()))
  print(r)
  assert r["save"]=="Сохранить в журнал" and r["go"]=="Сохранить и скачать PDF", r
  assert r["order"] and r["row"] and r["sw"]==r["iw"], r
  pg.locator(".oact").scroll_into_view_if_needed(); pg.locator(".oact").screenshot(path="/tmp/oact%s.png"%("-ph" if PH else ""))
  assert not errs, errs
  print("OK")
