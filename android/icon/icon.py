"""Иконка приложения «Документы ФД»: рисуется вектором и сохраняется во всех размерах Android (python3 icon.py)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
H=os.path.dirname(os.path.abspath(__file__)); RES=os.path.join(H,'..','app','src','main','res')
# жёлудь из логотипа «Фруктовый Дом» (08.11.2026): оранжевый контур на сливовом фоне, минимализм
DEFS='''<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A3560"/><stop offset="1" stop-color="#4A1C36"/></linearGradient>
</defs>'''
BG='<rect width="108" height="108" fill="url(#bg)"/>'
ORANGE='#F0A64E'
def acorn(c):
    return f'''<path d="M54 34.5C66.5 34.5 76.5 42.5 76.5 53.5C76.5 66 67 75.5 54 82C41 75.5 31.5 66 31.5 53.5C31.5 42.5 41.5 34.5 54 34.5Z" fill="none" stroke="{c}" stroke-width="6.4" stroke-linejoin="round"/>
<path d="M54 35C51.6 31.2 52.2 25.8 58.6 22.4C60.2 27.6 58.6 32 54 35Z" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"/>
<path d="M32.5 54.5C39 48 47 45.6 54 45.6C61 45.6 69 48 75.5 54.5L75.5 61C69 55.4 61 53 54 53C47 53 39 55.4 32.5 61Z" fill="{c}"/>'''
def fg(mono=False): return acorn('#fff' if mono else ORANGE)
def svg(body, vb='0 0 108 108'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="100%" height="100%">{DEFS}{body}</svg>'
LAYERS={'background':svg(BG),'foreground':svg(fg()),'monochrome':svg(fg(True))}
# обычная иконка (старые Android и для показа): квадрат со скруглением / круг, содержимое крупнее (обрезаем поля 108→80)
LEG=svg(f'<clipPath id="c"><rect x="14" y="14" width="80" height="80" rx="18"/></clipPath><g clip-path="url(#c)">{BG}{fg()}</g>','14 14 80 80')
RND=svg(f'<clipPath id="c"><circle cx="54" cy="54" r="40"/></clipPath><g clip-path="url(#c)">{BG}{fg()}</g>','14 14 80 80')
FULL=svg(BG+fg())
SQ=svg(BG+fg(),'14 14 80 80')   # для iPhone: квадрат без скругления (углы скругляет сам iPhone)
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
        await shot(pg, LEG, 1024, f'{out}/icon-1024.png')
        if len(sys.argv)>2:   # иконки сайта (корень репозитория): python3 icon.py <папка> <корень>
            R=sys.argv[2]
            for n,z in (('icon-192.png',192),('icon-512.png',512),('apple-touch-icon.png',180),('favicon.png',48)): await shot(pg, SQ if n=='apple-touch-icon.png' else RND if n=='favicon.png' else LEG, z, f'{R}/{n}')
            await shot(pg, FULL, 512, f'{R}/icon-maskable-512.png'); await shot(pg, FULL, 1024, f'{out}/icon-full-1024.png'); await shot(pg, RND, 512, f'{out}/icon-round-512.png')
        await b.close()
asyncio.run(main())
