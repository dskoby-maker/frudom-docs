# Цифра у «Поступления» = «нужно решить» за выбранный месяц
import os, json, urllib.request
from playwright.sync_api import sync_playwright
P=os.environ.get("PORT","8787"); U=f"http://localhost:{P}"
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900})
    pg.goto(U+"/page"); pg.wait_for_timeout(800); pg.click('#fd-who [data-who="Даниил"]'); pg.fill("#fd-pass","1111"); pg.click("#fd-enter"); pg.wait_for_timeout(2500)
    r=pg.evaluate("""()=>{ const D=__fd.D(); D.bank=D.bank||{}; const B=D.bank; const t=new Date(), m=t.toISOString().slice(0,7);
      const mk=(id,d,st)=>({id,date:d,status:st,sum:100,payer:"X",payerInn:"7700000000",supplierId:""});
      B.ops=[mk("a",m+"-02","wait"),mk("b",m+"-03","wait"),mk("c","2025-01-05","wait"),mk("d","2025-02-05","wait"),mk("e",m+"-04","done")];
      return 1 }""")
    pg.click('nav.tabs [data-tab="profit"]'); pg.wait_for_timeout(1500)
    pg.click('#pv-seg [data-pv="bank"]'); pg.wait_for_timeout(1000)
    n=pg.text_content("#pv-bkn"); leg=pg.evaluate("(document.querySelector('.bncal .zkc-leg')||document.querySelector('#pv-bank')).textContent")
    print("badge",n)
    assert n=="2", n
    print("ok")
    b.close()
