// Página: foto → recorte (recorte.js) → grade (retrato.js) → desenho com símbolos ou com um texto (colado, pronto ou
// escrito pelo Gemini Nano do Chrome, em escrita.js), com ajustes ao vivo e exportação em PNG e, quando dá, em texto.
// a versão no endereço evita misturar módulos novos com antigos guardados em cache (o Pages manda guardar por 10 min)
import { erodir, enquadrar, grade, simbolos, letras, maiusculas, celulas } from "./retrato.js?v=20261111";
import { pessoa } from "./recorte.js";
import { disponibilidade, escrever, preparar, SUGESTOES } from "./escrita.js?v=20261111";
import { PRONTOS, GRUPOS } from "./prontos.js?v=20261111";

const LARGURA = 560; // largura de trabalho em px: a do retrato do Sobre, para a qual os filtros foram calibrados
const MAXIMO = 1024; // lado maior da foto antes do recorte
const CORES = { claro: ["#ffffff", "20, 23, 28"], escuro: ["#191c21", "236, 238, 242"] }; // fundo e tinta (rgb)
const DESENHADOS = new Set(["traco", "tamanho"]); // o tom vem da grossura ou do tamanho da letra: só saem como imagem
const SOBRE = {
  simbolos: "Cada pedaço da foto vira um símbolo da escala, do mais vazio ao mais cheio.",
  letras: "O retrato é escrito com um texto, que corre em ordem e se repete até preencher a foto.",
  soltas: "Letra onde o retrato é cheio, espaço onde é vazio. Sai como texto puro.",
  maiusculas: "Espaço, minúscula e MAIÚSCULA, do vazio ao cheio. Sai como texto puro.",
  traco: "O texto inteiro, em ordem; a letra engrossa onde o retrato é cheio. Sai como imagem.",
  tamanho: "O texto inteiro, em ordem; a letra cresce onde o retrato é cheio. Sai como imagem.",
};
const NOTA_TEXTO = "O texto copiado é a versão do fundo escolhido: no fundo claro, o escuro da foto vira caractere cheio; no escuro, o contrário.";
const NOTA_IMAGEM = "Traço e Tamanho saem só como imagem: no texto puro, a grossura e o tamanho das letras se perdem.";
const INICIAL = PRONTOS[0]; // o soneto de Camões

const $ = (s) => document.querySelector(s);
const el = {
  arquivo: $("#arquivo"), zona: $("#zona"), estado: $("#estado"), previa: $("#previa"), quadro: $("#quadro"),
  arte: $("#arte"), tela: $("#tela"), legenda: $("#legenda"), ajustes: $("#ajustes"), colunas: $("#colunas"),
  colunasV: $("#colunas-v"), sombras: $("#sombras"), sombrasV: $("#sombras-v"), recorte: $("#recorte"),
  desenhoNota: $("#desenho-nota"), letras: $("#letras"), estiloNota: $("#estilo-nota"), texto: $("#texto"),
  credito: $("#credito"), listaProntos: $("#lista-prontos"), copiar: $("#copiar"), txt: $("#txt"), notaAcoes: $("#nota-acoes"),
  iaVerificando: $("#ia-verificando"), iaSem: $("#ia-sem"), iaAceite: $("#ia-aceite"), aceiteDownload: $("#aceite-download"),
  aceitar: $("#aceitar"), iaCom: $("#ia-com"), tema: $("#tema"), escrever: $("#escrever"),
  parar: $("#parar"), sugestoes: $("#sugestoes"), iaStatus: $("#ia-status"), iaErro: $("#ia-erro"), iaNota: $("#ia-nota"),
};
const abas = [...document.querySelectorAll('[role="tab"]')];

let foto = null; // { cv, mascara (canvas) | null, caixa, preparo: {com, sem} }
let G = null; // grade da foto (retrato.js)
let exemplo = null; // { claro, escuro, colunas }: o retrato mostrado antes da primeira foto
let nome = "retrato";
let carregou = false;
let pesos = null; // promessa dos pesos 100 a 700 da IBM Plex Mono, que o Traço usa
const colunasPor = { simbolos: 60, letras: 100 }; // com texto, o rosto só aparece com mais colunas
let desenhoAnterior = "simbolos";
let ia = "verificando"; // disponibilidade() de escrita.js
let escrevendo = null; // AbortController enquanto a IA escreve
let progresso = null; // download do modelo, de 0 a 1
let preparando = false; // o Chrome está baixando o modelo depois do aceite
const ACEITE = "retrato-ascii:aceite-ia"; // a pessoa leu como a IA funciona e aceitou (guardado só neste navegador)
let aceitou = (() => { try { return localStorage.getItem(ACEITE) === "1"; } catch { return false; } })();
let origem = null; // { texto, credito } do último pronto ou texto da IA, para o crédito de quem edita

