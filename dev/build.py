#!/usr/bin/env python3
"""Сборка: dev/src/* -> dev/out/tilda-block.html (полная страница), dev/out/b.js (для node --check), dev/out/test.html (для тестов с mock-сервером)."""
import re, os, json
H=os.path.dirname(os.path.abspath(__file__)); S=H+'/src/'; O=H+'/out/'; os.makedirs(O, exist_ok=True)
rd=lambda f: open(S+f, encoding='utf-8').read()
app=rd('app.html').replace('</style>', rd('purchase_layout.css')+rd('product_prices.css')+'</style>', 1)
fmt=re.sub(r'function todayISO\(\)\{[^\n]*\n','',rd('fmt_seg.js'))
app=app.replace('/*__SYNC_GUARD__*/',rd('sync_guard.js'))
app=app.replace('/*__EIS__*/',rd('vendor/jszip.js')+'\n'+rd('vendor/streebog.js')+'\n'+rd('eis.js')+'\n'+rd('eis_ui.js'))
app=app.replace('/*__DOC_CSS__*/',rd('doc_css.css')).replace('/*__SEED__*/',rd('seed_seg.js')).replace('/*__FMT__*/',fmt).replace('/*__DOCS__*/',rd('docs_seg.js')).replace('/*__UNDO__*/',rd('undo_seg.js')).replace('/*__STOCK__*/',rd('stock_seg.js')+'\n'+rd('decl_seg.js')+'\n'+rd('cats_seg.js')+'\n'+rd('ai_seg.js')+'\n'+rd('inv_seg.js')+'\n'+rd('zkp_seg.js')+'\n'+rd('pcd_seg.js')+'\n'+rd('pdl_seg.js')).replace('/*__AKT__*/',rd('akt_seg.js')).replace('/*__PFV__*/',rd('pfv_seg.js')+'\n'+rd('bank_seg.js').replace('/*__TBPROXY__*/""', json.dumps(open(H+'/tbank-proxy/index.js',encoding='utf-8').read(), ensure_ascii=False).replace('</','<\\/')))
URL='https://script.google.com/macros/s/AKfycbwxMSXtEh7Ot76NnWqajA7f3klhACrJ2q8-EomjCoWu5baRHXWpPudojjkvQRYpv58m/exec'
app=app.replace('const API_URL = "";','const API_URL = "'+URL+'";')
open(O+'tilda-block.html','w',encoding='utf-8').write(app)
open(O+'b.js','w',encoding='utf-8').write(re.search(r'<script>(.*)</script>',app,re.S).group(1))
open(O+'test.html','w',encoding='utf-8').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>t</title></head><body style="margin:0">'+app.replace(URL,'http://localhost:8787/exec')+'</body></html>')
print('ok', len(app))
