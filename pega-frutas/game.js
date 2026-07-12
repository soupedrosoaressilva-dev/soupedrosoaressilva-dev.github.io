// Pega as coisas que vamos usar no HTML
const canvas = document.getElementById("jogo");
const ctx = canvas.getContext("2d");
const placarPontos = document.getElementById("pontos");
const placarVidas = document.getElementById("vidas");
const placarRecorde = document.getElementById("recorde");
const placarFinal = document.getElementById("placarFinal");
const telaFimDeJogo = document.getElementById("fimDeJogo");
const botaoReiniciar = document.getElementById("botaoReiniciar");

// A cesta que o jogador controla
const cesta = {
  largura: 80,
  altura: 20,
  x: canvas.width / 2 - 40,
  y: canvas.height - 30,
  velocidade: 6,
};

// Lista de coisas que estão caindo no momento (frutas, bombas, etc.)
let itensCaindo = [];

// Partículas dos efeitos visuais (os pontinhos coloridos)
let particulas = [];

// Quantos quadros ainda falta piscar a tela de vermelho (0 = não está piscando)
let flashVermelho = 0;

// Guarda se as setas estão sendo pressionadas
let teclas = {
  esquerda: false,
  direita: false,
};

// Estado do jogo
let pontos = 0;
let vidas = 5;
let jogoAtivo = true;
let contadorParaProximoItem = 0;
let idAnimacao = null;

// O recorde fica guardado no navegador, então não some quando fecha a página
let recorde = Number(localStorage.getItem("recordePegaFrutas")) || 0;
placarRecorde.textContent = recorde;

// Emojis usados para representar cada tipo de item
const emojisDeFruta = ["🍎", "🍌", "🍇", "🍊", "🍓"];

// --- SOM ---
// O AudioContext é o "alto-falante" do JavaScript. Com ele dá pra criar
// sons na hora, sem precisar de nenhum arquivo de música.
const audioCtx = new AudioContext();

// Toca uma única nota. "frequencia" define se o som é grave ou agudo.
function tocarNota(frequencia, duracao, tipoOnda = "sine", volume = 0.2) {
  const oscilador = audioCtx.createOscillator();
  const ganho = audioCtx.createGain();

  oscilador.type = tipoOnda;
  oscilador.frequency.value = frequencia;

  // O volume começa em "volume" e cai suavemente até quase zero,
  // isso evita um "clique" feio no final do som.
  ganho.gain.setValueAtTime(volume, audioCtx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duracao);

  oscilador.connect(ganho);
  ganho.connect(audioCtx.destination);

  oscilador.start();
  oscilador.stop(audioCtx.currentTime + duracao);
}

// O barulhinho de "comer" a fruta: duas notas rápidas subindo.
function tocarSomDeComer() {
  tocarNota(660, 0.08, "square", 0.15);
  setTimeout(() => tocarNota(880, 0.1, "square", 0.15), 60);
}

// Som da fruta dourada: três notinhas alegres subindo.
function tocarSomDourada() {
  tocarNota(660, 0.08, "square", 0.15);
  setTimeout(() => tocarNota(880, 0.08, "square", 0.15), 60);
  setTimeout(() => tocarNota(1100, 0.12, "square", 0.15), 120);
}

// Som do coração (vida extra): duas notas suaves.
function tocarSomVida() {
  tocarNota(784, 0.12, "sine", 0.2);
  setTimeout(() => tocarNota(1047, 0.15, "sine", 0.2), 100);
}

// O som da bomba explodindo: duas notas graves e roucas.
function tocarSomDeExplosao() {
  tocarNota(150, 0.25, "sawtooth", 0.25);
  setTimeout(() => tocarNota(80, 0.3, "sawtooth", 0.2), 100);
}

// Uma musiquinha curta que fica se repetindo em loop.
const melodiaDeFundo = [523.25, 587.33, 659.25, 587.33, 523.25, 659.25];
let indiceDaNota = 0;