const fundo = () => document.querySelector('input[name="fundo"]:checked').value;
const desenho = () => document.querySelector('input[name="desenho"]:checked').value;
const estilo = () => (desenho() === "simbolos" ? "simbolos" : document.querySelector('input[name="estilo"]:checked').value);
const iaIndisponivel = () => ia === "sem-api" || ia === "unavailable";
const carregarPesos = () =>
  (pesos ??= Promise.all([1, 2, 3, 4, 5, 6, 7].map((w) => document.fonts.load(`${w}00 16px "IBM Plex Mono"`))));

function avisar(msg, erro = false) {
  el.estado.textContent = msg;
  el.estado.classList.toggle("erro", erro);
}

// ---------- desenho ----------

/** Tamanho da letra para a arte caber na prévia: na largura e, no computador, também na altura da janela. */
function tamanhoLetra(colunas, linhas) {
  const cs = getComputedStyle(el.quadro);
  const livre = el.quadro.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let fs = livre / (colunas * 0.6);
  if (matchMedia("(min-width: 861px)").matches) {
    const altura = innerHeight - 24 - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 40; // margem fixa + legenda
    fs = Math.min(fs, altura / (linhas * 1.2));
  }
  return Math.min(13, Math.max(3, fs));
}

/** O retrato em texto puro, no estilo e no fundo escolhidos (antes da primeira foto, o exemplo). */
function textoPuro(e = estilo()) {
  const f = fundo();
  if (!G) return exemplo?.[f] ?? "";
  if (e === "soltas") return letras(G, f, el.texto.value);
  if (e === "maiusculas") return maiusculas(G, f, el.texto.value);
  return simbolos(G, f);
}

/** Pinta o retrato num canvas já com o fundo, numa grade de letras de fs px (célula de 0,6 × 1,2 fs), a partir de (ox, oy). */
function pintar(cx, e, fs, ox, oy) {
  const tinta = CORES[fundo()][1];
  const cw = fs * 0.6, lh = fs * 1.2;
  cx.fillStyle = `rgb(${tinta})`;
  if (!DESENHADOS.has(e)) {
    cx.font = `400 ${fs}px "IBM Plex Mono", monospace`;
    cx.textAlign = "left";
    cx.textBaseline = "middle";
    textoPuro(e).split("\n").forEach((linha, i) => cx.fillText(linha, ox, oy + (i + 0.5) * lh));
    return;
  }
  cx.textAlign = "center";
  cx.textBaseline = "middle";
  let fonte = "";
  for (const c of celulas(G, fundo(), el.texto.value)) {
    let f;
    if (e === "traco") {
      f = `${100 + 100 * Math.round(c.tinta * 6)} ${fs}px "IBM Plex Mono"`; // pesos de 100 a 700
      cx.fillStyle = `rgba(${tinta}, ${(0.12 + 0.88 * c.tinta).toFixed(3)})`;
    } else {
      f = `600 ${(fs * (0.3 + 1.3 * c.tinta)).toFixed(1)}px "IBM Plex Mono"`; // a tinta da letra cresce com o quadrado do tamanho
    }
    if (f !== fonte) cx.font = fonte = f;
    cx.fillText(c.letra, ox + (c.x + 0.5) * cw, oy + (c.y + 0.5) * lh);
  }
}

/** Prepara um canvas de w × h px CSS na densidade da tela, com o fundo escolhido. */
function tela(cv, w, h, ajustarCss) {
  const dpr = devicePixelRatio || 1;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  if (ajustarCss) Object.assign(cv.style, { width: `${w}px`, height: `${h}px` });
  const cx = cv.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = CORES[fundo()][0];
  cx.fillRect(0, 0, w, h);
  return cx;
}

