# Conferência da página: sobe uma foto em 1280 e 390 px, claro e escuro; erros de console, rolagem lateral, exportações
# e pedidos para fora do site (a foto não pode sair do aparelho). Capturas em ferramentas/_capturas/.
# Uso: python ferramentas/confere.py [foto]   (padrão: _teste/foto.png, fora do git)
import http.server
import socketserver
import sys
import threading
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "ferramentas" / "_capturas"
PORTA = 4331
BASE = f"http://127.0.0.1:{PORTA}"
# o MediaPipe escreve avisos de inicialização no stderr do wasm, que o Chromium registra como erro de console
RUIDO = ("Created TensorFlow Lite XNNPACK delegate",)


class Servidor(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".mjs": "text/javascript"}

    def log_message(self, *a):
        pass


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # o console do Windows não é UTF-8
    foto = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "_teste" / "foto.png"
    SAIDA.mkdir(exist_ok=True)
    srv = socketserver.TCPServer(("127.0.0.1", PORTA), partial(Servidor, directory=str(RAIZ)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    problemas = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for larg, alt in ((1280, 900), (390, 844)):
            for tema in ("light", "dark"):
                visao = f"{larg}_{tema}"
                ctx = b.new_context(viewport={"width": larg, "height": alt}, color_scheme=tema, accept_downloads=True)
                pg = ctx.new_page()
                erros, fora = [], []
                pg.on("console", lambda m: m.type == "error" and not any(r in m.text for r in RUIDO) and erros.append(m.text))
                pg.on("pageerror", lambda e: erros.append(str(e)))
                pg.on("request", lambda r: not r.url.startswith((BASE, "data:", "blob:")) and fora.append(r.url))
                pg.goto(BASE + "/", wait_until="networkidle")
                pg.wait_for_function("document.querySelector('#arte').textContent.length > 0")
                pg.screenshot(path=str(SAIDA / f"inicio_{visao}.png"), full_page=True)
                pg.set_input_files("#arquivo", str(foto))
                pg.wait_for_function("document.querySelector('#estado').textContent.startsWith('Pronto')", timeout=120000)
                arte = pg.text_content("#arte")
                legenda = pg.text_content("#legenda")
                lat = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                pg.screenshot(path=str(SAIDA / f"foto_{visao}.png"), full_page=True)
                # ajustes: mais colunas mudam a grade
                pg.fill("#colunas", "100")
                pg.dispatch_event("#colunas", "input")
                larga = max(map(len, pg.text_content("#arte").split("\n")))
                pg.fill("#colunas", "60")
                pg.dispatch_event("#colunas", "input")
                # exportações
                with pg.expect_download() as d:
                    pg.click("#txt")
                txt = Path(d.value.path()).read_text(encoding="utf-8")
                with pg.expect_download() as d:
                    pg.click("#png")
                png = Path(d.value.path()).stat().st_size
                d.value.save_as(SAIDA / f"exportado_{visao}.png")
                if larg == 1280 and tema == "light":
                    print("legenda:", legenda, "| 100 colunas →", larga, "| png:", png, "bytes |", d.value.suggested_filename)
                    print(arte)
                if lat > 0 or erros or fora or txt.rstrip("\n") != arte or larga != 100 or png < 5000:
                    problemas.append((visao, {"rolagem": lat, "erros": erros, "fora": fora, "txt_igual": txt.rstrip("\n") == arte,
                                              "colunas_100": larga, "png": png}))
                ctx.close()
        b.close()
    srv.shutdown()
    print("visões: 4; capturas em", SAIDA)
    print("problemas:", problemas or "nenhum")


if __name__ == "__main__":
    main()
