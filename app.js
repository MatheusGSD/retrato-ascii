// Página: foto → recorte (recorte.js) → retrato (retrato.js), com ajustes ao vivo e exportação em texto e PNG.
import { erodir, enquadrar, retrato } from "./retrato.js";
import { pessoa } from "./recorte.js";

const LARGURA = 560; // largura de trabalho em px: a do retrato do Sobre, para a qual os filtros foram calibrados
const MAXIMO = 1024; // lado maior da foto antes do recorte
const CORES = { claro: ["#ffffff", "#14171c"], escuro: ["#191c21", "#eceef2"] };

const $ = (s) => document.querySelector(s);
const el = {
  arquivo: $("#arquivo"), zona: $("#zona"), estado: $("#estado"), previa: $("#previa"), arte: $("#arte"),
  legenda: $("#legenda"), ajustes: $("#ajustes"), colunas: $("#colunas"), colunasV: $("#colunas-v"),
  sombras: $("#sombras"), sombrasV: $("#sombras-v"), recorte: $("#recorte"),
};

let foto = null; // { cv, mascara (canvas) | null, caixa, preparo: {com, sem} }
let atual = null; // { claro, escuro, colunas, linhas }
let nome = "retrato";
let carregou = false;

const fundo = () => document.querySelector('input[name="fundo"]:checked').value;

function avisar(msg, erro = false) {
  el.estado.textContent = msg;
  el.estado.classList.toggle("erro", erro);
}

/** Ajusta o tamanho da letra para a arte caber na largura da prévia. */
function encaixar() {
  if (!atual) return;
  const pre = el.arte;
  const cs = getComputedStyle(pre);
  const livre = pre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  pre.style.fontSize = `${Math.min(13, Math.max(3, livre / (atual.colunas * 0.6))).toFixed(2)}px`;
}

function mostrar() {
  el.previa.dataset.fundo = fundo();
  el.arte.textContent = atual ? atual[fundo()] : "";
  encaixar();
}

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
  atual = retrato(lum, masc, w, h, { colunas, gama: 1 - s * 0.006 }); // 0% → gama 1; 50% → 0,7 (o do Sobre); 100% → 0,4
  el.legenda.textContent = `${atual.colunas} × ${atual.linhas} caracteres`;
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
  el.arte.setAttribute("aria-label", "Retrato desenhado com caracteres a partir da sua foto");
  desenhar();
  avisar(falhou ? "O recorte do fundo não funcionou neste navegador; desenhei a foto inteira."
    : rec ? "Pronto. Ajuste as colunas e as sombras até ficar do seu jeito."
    : "Não achei uma pessoa na foto; desenhei a foto inteira.", falhou || !rec);
}

function baixar(blob, arquivo) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: arquivo });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function png() {
  const f = fundo();
  const [bg, ink] = CORES[f];
  const fs = 14, lh = fs * 1.2, pad = fs * 2, escala = 2;
  await document.fonts.load(`400 ${fs}px "IBM Plex Mono"`);
  const cv = document.createElement("canvas");
  let cx = cv.getContext("2d");
  cx.font = `400 ${fs}px "IBM Plex Mono", monospace`;
  const cw = cx.measureText("M").width;
  cv.width = Math.ceil((pad * 2 + atual.colunas * cw) * escala);
  cv.height = Math.ceil((pad * 2 + atual.linhas * lh) * escala);
  cx = cv.getContext("2d"); // mudar o tamanho zera o contexto
  cx.scale(escala, escala);
  cx.fillStyle = bg;
  cx.fillRect(0, 0, cv.width, cv.height);
  cx.fillStyle = ink;
  cx.font = `400 ${fs}px "IBM Plex Mono", monospace`;
  cx.textBaseline = "middle";
  atual[f].split("\n").forEach((linha, i) => cx.fillText(linha, pad, pad + i * lh + lh / 2));
  cv.toBlob((b) => baixar(b, `${nome}-ascii-${f}.png`), "image/png");
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
$("#copiar").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(atual[fundo()]);
    avisar(`Texto copiado (versão para fundo ${fundo()}). Cole num bloco de código para manter o alinhamento.`);
  } catch {
    avisar("O navegador não deixou copiar; use “Baixar .txt”.", true);
  }
});
$("#png").addEventListener("click", png);
$("#txt").addEventListener("click", () =>
  baixar(new Blob([atual[fundo()] + "\n"], { type: "text/plain;charset=utf-8" }), `${nome}-ascii-${fundo()}.txt`));
new ResizeObserver(encaixar).observe(el.arte);

// ---------- início: fundo do sistema e o exemplo ----------
if (matchMedia("(prefers-color-scheme: dark)").matches) document.querySelector('input[name="fundo"][value="escuro"]').checked = true;
fetch("exemplo.json").then((r) => r.json()).then((ex) => {
  if (foto) return;
  const linhas = ex.claro.split("\n");
  atual = { ...ex, colunas: Math.max(...linhas.map((l) => l.length)), linhas: linhas.length };
  mostrar();
});