function mostrar() {
  el.previa.dataset.fundo = fundo();
  const e = estilo();
  const img = !!G && DESENHADOS.has(e);
  el.arte.hidden = img;
  el.tela.hidden = !img;
  if (!G && !exemplo) return;
  const linhas = G ? G.linhas : exemplo.claro.split("\n").length;
  const fs = tamanhoLetra(G ? G.colunas : exemplo.colunas, linhas);
  if (img) {
    if (!pesos) carregarPesos().then(mostrar);
    pintar(tela(el.tela, G.colunas * fs * 0.6, G.linhas * fs * 1.2, true), e, fs, 0, 0);
  } else {
    el.arte.textContent = textoPuro(e);
    el.arte.style.fontSize = `${fs.toFixed(2)}px`;
  }
  if (G && desenho() === "letras") miniaturas();
}

/** As miniaturas dos estilos, com a foto e o texto de agora. */
function miniaturas() {
  const fs = 2.4;
  for (const cv of document.querySelectorAll(".mini canvas")) {
    const e = cv.previousElementSibling.value;
    pintar(tela(cv, G.colunas * fs * 0.6, G.linhas * fs * 1.2, false), e, fs, 0, 0);
  }
}

let agendado = false;
/** Redesenha no próximo quadro (digitação e texto da IA chegando aos pedaços). */
function agendar() {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(() => {
    agendado = false;
    mostrar();
  });
}

// ---------- foto ----------

/** Luminância (0 a 1) de uma região da foto, redesenhada em w × h. */
function ler(fonte, [x0, y0, x1, y1], w, h, canal) {
  const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.imageSmoothingQuality = "high";
  cx.drawImage(fonte, x0, y0, x1 - x0, y1 - y0, 0, 0, w, h);
  const px = cx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++)
    out[i] = canal ? px[4 * i] / 255 : (0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2]) / 255;
  return out;
}

/** Luminância e máscara enquadradas na largura de trabalho (com ou sem recorte), guardadas para os ajustes. */
function preparo() {
  const com = el.recorte.checked && foto.mascara;
  const chave = com ? "com" : "sem";
  if (!foto.preparo[chave]) {
    const caixa = com ? foto.caixa : [0, 0, foto.cv.width, foto.cv.height];
    const w = LARGURA;
    const h = Math.max(1, Math.round((LARGURA * (caixa[3] - caixa[1])) / (caixa[2] - caixa[0])));
    foto.preparo[chave] = { lum: ler(foto.cv, caixa, w, h), masc: com ? ler(foto.mascara, caixa, w, h, true) : null, w, h };
  }
  return foto.preparo[chave];
}

function desenhar() {
  if (!foto) return;
  const colunas = +el.colunas.value;
  const s = +el.sombras.value;
  el.colunasV.textContent = colunas;
  el.sombrasV.textContent = `${s}%`;
  const { lum, masc, w, h } = preparo();
  G = grade(lum, masc, w, h, { colunas, gama: 1 - s * 0.006 }); // 0% → gama 1; 50% → 0,7 (o do Sobre); 100% → 0,4
  el.legenda.textContent = `${G.colunas} × ${G.linhas} caracteres`;
  mostrar();
}

/** Máscara da pessoa no tamanho da foto: binária, sem a franja da borda; null se não achar ninguém. */
async function mascarar(cv) {
  const r = await pessoa(cv);
  const W = cv.width, H = cv.height;
  const tmp = Object.assign(document.createElement("canvas"), { width: r.w, height: r.h });
  const dados = new ImageData(r.w, r.h);
  r.p.forEach((v, i) => dados.data.set([v * 255, v * 255, v * 255, 255], 4 * i));
  tmp.getContext("2d").putImageData(dados, 0, 0);
  let m = ler(tmp, [0, 0, r.w, r.h], W, H, true).map((v) => (v > 0.5 ? 1 : 0));
  m = erodir(m, W, H, Math.round(Math.max(W, H) / 320));
  const caixa = enquadrar(m, W, H);
  if (!caixa) return null;
  const mc = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const md = new ImageData(W, H);
  m.forEach((v, i) => md.data.set([v * 255, v * 255, v * 255, 255], 4 * i));
  mc.getContext("2d").putImageData(md, 0, 0);
  return { mascara: mc, caixa };
}

