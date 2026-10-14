#!/usr/bin/env python3
"""Sirkay Lab – generador de imágenes para LinkedIn (estilo editorial, sin aspecto IA).

Sistema visual derivado de UI/UX Pro Max (estilo "Minimalism & Swiss", patrón
"Trust & Authority", acento solo para lo destacado, sin degradados morados de IA).

Uso:
    python3 render.py spec.json salida.png
spec.json = {"tipo": "dato" | "antes_despues" | "pasos" | "pregunta", ...campos..., "firma": "Sirkay Lab"}
Requiere: playwright (python) con Chromium.
"""
import html
import json
import sys

NAVY = "#0A2540"
ORANGE = "#EB5D2E"
CREAM = "#F7F5F0"
SLATE = "#475569"
LINE = "#E2E1DA"

BASE_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1080px; }}
body {{ font-family:'Inter','Poppins',Arial,sans-serif; -webkit-font-smoothing:antialiased; }}
.canvas {{ width:1080px; height:1080px; padding:96px; position:relative; display:flex; flex-direction:column; }}
.h {{ font-family:'Poppins','Inter',Arial,sans-serif; font-weight:700; letter-spacing:-0.02em; text-wrap:balance; }}
.kicker {{ font-size:22px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; }}
.footer {{ position:absolute; left:96px; right:96px; bottom:72px; display:flex; justify-content:space-between; align-items:center; font-size:22px; }}
.mark {{ display:flex; align-items:center; gap:14px; font-family:'Poppins',sans-serif; font-weight:600; font-size:24px; }}
.logo {{ width:44px; height:44px; border-radius:10px; background:{NAVY}; color:{ORANGE}; display:flex; align-items:center; justify-content:center; font-family:'Poppins',sans-serif; font-weight:700; font-size:28px; }}
.rule {{ width:72px; height:6px; background:{ORANGE}; }}
"""


def e(s):
    return html.escape(str(s or ""))


def footer(spec, dark=False):
    firma = spec.get("firma", "Sirkay Lab")
    fuente = spec.get("fuente", "")
    muted = "rgba(255,255,255,0.6)" if dark else SLATE
    fg = "#FFFFFF" if dark else NAVY
    logo = '<div class="logo">S</div>' if firma == "Sirkay Lab" else ""
    src = f'<span style="color:{muted}">Fuente: {e(fuente)}</span>' if fuente else "<span></span>"
    return f'<div class="footer">{src}<div class="mark" style="color:{fg}">{logo}{e(firma)}</div></div>'


def dato(spec):
    # Tarjeta de estadística: cifra enorme + frase + remate.
    return f"""
<div class="canvas" style="background:{NAVY}; color:#fff; justify-content:center;">
  <div class="kicker" style="color:{ORANGE}; margin-bottom:28px;">{e(spec.get('etiqueta',''))}</div>
  <div class="h" style="font-size:300px; line-height:0.9; color:{ORANGE};">{e(spec['cifra'])}</div>
  <div style="font-size:52px; line-height:1.2; font-weight:500; margin-top:36px; max-width:820px;">{e(spec['frase'])}</div>
  <div class="rule" style="margin:48px 0 28px;"></div>
  <div class="h" style="font-size:38px; line-height:1.25; font-weight:600; color:rgba(255,255,255,0.88); max-width:820px;">{e(spec.get('remate',''))}</div>
  {footer(spec, dark=True)}
</div>"""


def antes_despues(spec):
    def items(lst, color, mark):
        return "".join(
            f'<li style="display:flex; gap:18px; align-items:flex-start; margin-bottom:26px;">'
            f'<span style="color:{color}; font-weight:700; font-size:30px; line-height:1.3;">{mark}</span>'
            f'<span style="font-size:32px; line-height:1.3;">{e(t)}</span></li>' for t in lst)
    return f"""
<div class="canvas" style="background:{CREAM}; color:{NAVY};">
  <div class="h" style="font-size:68px; line-height:1.08; max-width:880px;">{e(spec['titulo'])}</div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:0; margin-top:64px; flex:1; max-height:560px;">
    <div style="padding:44px 40px 0 0; border-right:2px solid {LINE};">
      <div class="kicker" style="color:{SLATE}; margin-bottom:34px;">Antes</div>
      <ul style="list-style:none; color:{SLATE};">{items(spec['antes'], '#9CA3AF', '×')}</ul>
    </div>
    <div style="padding:44px 0 0 40px;">
      <div class="kicker" style="color:{ORANGE}; margin-bottom:34px;">Después</div>
      <ul style="list-style:none; color:{NAVY}; font-weight:500;">{items(spec['despues'], ORANGE, '✓')}</ul>
    </div>
  </div>
  {footer(spec)}
</div>"""


def pasos(spec):
    rows = "".join(
        f'<div style="display:flex; gap:36px; align-items:baseline; padding:30px 0; border-top:2px solid {LINE};">'
        f'<span class="h" style="font-size:56px; color:{ORANGE}; min-width:80px;">{i:02d}</span>'
        f'<span style="font-size:38px; line-height:1.3; font-weight:500;">{e(t)}</span></div>'
        for i, t in enumerate(spec["pasos"], 1))
    return f"""
<div class="canvas" style="background:#FFFFFF; color:{NAVY};">
  <div class="kicker" style="color:{ORANGE}; margin-bottom:24px;">{e(spec.get('etiqueta','Método'))}</div>
  <div class="h" style="font-size:66px; line-height:1.08; max-width:880px; margin-bottom:56px;">{e(spec['titulo'])}</div>
  <div style="border-bottom:2px solid {LINE};">{rows}</div>
  {footer(spec)}
</div>"""


def pregunta(spec):
    return f"""
<div class="canvas" style="background:{CREAM}; color:{NAVY}; justify-content:center;">
  <div class="rule" style="margin-bottom:48px;"></div>
  <div class="h" style="font-size:84px; line-height:1.06; max-width:880px;">{e(spec['pregunta'])}</div>
  <div style="font-size:38px; line-height:1.35; color:{SLATE}; margin-top:44px; max-width:820px;">{e(spec.get('apoyo',''))}</div>
  {footer(spec)}
</div>"""


TIPOS = {"dato": dato, "antes_despues": antes_despues, "pasos": pasos, "pregunta": pregunta}


def build_html(spec):
    body = TIPOS[spec["tipo"]](spec)
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>{body}</body></html>"


def render(spec, out_path):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1080}, device_scale_factor=1)
        page.set_content(build_html(spec), wait_until="networkidle")
        page.screenshot(path=out_path, clip={"x": 0, "y": 0, "width": 1080, "height": 1080})
        browser.close()


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    render(spec, sys.argv[2])
    print(sys.argv[2])