let musicaRodando = false;

function tocarProximaNotaDaMusica() {
  if (!jogoAtivo) {
    musicaRodando = false;
    return;
  }

  musicaRodando = true;
  tocarNota(melodiaDeFundo[indiceDaNota], 0.35, "triangle", 0.06);
  indiceDaNota = (indiceDaNota + 1) % melodiaDeFundo.length;

  setTimeout(tocarProximaNotaDaMusica, 400);
}

// Os navegadores só deixam tocar som depois que o jogador interage com a
// página (clica ou aperta uma tecla). Por isso a música só começa aqui.
let musicaJaComecou = false;
function iniciarMusicaDeFundo() {
  if (musicaJaComecou) return;
  musicaJaComecou = true;

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  tocarProximaNotaDaMusica();
}

document.addEventListener("keydown", iniciarMusicaDeFundo, { once: true });

// --- Controles do teclado ---
document.addEventListener("keydown", (evento) => {
  if (evento.key === "ArrowLeft") teclas.esquerda = true;
  if (evento.key === "ArrowRight") teclas.direita = true;
});

document.addEventListener("keyup", (evento) => {
  if (evento.key === "ArrowLeft") teclas.esquerda = false;
  if (evento.key === "ArrowRight") teclas.direita = false;
});

// --- Controles de toque (celular) ---
// No celular o canvas aparece menor do que ele realmente é. Esta função
// descobre em que ponto do JOGO o dedo encostou, mesmo com a tela encolhida.
function xDoDedoNoCanvas(evento) {
  const dedo = evento.touches[0];
  const area = canvas.getBoundingClientRect();

  // Regra de três: onde o dedo está na tela -> onde isso fica dentro do jogo
  return (dedo.clientX - area.left) * (canvas.width / area.width);
}

// A cesta segue o dedo: ela fica sempre centralizada onde você está tocando.
function moverCestaComODedo(evento) {
  evento.preventDefault(); // impede a página de rolar enquanto você joga

  cesta.x = xDoDedoNoCanvas(evento) - cesta.largura / 2;

  // Não deixa a cesta sair da tela
  if (cesta.x < 0) cesta.x = 0;
  if (cesta.x + cesta.largura > canvas.width) {
    cesta.x = canvas.width - cesta.largura;
  }
}

canvas.addEventListener("touchstart", moverCestaComODedo, { passive: false });
canvas.addEventListener("touchmove", moverCestaComODedo, { passive: false });

// No celular não existe teclado, então a música começa no primeiro toque
canvas.addEventListener("touchstart", iniciarMusicaDeFundo, { once: true });

// --- DIFICULDADE CRESCENTE ---
// Quanto mais pontos, mais rápido as frutas caem (até um limite).
function velocidadeAtual() {
  return Math.min(2.5, 0.75 + pontos * 0.015);
}

// Quanto mais pontos, menor o tempo entre um item e outro (até um limite).
function intervaloEntreItens() {
  return Math.max(40, 120 - pontos * 2);
}

// --- Sorteia qual tipo de item vai cair, cada um com sua chance ---
function sortearTipo() {
  const r = Math.random();
  if (r < 0.05) return "coracao"; // 5%  -> dá uma vida extra
  if (r < 0.13) return "dourada"; // 8%  -> vale 5 pontos
  if (r < 0.33) return "bomba"; // 20% -> tira uma vida
  return "fruta"; // 67% -> vale 1 ponto
}

// --- Cria um novo item no topo da tela ---
function criarItem() {
  const tipo = sortearTipo();

  let tamanho, emoji;
  if (tipo === "bomba") {
    tamanho = 40;
    emoji = "💣";
  } else if (tipo === "dourada") {
    tamanho = 34;
    emoji = "⭐";
  } else if (tipo === "coracao") {
    tamanho = 34;
    emoji = "❤️";
  } else {
    tamanho = 32;
    emoji = emojisDeFruta[Math.floor(Math.random() * emojisDeFruta.length)];
  }

  itensCaindo.push({
    x: Math.random() * (canvas.width - tamanho),
    y: -tamanho,
    velocidade: velocidadeAtual(),
    tipo: tipo,
    tamanho: tamanho,
    emoji: emoji,
  });
}

