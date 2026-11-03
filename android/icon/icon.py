"""Иконка приложения «Документы ФД»: рисуется вектором и сохраняется во всех размерах Android (python3 icon.py)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
H=os.path.dirname(os.path.abspath(__file__)); RES=os.path.join(H,'..','app','src','main','res')
DEFS='''<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9A4377"/><stop offset=".55" stop-color="#6A2C4E"/><stop offset="1" stop-color="#43152F"/></linearGradient>
 <radialGradient id="glow" cx=".28" cy=".18" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3ECF0"/></linearGradient>
 <linearGradient id="fold" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#E9D6E1"/><stop offset="1" stop-color="#D4B6C7"/></linearGradient>
 <linearGradient id="leafbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5BD08A"/><stop offset="1" stop-color="#1F8A4C"/></linearGradient>
 <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="2.2" flood-color="#200818" flood-opacity=".38"/></filter>
 <filter id="sh2" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#0b2a17" flood-opacity=".35"/></filter>
</defs>'''
BG='<rect width="108" height="108" fill="url(#bg)"/><rect width="108" height="108" fill="url(#glow)"/>'
def fg(mono=False):
    W='#fff'
    paper= W if mono else 'url(#paper)'
    doc=f'''<g {'' if mono else 'filter="url(#sh)"'}>
  <path d="M35.5 25h27l11 11v41.5a3.5 3.5 0 0 1-3.5 3.5h-34.5a3.5 3.5 0 0 1-3.5-3.5v-49a3.5 3.5 0 0 1 3.5-3.5z" fill="{paper}"/>
  {'' if mono else '<path d="M62.5 25l11 11h-8a3 3 0 0 1-3-3z" fill="url(#fold)"/>'}
</g>'''
    if mono:   # силуэт для тематических иконок Android 13+: вырезаем буквы и линии
        return f'''<mask id="m"><rect width="108" height="108" fill="#fff"/>
  <path d="M62.5 25l11 11h-8a3 3 0 0 1-3-3z" fill="#000"/>
  <text x="50.5" y="51.5" text-anchor="middle" font-family="Inter" font-weight="800" font-size="16.5" letter-spacing="-.3" fill="#000">ФД</text>
  <rect x="38" y="58" width="25" height="2.6" rx="1.3" fill="#000"/><rect x="38" y="63.4" width="19" height="2.6" rx="1.3" fill="#000"/><rect x="38" y="68.8" width="15" height="2.6" rx="1.3" fill="#000"/>
  <circle cx="71" cy="71" r="14.2" fill="#000"/></mask>
  <g mask="url(#m)">{doc}</g>
  <circle cx="71" cy="71" r="11.6" fill="#fff"/>
  <g transform="translate(71 71.6) rotate(38)"><path d="M0-8.2C5.8-4.8 5.8 3.4 0 6.8-5.8 3.4-5.8-4.8 0-8.2z" fill="#000"/></g>'''
    return f'''{doc}
<text x="50.5" y="51.5" text-anchor="middle" font-family="Inter" font-weight="800" font-size="16.5" letter-spacing="-.3" fill="#6A2C4E">ФД</text>
<rect x="38" y="58" width="25" height="2.6" rx="1.3" fill="#D9C2D0"/><rect x="38" y="63.4" width="19" height="2.6" rx="1.3" fill="#D9C2D0"/><rect x="38" y="68.8" width="15" height="2.6" rx="1.3" fill="#D9C2D0"/>
<g filter="url(#sh2)"><circle cx="71" cy="71" r="13.4" fill="#fff"/><circle cx="71" cy="71" r="11.4" fill="url(#leafbg)"/></g>
<g transform="translate(71 71.6) rotate(38)">
  <path d="M0-8.2C5.8-4.8 5.8 3.4 0 6.8-5.8 3.4-5.8-4.8 0-8.2z" fill="#fff"/>
  <path d="M0-5.6V9.4" stroke="#24914F" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M0-1.2l1.9-1.8M0 2.2l2.2-2M0-1.2l-1.9-1.8M0 2.2l-2.2-2" stroke="#24914F" stroke-width=".85" stroke-linecap="round"/>
</g>'''
def svg(body, vb='0 0 108 108'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="100%" height="100%">{DEFS}{body}</svg>'
LAYERS={'background':svg(BG),'foreground':svg(fg()),'monochrome':svg(fg(True))}
# обычная иконка (старые Android и для показа): квадрат со скруглением / круг, содержимое крупнее (обрезаем поля 108→80)
LEG=svg(f'<clipPath id="c"><rect x="14" y="14" width="80" height="80" rx="18"/></clipPath><g clip-path="url(#c)">{BG}{fg()}</g>','14 14 80 80')
RND=svg(f'<clipPath id="c"><circle cx="54" cy="54" r="40"/></clipPath><g clip-path="url(#c)">{BG}{fg()}</g>','14 14 80 80')
FULL=svg(BG+fg())
D={'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
async def shot(pg, s, size, path):
    await pg.set_viewport_size({'width':size,'height':size})
    await pg.set_content(f'<html><body style="margin:0;background:transparent">{s}</body></html>'); await pg.evaluate('document.fonts.ready')
    os.makedirs(os.path.dirname(path), exist_ok=True); await pg.screenshot(path=path, omit_background=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        for d,k in D.items():
            for n,s in LAYERS.items(): await shot(pg, s, int(108*k), f'{RES}/mipmap-{d}/ic_launcher_{n}.png')
            await shot(pg, LEG, int(48*k), f'{RES}/mipmap-{d}/ic_launcher.png')
            await shot(pg, RND, int(48*k), f'{RES}/mipmap-{d}/ic_launcher_round.png')
        out=sys.argv[1] if len(sys.argv)>1 else H
        await shot(pg, LEG, 1024, f'{out}/icon-1024.png'); await shot(pg, FULL, 1024, f'{out}/icon-full-1024.png'); await shot(pg, RND, 512, f'{out}/icon-round-512.png')
        await b.close()
asyncio.run(main())
