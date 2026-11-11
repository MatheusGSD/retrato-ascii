// Escrita com IA, rodando no aparelho da pessoa. Três modelos à escolha:
// - Gemini Nano: vem dentro do Chrome para computador (Prompt API, `LanguageModel`); quem baixa é o próprio Chrome (uns 4 GB).
// - Gemma 3 1B e LFM3 1,7B: a página baixa do Hugging Face e roda com transformers.js na placa de vídeo (WebGPU).
// Testados em 11/11/2026 com os mesmos seis pedidos: o Gemini escreve melhor e segue melhor o pedido; Gemma e LFM3 escrevem
// português fluente, mas às vezes falam da pessoa em vez de falar com ela ou inventam detalhes. Apertus v1.1 (0,5B e 1,5B) e
// Bonsai 1,7B (1 bit) foram reprovados: palavras inventadas e repetição.
// O Chrome ainda não lista o português entre os idiomas do Gemini Nano e recusa quando o pedido declara "pt"; sem declarar,
// ele escreve em português. Os exemplos (pedido → resposta) ensinam o tipo de texto melhor que as regras: só com a regra, o
// Gemini escrevia "sou grato" nas dedicatórias. Um exemplo de pedido de forma ("só a palavra luz") fazia os modelos pequenos
// repetirem "luz" e saiu.

export const SISTEMA = `Você escreve textos curtos em português do Brasil para preencher um retrato desenhado com letras. Responda sempre só com o texto pedido, sem título, sem aspas, sem listas, sem emojis e sem comentários.

Regras:
1. Tema ou palavra (por exemplo: mar, saudade, futebol): um parágrafo original de 50 a 80 palavras sobre o tema, em frases completas e com imagens concretas.
2. Obra, autor, gênero ou livro sagrado (por exemplo: senhor dos anéis, machado de assis, bíblia): um parágrafo original de 50 a 80 palavras no estilo e no clima da obra, como se fosse um trecho novo dela. Nunca copie trechos nem cite versículos, falas ou capítulos.
3. Pessoa ou ocasião (por exemplo: para minha mãe, aniversário da Ana): uma dedicatória de 40 a 70 palavras escrita diretamente para a pessoa, tratando-a por você, em frases completas e calorosas. Não invente fatos sobre a pessoa. Não use palavras que mostrem o gênero de quem escreve, como grato, grata, obrigado, obrigada, cansado ou cansada; prefira formas como agradeço.
4. Pedido ofensivo, sexual ou com dados pessoais de terceiros: um parágrafo neutro sobre luz e sombra.`;

export const EXEMPLOS = [
  ["mar", "O mar chega cedo, antes de todo mundo, e deixa espuma nos pés de quem passa. Tem cheiro de sal e de começo. As ondas repetem a mesma frase há séculos, e ninguém se cansa de ouvir. No fim da tarde, o azul vira cobre, os barcos voltam devagar e a areia guarda, por um instante, as pegadas do dia."],
  ["dom quixote", "Montado num cavalo magro e numa coragem enorme, o cavaleiro sai pela estrada convencido de que cada moinho esconde um gigante. O escudeiro, mais prático, conta os pães e as léguas. Riem dele nas estalagens, mas ele segue adiante, porque acredita que o mundo ainda precisa de quem defenda os fracos, nem que seja contra o vento."],
  ["para meu avô", "Vô, agradeço por ter me ensinado a ter paciência com as coisas que crescem devagar. Suas histórias ainda moram na mesa da cozinha, entre o café e o pão. Cada conselho seu virou caminho. Hoje, quando alguém pergunta de onde vem esse jeito calmo de olhar o mundo, a resposta é simples: vem de você."],
];

export const SUGESTOES = ["bíblia", "senhor dos anéis", "amor", "para minha mãe"];

export const MODELOS = {
  gemini: { nome: "Gemini Nano", autor: "Google", tamanho: "uns 4 GB", tipo: "chrome" },
  gemma: { nome: "Gemma 3 1B", autor: "Google", tamanho: "763 MB", tipo: "web", repo: "onnx-community/gemma-3-1b-it-ONNX", dtype: "q4f16" },
  lfm3: { nome: "LFM3 1,7B", autor: "Liquid AI", tamanho: "1,1 GB", tipo: "web", repo: "onnx-community/LFM3-1.7B-ONNX", dtype: "q4f16" },
};

const mensagens = (pedido) => [
  { role: "system", content: SISTEMA },
  ...EXEMPLOS.flatMap(([p, r]) => [{ role: "user", content: p }, { role: "assistant", content: r }]),
  ...(pedido ? [{ role: "user", content: pedido }] : []),
];

/** Tira aspas e marcação que os modelos às vezes põem; no retrato, quebras de linha viram espaço de qualquer jeito. */
export const limpar = (t) => t.replace(/["“”«»*#_]/g, "").replace(/\s+/g, " ").trim();

// ---------- Gemini Nano (Chrome) ----------

let baseChrome = null;
/** Sessão com o prompt e os exemplos, criada uma vez; cada pedido usa um clone dela (sem histórico entre pedidos). */
function sessaoChrome(aoBaixar) {
  baseChrome ??= LanguageModel.create({
    initialPrompts: mensagens(),
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => aoBaixar?.(e.loaded));
    },
  }).catch((e) => {
    baseChrome = null;
    throw e;
  });
  return baseChrome;
}

async function escreverChrome(pedido, { signal, aoTrecho, aoBaixar }) {
  const promessa = sessaoChrome(aoBaixar); // ainda dentro do clique: o download do modelo exige um gesto da pessoa
  const sessao = await (await promessa).clone({ signal });
  try {
    let bruto = "";
    for await (const pedaco of sessao.promptStreaming(pedido, { signal })) {
      bruto += pedaco; // o Chrome manda só o trecho novo
      aoTrecho?.(limpar(bruto));
    }
    return limpar(bruto);
  } finally {
    sessao.destroy();
  }
}