// --- EFEITOS VISUAIS: partículas ---
// Cria vários pontinhos que se espalham a partir de um lugar.
function criarParticulas(x, y, cor) {
  for (let i = 0; i < 12; i++) {
    particulas.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 5, // velocidade para os lados
      vy: (Math.random() - 0.5) * 5 - 2, // velocidade para cima/baixo
      vida: 30, // quantos quadros a partícula dura
      cor: cor,
    });
  }
}

// Move as partículas e apaga as que já "morreram".
function atualizarParticulas() {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2; // uma "gravidade" leve puxando pra baixo
    p.vida -= 1;
    if (p.vida <= 0) particulas.splice(i, 1);
  }
}

// --- Move a cesta de acordo com as teclas pressionadas ---
function moverCesta() {
  if (teclas.esquerda) cesta.x -= cesta.velocidade;
  if (teclas.direita) cesta.x += cesta.velocidade;

  // Não deixa a cesta sair da tela
  if (cesta.x < 0) cesta.x = 0;
  if (cesta.x + cesta.largura > canvas.width) {
    cesta.x = canvas.width - cesta.largura;
  }
}

// --- Verifica se o item caiu dentro da cesta ---
function itemCaiuNaCesta(item) {
  return (
    item.y + item.tamanho >= cesta.y &&
    item.x + item.tamanho >= cesta.x &&
    item.x <= cesta.x + cesta.largura
  );
}

// --- Tira uma vida do jogador (e pisca a tela de vermelho) ---
function perderVida() {
  vidas -= 1;
  placarVidas.textContent = vidas;
  flashVermelho = 15;
  if (vidas <= 0) {
    terminarJogo();
  }
}

// --- Move todos os itens e verifica o que aconteceu com cada um ---
function atualizarItens() {
  for (let i = itensCaindo.length - 1; i >= 0; i--) {
    const item = itensCaindo[i];
    item.y += item.velocidade;

    // Centro do item, usado para soltar as partículas no lugar certo
    const centroX = item.x + item.tamanho / 2;
    const centroY = item.y;

    if (itemCaiuNaCesta(item)) {
      if (item.tipo === "bomba") {
        tocarSomDeExplosao();
        criarParticulas(centroX, centroY, "#555");
        perderVida();
      } else if (item.tipo === "dourada") {
        pontos += 5;
        placarPontos.textContent = pontos;
        tocarSomDourada();
        criarParticulas(centroX, centroY, "gold");
      } else if (item.tipo === "coracao") {
        vidas += 1;
        placarVidas.textContent = vidas;
        tocarSomVida();
        criarParticulas(centroX, centroY, "#ff5b7f");
      } else {
        pontos += 1;
        placarPontos.textContent = pontos;
        tocarSomDeComer();
        criarParticulas(centroX, centroY, "#7cfc00");
      }
      itensCaindo.splice(i, 1);
    } else if (item.y > canvas.height) {
      // Só perde vida se deixar uma FRUTA comum cair no chão.
      // Bomba, estrela e coração podem passar sem problema.
      if (item.tipo === "fruta") {
        perderVida();
      }
      itensCaindo.splice(i, 1);
    }
  }
}

