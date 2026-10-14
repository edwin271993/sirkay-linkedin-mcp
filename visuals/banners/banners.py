"""Banners de LinkedIn con el trazo Sirkay. Uso: python3 banners/banners.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from render import NAVY, ORANGE, TRAZO, BASE_CSS
from playwright.sync_api import sync_playwright

def trazo_svg(w, stroke=7):
    # Escala el trazo al ancho pedido manteniendo el enredo inicial y alargando la recta.
    return (f'<svg width="{w}" height="88" viewBox="0 0 {w} 88" style="display:block;">'
            f'<path d="{TRAZO.replace("L870,44", f"L{w-18},44")}" fill="none" stroke="{ORANGE}" stroke-width="{stroke}" '
            f'stroke-linecap="round" stroke-linejoin="round"/><rect x="{w-22}" y="35" width="18" height="18" fill="{ORANGE}"/></svg>')

CSS = BASE_CSS.replace("width:1080px; height:1080px;", "")

perfil = f"""<div style="width:1584px; height:396px; background:{NAVY}; position:relative; overflow:hidden; font-family:Inter,sans-serif;">
  <div style="position:absolute; left:560px; right:96px; top:70px; color:#fff;">
    <div class="h" style="font-size:58px; line-height:1.08;">Primero el proceso.<br>Después la tecnología.</div>
    <div style="font-size:26px; color:rgba(255,255,255,0.78); margin-top:20px; max-width:860px;">Software a medida, agentes de IA y mejora de procesos para mypes.</div>
  </div>
  <div style="position:absolute; left:560px; bottom:60px;">{trazo_svg(780)}</div>
  <div style="position:absolute; right:96px; bottom:84px; display:flex; align-items:center; gap:14px; color:#fff; font-family:Poppins; font-weight:600; font-size:24px;">
    <div class="logo" style="background:{ORANGE}; color:{NAVY};">S</div>Sirkay Lab</div>
</div>"""

pagina = f"""<div style="width:1128px; height:191px; background:{NAVY}; position:relative; overflow:hidden;">
  <div style="position:absolute; left:300px; top:34px; color:#fff;">
    <div class="h" style="font-size:36px; line-height:1.1;">Primero el proceso. Después la tecnología.</div>
    <div style="font-size:18px; color:rgba(255,255,255,0.78); margin-top:10px;">Software a medida, agentes de IA y mejora de procesos para mypes.</div>
  </div>
  <div style="position:absolute; left:300px; bottom:10px; transform:scale(0.75); transform-origin:left bottom;">{trazo_svg(980, 8)}</div>
</div>"""

out = os.path.dirname(os.path.abspath(__file__))
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, body, w, h in [("banner-perfil-1584x396.png", perfil, 1584, 396), ("banner-pagina-sirkay-1128x191.png", pagina, 1128, 191)]:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.set_content(f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS} body{{margin:0}}</style></head><body>{body}</body></html>")
        pg.screenshot(path=os.path.join(out, name), clip={"x":0,"y":0,"width":w,"height":h})
    b.close()
print("ok")
