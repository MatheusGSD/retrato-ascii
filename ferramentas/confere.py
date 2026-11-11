# Conferência da página: sobe uma foto em 1280 e 390 px (claro e escuro) e em 1440 × 709 a 2x no escuro (a tela do autor);
# erros de console, rolagem lateral, exportações e pedidos para fora do site (a foto não pode sair do aparelho). Em Letras:
# cada estilo exporta e desenha, os prontos e a caixa de texto mudam o retrato, a lista não alarga a coluna, a aba da IA
# explica que este navegador não tem o Gemini Nano (o Chromium do Playwright não tem a Prompt API) e, no computador, a
# prévia continua inteira na tela depois de rolar os ajustes. Capturas em ferramentas/_capturas/.
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
# Prompt API falsa, para conferir o fluxo da escrita com IA (o Chromium do Playwright não tem o Gemini Nano): o modelo
# começa "por baixar", o download avisa o progresso e o texto chega em pedaços, como no Chrome
# sem WebGPU, para o resultado não depender da máquina: Gemma e LFM3 aparecem como indisponíveis (os dois se conferem
# num Chrome de verdade, com placa de vídeo, em _teste/confere_modelos_web.py, fora do git)
SEM_WEBGPU = "Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });"
IA_FALSA = """
window.LanguageModel = {
  async availability() { return localStorage.getItem('teste:modelo') === 'baixado' ? 'available' : 'downloadable'; },
  async create(opcoes) {
    const alvo = new EventTarget();
    opcoes?.monitor?.(alvo);
    for (const loaded of [0, 0.5, 1]) { await new Promise((r) => setTimeout(r, 80)); alvo.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded })); }
    localStorage.setItem('teste:modelo', 'baixado');
    const sessao = {
      async clone() { return sessao; },
      promptStreaming() { return (async function* () { for (const p of ['Texto ', 'de teste ', 'da IA.']) { await new Promise((r) => setTimeout(r, 60)); yield p; } })(); },
      destroy() {},
    };
    return sessao;
  },
};
"""


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
        visoes = [(1280, 900, "light", 1), (1280, 900, "dark", 1), (390, 844, "light", 1), (390, 844, "dark", 1), (1440, 709, "dark", 2)]
        for larg, alt, tema, dpr in visoes:
                visao = f"{larg}x{alt}_{tema}"
                ctx = b.new_context(viewport={"width": larg, "height": alt}, color_scheme=tema, device_scale_factor=dpr, accept_downloads=True)
                ctx.add_init_script(SEM_WEBGPU)
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
                if visao == "1280x900_light":
                    print("legenda:", legenda, "| 100 colunas →", larga, "| png:", png, "bytes |", d.value.suggested_filename)
                    print(arte)
                if lat > 0 or erros or fora or txt.rstrip("\n") != arte or larga != 100 or png < 5000:
                    problemas.append((visao, {"rolagem": lat, "erros": erros, "fora": fora, "txt_igual": txt.rstrip("\n") == arte,
                                              "colunas_100": larga, "png": png}))
                # Letras: 100 colunas, cada estilo exporta; os de texto puro exportam o que se vê, os desenhados só saem como PNG
                pg.click('input[name="desenho"][value="letras"]', force=True)
                info = {"colunas": pg.input_value("#colunas"), "opcoes_visiveis": pg.is_visible("#letras"),
                        "aba_inicial": pg.get_attribute('[role="tab"][aria-selected="true"]', "id"),
                        "estilo_inicial": pg.eval_on_selector('input[name="estilo"]:checked', "e => e.value")}
                if info != {"colunas": "100", "opcoes_visiveis": True, "aba_inicial": "aba-colar", "estilo_inicial": "traco"}:
                    problemas.append((f"{visao}/letras", info))
                for est in ("soltas", "maiusculas", "traco", "tamanho"):
                    pg.click(f'input[name="estilo"][value="{est}"]', force=True)
                    desenhado = pg.is_visible("#tela")
                    with pg.expect_download() as d:
                        pg.click("#png")
                    png = Path(d.value.path()).stat().st_size
                    d.value.save_as(SAIDA / f"exportado_{est}_{visao}.png")
                    pg.screenshot(path=str(SAIDA / f"estilo_{est}_{visao}.png"), full_page=True)
                    info = {"desenhado": desenhado, "png": png}
                    if desenhado:
                        info["copiar_desligado"] = pg.is_disabled("#copiar") and pg.is_disabled("#txt")
                        ok = info["copiar_desligado"] and est in ("traco", "tamanho")
                    else:
                        arte = pg.text_content("#arte")
                        with pg.expect_download() as d:
                            pg.click("#txt")
                        info["txt_igual"] = Path(d.value.path()).read_text(encoding="utf-8").rstrip("\n") == arte
                        info["tem_texto"] = "fogo" in "".join(arte.split()).lower()  # o soneto de Camões; as palavras se partem nos vãos
                        ok = info["txt_igual"] and info["tem_texto"] and est in ("soltas", "maiusculas")
                    if not ok or png < 5000:
                        problemas.append((f"{visao}/{est}", info))
                # prontos: trocam o texto do retrato e não alargam a coluna
                pg.click('input[name="estilo"][value="soltas"]', force=True)
                pg.click("#aba-prontos")
                pg.click('.pronto[data-id="mar"]')
                pg.wait_for_timeout(150)  # o redesenho espera o próximo quadro
                # em Soltas as palavras se partem nos vãos do retrato; sem os espaços, as letras seguem a ordem do texto
                info = {"caixa": pg.input_value("#texto")[:20], "retrato_com_o_texto": "salgado" in "".join(pg.text_content("#arte").split()),
                        "largura_sub_vs_coluna": pg.evaluate("[document.querySelector('#letras').getBoundingClientRect().width, document.querySelector('#ajustes').getBoundingClientRect().width].map(Math.round)")}
                pg.locator("#lista-prontos").scroll_into_view_if_needed()
                pg.screenshot(path=str(SAIDA / f"prontos_{visao}.png"))
                if not info["retrato_com_o_texto"] or info["largura_sub_vs_coluna"][0] > info["largura_sub_vs_coluna"][1]:
                    problemas.append((f"{visao}/prontos", info))
                # colar: o que se escreve na caixa vai para o retrato
                pg.click("#aba-colar")
                pg.fill("#texto", "Rafa")
                pg.wait_for_timeout(150)
                if "Rafa" not in pg.text_content("#arte") or pg.text_content("#credito") != "Seu texto":
                    problemas.append((f"{visao}/colar", {"credito": pg.text_content("#credito")}))
                # IA: sem a Prompt API, a aba explica e não oferece o botão
                pg.click("#aba-ia")
                info = {"aviso": pg.is_visible("#ia-sem"), "botao": pg.is_visible("#escrever")}
                pg.locator("#painel-ia").scroll_into_view_if_needed()
                pg.screenshot(path=str(SAIDA / f"ia_{visao}.png"))
                if info != {"aviso": True, "botao": False}:
                    problemas.append((f"{visao}/ia", info))
                # no computador, a prévia fica inteira na tela mesmo depois de rolar até o fim dos ajustes
                if larg > 860:
                    # rola até o fim dos ajustes encostar na base da janela (depois disso vem o rodapé, e a prévia sobe junto)
                    pg.evaluate("window.scrollTo(0, document.querySelector('#ajustes').getBoundingClientRect().bottom + scrollY - innerHeight)")
                    caixa = pg.evaluate("(() => { const r = document.querySelector('#quadro').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; })()")
                    pg.screenshot(path=str(SAIDA / f"rolado_{visao}.png"))
                    if caixa[0] < 0 or caixa[1] > caixa[2] + 1:
                        problemas.append((f"{visao}/previa_fixa", {"topo_base_janela": caixa}))
                pg.click('input[name="desenho"][value="simbolos"]', force=True)
                if pg.input_value("#colunas") != "60" or not pg.is_hidden("#letras"):
                    problemas.append((visao, {"voltou_para_60_colunas": pg.input_value("#colunas")}))
                lat = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                if lat > 0 or erros or fora:
                    problemas.append((f"{visao}/letras_fim", {"rolagem": lat, "erros": erros, "fora": fora}))
                ctx.close()
        # escrita com IA: aceite → download do modelo → texto em pedaços → crédito; o aceite fica lembrado
        ctx = b.new_context(viewport={"width": 1440, "height": 709}, color_scheme="dark", device_scale_factor=2)
        ctx.add_init_script(SEM_WEBGPU)
        ctx.add_init_script(IA_FALSA)
        pg = ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.goto(BASE + "/", wait_until="networkidle")
        pg.set_input_files("#arquivo", str(foto))
        pg.wait_for_function("document.querySelector('#estado').textContent.startsWith('Pronto')", timeout=120000)
        pg.click('input[name="desenho"][value="letras"]', force=True)
        pg.click("#aba-ia")
        antes = {"aceite": pg.is_visible("#ia-aceite"), "formulario": pg.is_visible("#ia-com"), "fala_do_download": "22 GB" in pg.text_content("#ia-aceite"),
                 "modelos": {r: not pg.is_disabled(f'input[name="modelo"][value="{r}"]') for r in ("gemini", "gemma", "lfm3")},
                 "escolhido": pg.eval_on_selector('input[name="modelo"]:checked', "e => e.value"),
                 "botao": pg.text_content("#aceitar")}
        pg.locator("#ia-aceite").scroll_into_view_if_needed()
        pg.screenshot(path=str(SAIDA / "ia_aceite.png"))
        pg.click("#aceitar")
        pg.wait_for_function("!document.querySelector('#ia-com').hidden && !document.querySelector('#escrever').disabled", timeout=10000)
        pg.click("#sugestoes button >> text=amor")
        pg.wait_for_function("document.querySelector('#parar').hidden && document.querySelector('#texto').value === 'Texto de teste da IA.'", timeout=10000)
        depois = {"credito": pg.text_content("#credito"), "retrato_com_o_texto": "teste" in "".join(pg.text_content("#arte").split()) or pg.is_visible("#tela")}
        pg.screenshot(path=str(SAIDA / "ia_escrito.png"))
        pg.reload(wait_until="networkidle")
        pg.set_input_files("#arquivo", str(foto))
        pg.wait_for_function("document.querySelector('#estado').textContent.startsWith('Pronto')", timeout=120000)
        pg.click('input[name="desenho"][value="letras"]', force=True)
        pg.click("#aba-ia")
        lembrado = {"aceite": pg.is_visible("#ia-aceite"), "formulario": pg.is_visible("#ia-com")}
        print("IA (falsa):", antes, depois, lembrado)
        if (antes != {"aceite": True, "formulario": False, "fala_do_download": True, "modelos": {"gemini": True, "gemma": False, "lfm3": False},
                      "escolhido": "gemini", "botao": "Baixar o modelo e continuar"}
                or not depois["credito"].startswith("Escrito pelo Gemini Nano") or not depois["retrato_com_o_texto"]
                or lembrado != {"aceite": False, "formulario": True} or erros):
            problemas.append(("ia_falsa", {"antes": antes, "depois": depois, "lembrado": lembrado, "erros": erros}))
        ctx.close()
        b.close()
    srv.shutdown()
    print(f"visões: {len(visoes)}; capturas em", SAIDA)
    print("problemas:", problemas or "nenhum")


if __name__ == "__main__":
    main()