async function abrir(arquivo) {
  if (!arquivo) return;
  if (arquivo.type && !arquivo.type.startsWith("image/")) return avisar("Esse arquivo não é uma imagem.", true);
  avisar("Abrindo a foto…");
  let bmp;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    return avisar("Não consegui abrir essa imagem neste navegador. Tente uma foto em JPG ou PNG.", true);
  }
  const k = Math.min(1, MAXIMO / Math.max(bmp.width, bmp.height));
  const cv = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  const cx = cv.getContext("2d");
  cx.fillStyle = "#fff"; // foto com transparência: o vazio vira branco
  cx.fillRect(0, 0, cv.width, cv.height);
  cx.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close();
  nome = (arquivo.name || "retrato").replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "retrato";

  avisar(carregou ? "Recortando o fundo…" : "Carregando o recorte do fundo (cerca de 15 MB, só na primeira foto)…");
  let rec = null, falhou = false;
  try {
    rec = await mascarar(cv);
    carregou = true;
  } catch (e) {
    console.warn("recorte", e);
    falhou = true;
  }
  foto = { cv, mascara: rec?.mascara ?? null, caixa: rec?.caixa, preparo: {} };
  el.recorte.disabled = !rec;
  el.ajustes.disabled = false;
  rotular();
  desenhar();
  avisar(falhou ? "O recorte do fundo não funcionou neste navegador; desenhei a foto inteira."
    : rec ? "Pronto. Escolha como desenhar e ajuste até ficar do seu jeito."
    : "Não achei uma pessoa na foto; desenhei a foto inteira.", falhou || !rec);
}

// ---------- símbolos ou letras, estilo, abas ----------

function rotular() {
  if (!foto) return;
  const rotulo = desenho() === "simbolos" ? "Retrato desenhado com caracteres a partir da sua foto"
    : `Retrato da sua foto escrito com o texto: ${el.texto.value.slice(0, 120)}`;
  el.arte.setAttribute("aria-label", rotulo);
  el.tela.setAttribute("aria-label", rotulo);
}

function trocarEstilo() {
  const e = estilo();
  const img = DESENHADOS.has(e);
  el.estiloNota.textContent = SOBRE[e] ?? "";
  el.copiar.disabled = el.txt.disabled = img;
  el.notaAcoes.textContent = img ? NOTA_IMAGEM : NOTA_TEXTO;
  mostrar();
}

function trocarDesenho() {
  const d = desenho();
  el.letras.hidden = d === "simbolos";
  el.desenhoNota.textContent = SOBRE[d];
  if (d !== desenhoAnterior) {
    colunasPor[desenhoAnterior] = +el.colunas.value;
    el.colunas.value = colunasPor[d];
    desenhoAnterior = d;
  }
  rotular();
  trocarEstilo();
  desenhar();
}

function escolherAba(qual, focar = false) {
  for (const aba of abas) {
    const ativa = aba.id === `aba-${qual}`;
    aba.setAttribute("aria-selected", ativa);
    aba.tabIndex = ativa ? 0 : -1;
    $(`#${aba.getAttribute("aria-controls")}`).hidden = !ativa;
    if (ativa && focar) aba.focus();
  }
}

/** Troca o texto do retrato e a linha de crédito embaixo da caixa. */
function usarTexto(texto, credito, pronto = null) {
  el.texto.value = texto;
  el.credito.textContent = credito;
  origem = texto ? { texto, credito } : null;
  for (const b of el.listaProntos.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.id === pronto);
  rotular();
  agendar();
}

// ---------- prontos ----------
for (const g of GRUPOS) {
  const bloco = document.createElement("div");
  const titulo = Object.assign(document.createElement("h3"), { textContent: g });
  bloco.append(titulo);
  for (const p of PRONTOS.filter((x) => x.grupo === g)) {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "pronto" });
    b.dataset.id = p.id;
    b.setAttribute("aria-pressed", "false");
    const nomeP = Object.assign(document.createElement("b"), { textContent: p.titulo });
    const linha = Object.assign(document.createElement("span"), { textContent: `${p.autor} · ${p.texto}` });
    b.append(nomeP, linha);
    b.addEventListener("click", () => usarTexto(p.texto, `${p.titulo} · ${p.autor} · domínio público`, p.id));
    bloco.append(b);
  }
  el.listaProntos.append(bloco);
}

// ---------- escrita com IA (Gemini Nano do Chrome) ----------

function mostrarIA() {
  const usavel = ia !== "verificando" && !iaIndisponivel();
  el.iaVerificando.hidden = ia !== "verificando";
  el.iaSem.hidden = !iaIndisponivel();
  el.iaAceite.hidden = !usavel || aceitou;
  el.iaCom.hidden = !usavel || !aceitou;
  const baixar = ia !== "available";
  el.aceiteDownload.hidden = !baixar;
  el.aceitar.textContent = baixar ? "Baixar o modelo e continuar" : "Entendi, quero usar";
  el.iaNota.textContent = "Roda no seu computador, com o Gemini Nano do Chrome. Em português, o texto pode sair estranho; dá para editar na caixa.";
  const ocupado = !!escrevendo || preparando;
  el.escrever.hidden = !!escrevendo;
  el.escrever.disabled = preparando;
  el.parar.hidden = !escrevendo;
  el.tema.disabled = ocupado;
  for (const b of el.sugestoes.children) b.disabled = ocupado;
}

