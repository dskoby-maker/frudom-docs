"""Иконка приложения «Почта ФД»: конверт с оранжевой «печатью»-жёлудем (как в логотипе «Фруктовый Дом») на сине-зелёном фоне.
Рисуется вектором и сохраняется во всех размерах Android: python3 icon.py [папка для icon-1024.png]"""
import asyncio, os, sys
from playwright.async_api import async_playwright
H=os.path.dirname(os.path.abspath(__file__)); RES=os.path.join(H,'..','app','src','main','res')
DEFS='''<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2C6E80"/><stop offset="1" stop-color="#14394A"/></linearGradient>
 <linearGradient id="pp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EDE7DF"/></linearGradient>
</defs>'''
BG='<rect width="108" height="108" fill="url(#bg)"/>'
ORANGE='#F0A64E'
def acorn(c, k=0.34, x=54, y=60):
    # жёлудь из логотипа, уменьшенный и поставленный «печатью» на конверт
    return f'''<g transform="translate({x} {y}) scale({k}) translate(-54 -52)">
<path d="M54 34.5C66.5 34.5 76.5 42.5 76.5 53.5C76.5 66 67 75.5 54 82C41 75.5 31.5 66 31.5 53.5C31.5 42.5 41.5 34.5 54 34.5Z" fill="none" stroke="{c}" stroke-width="7.5" stroke-linejoin="round"/>
<path d="M54 35C51.6 31.2 52.2 25.8 58.6 22.4C60.2 27.6 58.6 32 54 35Z" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"/>
<path d="M32.5 54.5C39 48 47 45.6 54 45.6C61 45.6 69 48 75.5 54.5L75.5 61C69 55.4 61 53 54 53C47 53 39 55.4 32.5 61Z" fill="{c}"/></g>'''
def fg(mono=False):
    if mono:
        return '''<rect x="31" y="37" width="46" height="34" rx="5" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round"/>
<path d="M33 40L54 57L75 40" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>'''
    return f'''<g filter="url(#sh)"><rect x="30" y="36" width="48" height="36" rx="5.5" fill="url(#pp)"/></g>
<path d="M32 39.5L54 56.5L76 39.5" fill="none" stroke="#C9BFB3" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="54" cy="57.5" r="10.2" fill="{ORANGE}"/>{acorn('#fff', 0.235, 54, 57.6)}'''
SH='<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#06202A" flood-opacity="0.35"/></filter></defs>'
def svg(body, vb='0 0 108 108'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="100%" height="100%">{DEFS}{SH}{body}</svg>'
LAYERS={'background':svg(BG),'foreground':svg(fg()),'monochrome':svg(fg(True))}
LEG=svg(f'<clipPath id="c"><rect x="14" y="14" width="80" height="80" rx="18"/></clipPath><g clip-path="url(#c)">{BG}{fg()}</g>','14 14 80 80')
RND=svg(f'<clipPath id="c"><circle cx="54" cy="54" r="40"/></clipPath><g clip-path="url(#c)">{BG}{fg()}</g>','14 14 80 80')
D={'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
async def shot(pg, s, size, path):
    await pg.set_viewport_size({'width':size,'height':size})
    await pg.set_content(f'<html><body style="margin:0;background:transparent">{s}</body></html>')
    os.makedirs(os.path.dirname(path), exist_ok=True); await pg.screenshot(path=path, omit_background=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        for d,k in D.items():
            for n,s in LAYERS.items(): await shot(pg, s, int(108*k), f'{RES}/mipmap-{d}/ic_launcher_{n}.png')
            await shot(pg, LEG, int(48*k), f'{RES}/mipmap-{d}/ic_launcher.png')
            await shot(pg, RND, int(48*k), f'{RES}/mipmap-{d}/ic_launcher_round.png')
        out=sys.argv[1] if len(sys.argv)>1 else H
        await shot(pg, LEG, 512, f'{out}/icon-512.png')
        await b.close()
asyncio.run(main())