// --- Desenha a cesta em formato de trapézio, com trama de vime ---
function desenharCesta() {
  const { x, y, largura, altura } = cesta;
  const recuo = 10; // o quanto a base é mais estreita que o topo

  // Corpo da cesta (mais larga em cima, mais estreita embaixo)
  ctx.fillStyle = "#c68642";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + largura, y);
  ctx.lineTo(x + largura - recuo, y + altura);
  ctx.lineTo(x + recuo, y + altura);
  ctx.closePath();
  ctx.fill();

  // Aro reforçado na boca da cesta
  ctx.strokeStyle = "#6b3e0f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + largura, y);
  ctx.stroke();

  // Linhas de trama, para lembrar vime trançado
  ctx.strokeStyle = "#6b3e0f";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const fracao = i / 4;
    const xTopo = x + largura * fracao;
    const xBase = x + recuo + (largura - recuo * 2) * fracao;
    ctx.beginPath();
    ctx.moveTo(xTopo, y + 2);
    ctx.lineTo(xBase, y + altura - 2);
    ctx.stroke();
  }
}

// --- Desenha as partículas dos efeitos ---
function desenharParticulas() {
  for (const p of particulas) {
    // Quanto menos vida, mais transparente a partícula fica
    ctx.globalAlpha = Math.max(0, p.vida / 30);
    ctx.fillStyle = p.cor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; // volta ao normal (senão o resto fica transparente)
}

// --- Desenha tudo na tela ---
function desenhar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  desenharCesta();

  // Desenha os itens, cada um com o seu próprio tamanho
  for (const item of itensCaindo) {
    ctx.font = `${item.tamanho}px Arial`;
    ctx.fillText(item.emoji, item.x, item.y);
  }

  desenharParticulas();

  // Flash vermelho por cima de tudo quando o jogador perde uma vida
  if (flashVermelho > 0) {
    ctx.globalAlpha = (flashVermelho / 15) * 0.4;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }
}

// --- O loop principal do jogo, chamado várias vezes por segundo ---
function loopDoJogo() {
  if (!jogoAtivo) return;

  moverCesta();
  atualizarItens();
  atualizarParticulas();
  desenhar();

  if (flashVermelho > 0) flashVermelho -= 1;

  // Cria um item novo de tempos em tempos (mais rápido conforme os pontos)
  contadorParaProximoItem++;
  if (contadorParaProximoItem > intervaloEntreItens()) {
    criarItem();
    contadorParaProximoItem = 0;
  }

  idAnimacao = requestAnimationFrame(loopDoJogo);
}

// --- Termina o jogo e mostra a tela de fim de jogo ---
function terminarJogo() {
  jogoAtivo = false;

  // Se o jogador bateu o recorde, guarda o novo recorde no navegador
  if (pontos > recorde) {
    recorde = pontos;
    localStorage.setItem("recordePegaFrutas", recorde);
    placarRecorde.textContent = recorde;
  }

  placarFinal.textContent = `Você fez ${pontos} pontos! Recorde: ${recorde}`;
  telaFimDeJogo.classList.remove("escondido");
}

// --- Reinicia o jogo do zero ---
function reiniciarJogo() {
  // Se já existe um loop rodando, cancela ele antes de começar outro
  if (idAnimacao !== null) {
    cancelAnimationFrame(idAnimacao);
  }

  pontos = 0;
  vidas = 5;
  itensCaindo = [];
  particulas = [];
  flashVermelho = 0;
  cesta.x = canvas.width / 2 - 40;
  placarPontos.textContent = pontos;
  placarVidas.textContent = vidas;
  telaFimDeJogo.classList.add("escondido");
  jogoAtivo = true;
  loopDoJogo();

  // Garante que a música esteja tocando (também funciona clicando no botão)
  if (!musicaJaComecou) {
    iniciarMusicaDeFundo();
  } else if (!musicaRodando) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    tocarProximaNotaDaMusica();
  }
}

botaoReiniciar.addEventListener("click", reiniciarJogo);

// A tecla espaço reinicia o jogo a qualquer momento
document.addEventListener("keydown", (evento) => {
  if (evento.key === " ") {
    evento.preventDefault(); // evita que a página role para baixo
    reiniciarJogo();
  }
});

// Começa o jogo!
loopDoJogo();