async function aceitar() {
  aceitou = true;
  try { localStorage.setItem(ACEITE, "1"); } catch { /* sem armazenamento: pergunta de novo da próxima vez */ }
  if (ia === "available") {
    mostrarIA();
    el.tema.focus();
    return;
  }
  // o download começa aqui, dentro do clique: o Chrome exige um gesto da pessoa
  preparando = true;
  el.iaErro.hidden = true;
  const pronto = preparar((p) => {
    progresso = p;
    const barra = el.iaStatus.querySelector("progress");
    if (barra) barra.value = p;
  });
  status("Baixando o modelo do Chrome (só desta vez)…", true);
  mostrarIA();
  try {
    await pronto;
    ia = "available";
    status(null);
  } catch (e) {
    status(null);
    el.iaErro.hidden = false;
    el.iaErro.textContent = `O Chrome não conseguiu baixar o modelo: ${e.message || e.name}`;
  } finally {
    preparando = false;
    mostrarIA();
    el.tema.focus();
  }
}

function status(texto, comProgresso = false) {
  el.iaStatus.hidden = !texto;
  el.iaStatus.textContent = texto ?? "";
  if (comProgresso) {
    const barra = Object.assign(document.createElement("progress"), { max: 1, value: progresso ?? 0 });
    barra.setAttribute("aria-label", "Download do modelo");
    el.iaStatus.append(barra);
  }
}

async function gerar(pedido) {
  pedido = pedido.trim();
  if (!pedido || escrevendo || preparando || !aceitou || iaIndisponivel() || ia === "verificando") return;
  el.tema.value = pedido;
  escrevendo = new AbortController();
  el.iaErro.hidden = true;
  const baixando = ia !== "available";
  status(baixando ? "Baixando o modelo do Chrome (só na primeira vez)…" : `Escrevendo um texto sobre «${pedido}»…`, baixando);
  mostrarIA();
  el.parar.focus();
  let parcial = "";
  try {
    // chamada ainda dentro do clique: o download do modelo exige um gesto da pessoa
    const final = await escrever(pedido, {
      signal: escrevendo.signal,
      aoBaixar: (p) => {
        progresso = p;
        const barra = el.iaStatus.querySelector("progress");
        if (barra) barra.value = p;
      },
      aoTrecho: (t) => {
        if (!parcial) status(`Escrevendo um texto sobre «${pedido}»…`);
        parcial = t;
        el.texto.value = t;
        agendar();
      },
    });
    ia = "available";
    usarTexto(final, `Escrito pelo Gemini Nano, no seu navegador, a partir de «${pedido}»`);
  } catch (e) {
    if (e.name === "AbortError") usarTexto(parcial, `Escrita interrompida (Gemini Nano, a partir de «${pedido}»).`);
    else {
      el.iaErro.hidden = false;
      el.iaErro.textContent = `Não deu para escrever: ${e.message || e.name}`;
      if (parcial) usarTexto(parcial, `Texto incompleto (Gemini Nano, a partir de «${pedido}»).`);
    }
  } finally {
    escrevendo = null;
    status(null);
    mostrarIA();
    el.escrever.focus();
  }
}

for (const s of SUGESTOES) {
  const b = Object.assign(document.createElement("button"), { type: "button", className: "chip", textContent: s });
  b.addEventListener("click", () => gerar(s));
  el.sugestoes.append(b);
}

// ---------- exportação ----------

function baixar(blob, arquivo) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: arquivo });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const nomeArquivo = (ext) => `${nome}-${estilo() === "simbolos" ? "ascii" : estilo()}-${fundo()}.${ext}`;