// ---------- Gemma e LFM3 (transformers.js, WebGPU) ----------

// A biblioteca vem do jsDelivr (a CDN pública do npm), com a versão travada, e só baixa quando alguém escolhe um destes
// modelos; ela mesma busca lá o wasm do ONNX Runtime para WebGPU. Não fica neste repositório porque a varredura de segredos
// do GitHub confunde os nomes de classes do arquivo minificado ("MistralFor…") com uma chave de API.
const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";
let tjs = null;
const biblioteca = () =>
  (tjs ??= import(TRANSFORMERS).then((m) => {
    m.env.allowLocalModels = false;
    return m;
  }));

let carregado = null; // { id, tok, modelo }: um modelo de cada vez na placa de vídeo
let carregando = null; // { id, promessa }

async function temWebGPU() {
  try {
    return !!(await navigator.gpu?.requestAdapter());
  } catch {
    return false;
  }
}

/** O arquivo de pesos já está no cache do navegador (transformers.js guarda pelo endereço no Hugging Face)? */
async function emCache(m) {
  try {
    const cache = await caches.open("transformers-cache");
    return !!(await cache.match(`https://huggingface.co/${m.repo}/resolve/main/onnx/model_${m.dtype}.onnx_data`));
  } catch {
    return false;
  }
}

function carregarWeb(id, aoBaixar) {
  if (carregado?.id === id) return Promise.resolve(carregado);
  if (carregando?.id === id) return carregando.promessa;
  const m = MODELOS[id];
  const promessa = (async () => {
    const { AutoTokenizer, AutoModelForCausalLM } = await biblioteca();
    if (carregado) {
      await carregado.modelo.dispose();
      carregado = null;
    }
    // a barra acompanha o maior arquivo (os pesos): os pequenos (configuração, tokenizador) terminam antes e a fariam
    // pular para trás quando os pesos começassem
    let maior = { file: null, total: 50e6 }; // o tokenizador do Gemma tem 20 MB; os pesos, centenas
    const progresso = (p) => {
      if (p.status !== "progress" || !p.total) return;
      if (p.total > maior.total) maior = { file: p.file, total: p.total };
      if (p.file === maior.file) aoBaixar?.(p.loaded / p.total);
    };
    const tok = await AutoTokenizer.from_pretrained(m.repo, { progress_callback: progresso });
    const modelo = await AutoModelForCausalLM.from_pretrained(m.repo, { dtype: m.dtype, device: "webgpu", progress_callback: progresso });
    carregado = { id, tok, modelo };
    return carregado;
  })().finally(() => { carregando = null; });
  carregando = { id, promessa };
  return promessa;
}

async function escreverWeb(id, pedido, { signal, aoTrecho, aoBaixar }) {
  const { tok, modelo } = await carregarWeb(id, aoBaixar);
  signal?.throwIfAborted();
  const { TextStreamer, InterruptableStoppingCriteria } = await biblioteca();
  const parar = new InterruptableStoppingCriteria();
  const aoAbortar = () => parar.interrupt();
  signal?.addEventListener("abort", aoAbortar);
  let bruto = "";
  try {
    // sem o modo de raciocínio do LFM3 (sem isto, ele escreve o plano em inglês antes do texto); o Gemma ignora a opção
    const entrada = tok.apply_chat_template(mensagens(pedido), { add_generation_prompt: true, return_dict: true, enable_thinking: false });
    const streamer = new TextStreamer(tok, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (trecho) => {
        bruto += trecho;
        aoTrecho?.(limpar(bruto));
      },
    });
    // sem sorteio e com penalidade de repetição: foi como os modelos pequenos foram testados (sem isso, repetem frases)
    await modelo.generate({ ...entrada, max_new_tokens: 200, do_sample: false, repetition_penalty: 1.1, streamer, stopping_criteria: parar });
  } finally {
    signal?.removeEventListener("abort", aoAbortar);
  }
  signal?.throwIfAborted();
  return limpar(bruto);
}

// ---------- o que a página usa ----------

/**
 * Gemini: "available" | "downloadable" | "downloading" | "unavailable" | "sem-api" (navegador sem a Prompt API).
 * Gemma e LFM3: "available" (já baixado) | "downloadable" | "sem-webgpu".
 */
export async function disponibilidade(id) {
  const m = MODELOS[id];
  if (m.tipo === "chrome") {
    if (!("LanguageModel" in globalThis)) return "sem-api";
    try {
      return await LanguageModel.availability();
    } catch {
      return "unavailable";
    }
  }
  if (!(await temWebGPU())) return "sem-webgpu";
  return (await emCache(m)) ? "available" : "downloadable";
}

export const usavel = (d) => d === "available" || d === "downloadable" || d === "downloading";

/** Deixa o modelo pronto (baixa, se precisar); chamar dentro do clique em que a pessoa aceitou. */
export async function preparar(id, aoBaixar) {
  if (MODELOS[id].tipo === "chrome") await sessaoChrome(aoBaixar);
  else await carregarWeb(id, aoBaixar);
}

/**
 * Escreve um texto a partir do pedido; aoTrecho(texto) recebe o texto até ali a cada pedaço que chega. Chamar ainda
 * dentro do clique: na primeira vez, o Chrome baixa o Gemini Nano, e o download exige um gesto da pessoa.
 */
export function escrever(id, pedido, opcoes = {}) {
  return MODELOS[id].tipo === "chrome" ? escreverChrome(pedido, opcoes) : escreverWeb(id, pedido, opcoes);
}
