# Gera og.png (1200×630), a imagem de compartilhamento, com o retrato de exemplo. Uso: python ferramentas/og.py
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
F = lambda nome: (RAIZ / "fontes" / nome).as_uri()


def main():
    arte = json.loads((RAIZ / "exemplo.json").read_text(encoding="utf-8"))["escuro"]
    arte = arte.replace("&", "&amp;").replace("<", "&lt;")
    html = f"""<!doctype html><meta charset="utf-8"><style>
@font-face {{ font-family: A; src: url({F("archivo-latin-wdth-normal.woff2")}); font-weight: 100 900; font-stretch: 62% 125%; }}
@font-face {{ font-family: S; src: url({F("source-sans-3-latin-wght-normal.woff2")}); font-weight: 200 900; }}
@font-face {{ font-family: M; src: url({F("ibm-plex-mono-latin-500-normal.woff2")}); font-weight: 500; }}
@font-face {{ font-family: P; src: url({F("ibm-plex-mono-latin-400-normal.woff2")}); }}
html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #f6f7f9; color: #14171c; }}
.c {{ box-sizing: border-box; height: 630px; display: grid; grid-template-columns: 1fr 520px; border-left: 18px solid #0f8a7e; }}
.t {{ padding: 72px 40px 64px 66px; display: grid; grid-template-rows: auto auto 1fr auto; gap: 26px; }}
h1 {{ margin: 0; font: 850 104px/0.92 A; font-stretch: 72%; letter-spacing: -.005em; word-spacing: .06em; }}
p {{ margin: 0; font: 400 32px/1.35 S; color: #4a505b; }}
.pe {{ font: 500 24px/1 M; letter-spacing: .06em; text-transform: uppercase; color: #0f8a7e; }}
.a {{ background: #191c21; display: grid; place-items: center; }}
pre {{ margin: 0; font: 400 12px/1.2 P; color: #eceef2; }}
</style><div class="c"><div class="t"><h1>Retrato<br>em ASCII</h1>
<p>Sua foto desenhada com caracteres. Roda no navegador: a foto não sai do aparelho.</p><span></span>
<span class="pe">dalmolin.dev/retrato-ascii</span></div><div class="a"><pre>{arte}</pre></div></div>"""
    tmp = RAIZ / "ferramentas" / "_og.html"
    tmp.write_text(html, encoding="utf-8")
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1200, "height": 630})
            pg.goto(tmp.as_uri())
            pg.evaluate("document.fonts.ready.then(() => 1)")
            pg.screenshot(path=str(RAIZ / "og.png"))
            b.close()
    finally:
        tmp.unlink()
    print("og.png")


if __name__ == "__main__":
    main()