async function png() {
  const e = estilo();
  const fs = 14, pad = fs * 2, escala = 2; // IBM Plex Mono: avanço de 0,6 em
  await document.fonts.load(`400 ${fs}px "IBM Plex Mono"`);
  if (DESENHADOS.has(e)) await carregarPesos();
  const w = pad * 2 + G.colunas * fs * 0.6, h = pad * 2 + G.linhas * fs * 1.2;
  const cv = Object.assign(document.createElement("canvas"), { width: Math.ceil(w * escala), height: Math.ceil(h * escala) });
  const cx = cv.getContext("2d");
  cx.scale(escala, escala);
  cx.fillStyle = CORES[fundo()][0];
  cx.fillRect(0, 0, w, h);
  pintar(cx, e, fs, pad, pad);
  cv.toBlob((b) => baixar(b, nomeArquivo("png")), "image/png");
}

// ---------- eventos ----------
el.arquivo.addEventListener("change", () => abrir(el.arquivo.files[0]));
for (const ev of ["dragenter", "dragover"]) el.zona.addEventListener(ev, (e) => { e.preventDefault(); el.zona.classList.add("sobre"); });
for (const ev of ["dragleave", "drop"]) el.zona.addEventListener(ev, () => el.zona.classList.remove("sobre"));
el.zona.addEventListener("drop", (e) => { e.preventDefault(); abrir(e.dataTransfer.files[0]); });
window.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
  if (item) abrir(item.getAsFile());
});
for (const c of [el.colunas, el.sombras, el.recorte]) c.addEventListener("input", desenhar);
for (const r of document.querySelectorAll('input[name="fundo"]')) r.addEventListener("change", mostrar);
for (const r of document.querySelectorAll('input[name="desenho"]')) r.addEventListener("change", trocarDesenho);
for (const r of document.querySelectorAll('input[name="estilo"]')) r.addEventListener("change", trocarEstilo);
for (const aba of abas) aba.addEventListener("click", () => escolherAba(aba.id.slice(4)));
abas[0].parentElement.addEventListener("keydown", (e) => { // setas, Home e End trocam de aba (padrão ARIA de abas)
  const i = abas.indexOf(document.activeElement);
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
  if (i < 0 || j === undefined) return;
  e.preventDefault();
  escolherAba(abas[(j + abas.length) % abas.length].id.slice(4), true);
});
el.texto.addEventListener("input", () => {
  // editou o pronto ou o texto da IA: o crédito continua, com "(editado)"; trocou por outro texto: "Seu texto"
  const editado = origem && el.texto.value.includes(origem.texto.slice(0, 30));
  el.credito.textContent = editado ? `${origem.credito.replace(/\.$/, "")} (editado)` : "Seu texto";
  for (const b of el.listaProntos.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
  rotular();
  agendar();
});
$("#limpar").addEventListener("click", () => {
  usarTexto("", "Seu texto");
  el.texto.focus();
});
el.escrever.addEventListener("click", () => gerar(el.tema.value));
el.aceitar.addEventListener("click", aceitar);
el.tema.addEventListener("keydown", (e) => { if (e.key === "Enter") gerar(el.tema.value); });
el.parar.addEventListener("click", () => escrevendo?.abort());
el.copiar.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(textoPuro());
    avisar(`Texto copiado (versão para fundo ${fundo()}). Cole num bloco de código para manter o alinhamento.`);
  } catch {
    avisar("O navegador não deixou copiar; use “Baixar .txt”.", true);
  }
});
$("#png").addEventListener("click", png);
el.txt.addEventListener("click", () => baixar(new Blob([textoPuro() + "\n"], { type: "text/plain;charset=utf-8" }), nomeArquivo("txt")));
let largura = 0, altura = innerHeight; // redesenha quando a prévia muda de largura ou a janela muda de altura
new ResizeObserver(() => {
  if (el.quadro.clientWidth === largura) return;
  largura = el.quadro.clientWidth;
  mostrar();
}).observe(el.quadro);
addEventListener("resize", () => {
  if (innerHeight === altura) return;
  altura = innerHeight;
  mostrar();
});

// ---------- início: fundo do sistema, o exemplo e a IA do navegador ----------
if (matchMedia("(prefers-color-scheme: dark)").matches) document.querySelector('input[name="fundo"][value="escuro"]').checked = true;
usarTexto(INICIAL.texto, `${INICIAL.titulo} · ${INICIAL.autor} · domínio público`, INICIAL.id);
el.estiloNota.textContent = SOBRE.traco;
fetch("exemplo.json").then((r) => r.json()).then((ex) => {
  exemplo = { ...ex, colunas: Math.max(...ex.claro.split("\n").map((l) => l.length)) };
  if (!foto) mostrar();
});
mostrarIA();
disponibilidade().then((d) => {
  ia = d;
  mostrarIA();
});
