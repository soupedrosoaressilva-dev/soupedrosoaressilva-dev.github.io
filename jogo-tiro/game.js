// Pega as coisas que vamos usar no HTML
const canvas = document.getElementById("jogo");
const ctx = canvas.getContext("2d");
const placarPontos = document.getElementById("pontos");
const placarVidas = document.getElementById("vidas");
const placarNivel = document.getElementById("nivel");
const placarArma = document.getElementById("arma");
const placarRecorde = document.getElementById("recorde");
const placarFinal = document.getElementById("placarFinal");
const telaFimDeJogo = document.getElementById("fimDeJogo");
const botaoReiniciar = document.getElementById("botaoReiniciar");

// A nave que o jogador controla
const nave = {
  largura: 40,
  altura: 30,
  x: canvas.width / 2 - 20,
  y: canvas.height - 50,
  velocidade: 3,
};

// Listas de coisas que existem no jogo agora
let aliadas = []; // as navinhas amigas que voam do seu lado e atiram sozinhas
let tiros = []; // os tirinhos que a nave dispara
let inimigos = []; // os alienígenas descendo
let particulas = []; // os pontinhos coloridos das explosões
let estrelas = []; // o fundo estrelado que fica se mexendo

// Quantos quadros ainda falta piscar a tela de vermelho (0 = não está piscando)
let flashVermelho = 0;

// Guarda quais teclas estão sendo pressionadas agora
let teclas = {
  esquerda: false,
  direita: false,
  atirar: false,
};

// Estado do jogo
let pontos = 0;
let vidas = 3;
let nivel = 1;
let jogoAtivo = true;
let contadorParaProximoInimigo = 0;
let esperaDoTiro = 0; // impede que a nave atire rápido demais
let idAnimacao = null;

// A arma da nave melhora a cada 5 aliens destruídos, até o nível máximo.
let nivelDaArma = 1;
const NIVEL_MAXIMO_DA_ARMA = 6;

// A cada 10 aliens destruídos você ganha uma navinha aliada (no máximo 4).
const MAXIMO_DE_ALIADAS = 4;

// Quantos inimigos você já destruiu (é diferente dos pontos, porque o chefão
// vale 5 pontos mas conta como um abatido só).
let abatidos = 0;

// A cada 7 abatidos aparece uma NAVE FORTE. Aqui contamos quantas já vieram,
// porque cada nova nave forte é mais poderosa que a anterior.
let ondasDeNaveForte = 0;

// A partir de 1000 pontos começa o MODO NAVES FORTES: acabam os aliens
// comuns e daí em diante só vêm naves fortes!
const PONTOS_DO_MODO_FORTE = 1000;
let jaAvisouModoForte = false;

function estaNoModoNavesFortes() {
  return pontos >= PONTOS_DO_MODO_FORTE;
}

// Depois dos 1000 pontos, as naves fortes não param mais de crescer:
// a cada 40 pontos que você faz, as PRÓXIMAS naves nascem com 1 tiro
// de vida a mais. Isso não tem limite — quanto mais você joga, mais
// duras elas ficam. Antes dos 1000 pontos essa força extra é zero.
function forcaExtraDoModoForte() {
  if (!estaNoModoNavesFortes()) return 0;
  return Math.floor((pontos - PONTOS_DO_MODO_FORTE) / 40);
}

// Um recadinho que aparece no meio da tela por alguns quadros
// (usado para avisar "ARMA MELHOROU!")
let mensagem = { texto: "", tempo: 0 };

// O recorde fica guardado no navegador, então não some quando fecha a página
let recorde = Number(localStorage.getItem("recordeJogoTiro")) || 0;
placarRecorde.textContent = recorde;

// Emojis usados para os alienígenas comuns
const emojisDeAlien = ["👾", "👽", "🛸", "🤖"];

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

// O "piu" do tiro: uma nota que começa aguda e desce bem rápido.
function tocarSomDeTiro() {
  const oscilador = audioCtx.createOscillator();
  const ganho = audioCtx.createGain();

  oscilador.type = "square";
  oscilador.frequency.setValueAtTime(900, audioCtx.currentTime);
  oscilador.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);

  ganho.gain.setValueAtTime(0.1, audioCtx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);

  oscilador.connect(ganho);
  ganho.connect(audioCtx.destination);

  oscilador.start();
  oscilador.stop(audioCtx.currentTime + 0.1);
}

// Som do alien explodindo: duas notas graves e roucas.
function tocarSomDeExplosao() {
  tocarNota(180, 0.15, "sawtooth", 0.2);
  setTimeout(() => tocarNota(90, 0.25, "sawtooth", 0.18), 80);
}

// Som de quando o jogador toma dano: nota grave e feia.
function tocarSomDeDano() {
  tocarNota(200, 0.3, "sawtooth", 0.25);
  setTimeout(() => tocarNota(120, 0.35, "square", 0.2), 120);
}

// Som do chefão sendo destruído: três notas subindo, bem comemorativas.
function tocarSomDeChefao() {
  tocarNota(523, 0.1, "square", 0.18);
  setTimeout(() => tocarNota(659, 0.1, "square", 0.18), 90);
  setTimeout(() => tocarNota(880, 0.2, "square", 0.18), 180);
}

// Som de subir de nível.
function tocarSomDeNivel() {
  tocarNota(659, 0.1, "triangle", 0.2);
  setTimeout(() => tocarNota(988, 0.18, "triangle", 0.2), 100);
}

// O tiro das aliadas é igual ao seu, só que mais baixinho, para não incomodar.
function tocarSomDeTiroAliado() {
  const oscilador = audioCtx.createOscillator();
  const ganho = audioCtx.createGain();

  oscilador.type = "square";
  oscilador.frequency.setValueAtTime(700, audioCtx.currentTime);
  oscilador.frequency.exponentialRampToValueAtTime(250, audioCtx.currentTime + 0.08);

  ganho.gain.setValueAtTime(0.04, audioCtx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);

  oscilador.connect(ganho);
  ganho.connect(audioCtx.destination);

  oscilador.start();
  oscilador.stop(audioCtx.currentTime + 0.08);
}

// Som de perigo: avisa que uma nave forte está chegando (notas graves descendo).
function tocarSomDeAlerta() {
  tocarNota(330, 0.2, "sawtooth", 0.18);
  setTimeout(() => tocarNota(247, 0.2, "sawtooth", 0.18), 180);
  setTimeout(() => tocarNota(165, 0.35, "sawtooth", 0.2), 360);
}

// Som de ganhar uma navinha aliada: notas subindo bem alegres.
function tocarSomDeAliada() {
  tocarNota(440, 0.1, "triangle", 0.2);
  setTimeout(() => tocarNota(660, 0.1, "triangle", 0.2), 90);
  setTimeout(() => tocarNota(880, 0.1, "triangle", 0.2), 180);
  setTimeout(() => tocarNota(1320, 0.25, "triangle", 0.2), 270);
}

// Som da arma melhorando: uma escadinha de quatro notas subindo.
function tocarSomDeMelhoria() {
  tocarNota(523, 0.08, "square", 0.16);
  setTimeout(() => tocarNota(659, 0.08, "square", 0.16), 70);
  setTimeout(() => tocarNota(784, 0.08, "square", 0.16), 140);
  setTimeout(() => tocarNota(1047, 0.25, "square", 0.16), 210);
}

// Uma musiquinha curta e espacial que fica se repetindo em loop.
const melodiaDeFundo = [261.63, 311.13, 392.0, 311.13, 349.23, 261.63];
let indiceDaNota = 0;
let musicaRodando = false;

function tocarProximaNotaDaMusica() {
  if (!jogoAtivo) {
    musicaRodando = false;
    return;
  }

  musicaRodando = true;
  tocarNota(melodiaDeFundo[indiceDaNota], 0.4, "triangle", 0.05);
  indiceDaNota = (indiceDaNota + 1) % melodiaDeFundo.length;

  setTimeout(tocarProximaNotaDaMusica, 450);
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
  if (evento.key === " ") {
    teclas.atirar = true;
    evento.preventDefault(); // evita que a página role para baixo
  }
});

document.addEventListener("keyup", (evento) => {
  if (evento.key === "ArrowLeft") teclas.esquerda = false;
  if (evento.key === "ArrowRight") teclas.direita = false;
  if (evento.key === " ") teclas.atirar = false;
});

// --- FUNDO ESTRELADO ---
// Sorteia um monte de estrelinhas espalhadas pela tela.
function criarEstrelas() {
  estrelas = [];
  for (let i = 0; i < 60; i++) {
    estrelas.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      velocidade: 0.3 + Math.random() * 1.2,
      tamanho: Math.random() * 2 + 1,
    });
  }
}

// As estrelas descem devagar para dar a sensação de que a nave está voando.
// Quando uma sai embaixo, ela volta lá pra cima.
function atualizarEstrelas() {
  for (const estrela of estrelas) {
    estrela.y += estrela.velocidade;
    if (estrela.y > canvas.height) {
      estrela.y = 0;
      estrela.x = Math.random() * canvas.width;
    }
  }
}

// --- DIFICULDADE CRESCENTE ---
// O nível sobe a cada 10 pontos.
function nivelPelosPontos() {
  return Math.floor(pontos / 10) + 1;
}

// Os inimigos começam devagar e vão ficando mais rápidos a cada alien
// destruído: cada ponto acrescenta um tiquinho de velocidade, até um limite.
function velocidadeDoInimigo() {
  return Math.min(2.5, 0.6 + pontos * 0.02);
}

// --- A ARMA VAI MELHORANDO ---
// A cada 5 aliens destruídos a arma sobe um nível (começa no 1, vai até o 6).
function armaPelosPontos() {
  return Math.min(NIVEL_MAXIMO_DA_ARMA, 1 + Math.floor(pontos / 5));
}

// Quanto melhor a arma, menos tempo a nave espera entre um tiro e outro.
function esperaEntreTiros() {
  return Math.max(5, 14 - nivelDaArma * 2);
}

// Quanto melhor a arma, mais rápido o tiro sobe na tela.
function velocidadeDoTiro() {
  return 8 + nivelDaArma;
}

// A partir do nível 3 a nave atira 2 tiros, e do 5 em diante atira 3.
function quantidadeDeTiros() {
  if (nivelDaArma >= 5) return 3;
  if (nivelDaArma >= 3) return 2;
  return 1;
}

// --- AS NAVINHAS ALIADAS ---
// Quantas aliadas você merece ter com os pontos que tem agora: uma a cada 10.
function quantidadeDeAliadas() {
  return Math.min(MAXIMO_DE_ALIADAS, Math.floor(pontos / 10));
}

// Onde cada aliada fica: a primeira à esquerda, a segunda à direita,
// a terceira mais longe à esquerda, a quarta mais longe à direita...
function distanciaDaAliada(indice) {
  const lado = indice % 2 === 0 ? -1 : 1; // -1 = esquerda, 1 = direita
  const afastamento = 45 + Math.floor(indice / 2) * 38;
  return lado * afastamento;
}

// Cria uma navinha aliada nova, já na posição da nave.
function criarAliada() {
  aliadas.push({
    x: nave.x,
    y: nave.y + 12,
    largura: 20,
    altura: 16,
    esperaDoTiro: Math.floor(Math.random() * 10), // cada uma atira num ritmo
  });
}

// As aliadas também melhoram junto com a sua arma: elas atiram mais rápido
// e, quando a arma chega no nível 5, cada uma passa a soltar 2 tiros.
function esperaEntreTirosDaAliada() {
  return Math.max(10, 26 - nivelDaArma * 3);
}

function quantidadeDeTirosDaAliada() {
  return nivelDaArma >= 5 ? 2 : 1;
}

// Faz uma aliada atirar.
function atirarComAliada(aliada) {
  const quantidade = quantidadeDeTirosDaAliada();
  const meio = aliada.x + aliada.largura / 2;
  const espacamento = 8;
  const deslocamentoInicial = -((quantidade - 1) / 2) * espacamento;

  for (let i = 0; i < quantidade; i++) {
    tiros.push({
      x: meio + deslocamentoInicial + i * espacamento - 1.5,
      y: aliada.y,
      largura: 3, // o tiro da aliada é mais fininho que o seu
      altura: 10,
      velocidade: velocidadeDoTiro(),
    });
  }

  aliada.esperaDoTiro = esperaEntreTirosDaAliada();
  tocarSomDeTiroAliado();
}

// Move as aliadas (elas seguem a sua nave com um atrasinho) e faz cada uma atirar.
function atualizarAliadas() {
  for (let i = 0; i < aliadas.length; i++) {
    const aliada = aliadas[i];

    // Para onde ela quer ir: do lado da sua nave
    let alvoX = nave.x + nave.largura / 2 + distanciaDaAliada(i) - aliada.largura / 2;

    // Não deixa a aliada sair da tela
    if (alvoX < 0) alvoX = 0;
    if (alvoX + aliada.largura > canvas.width) alvoX = canvas.width - aliada.largura;

    // Em vez de grudar na posição, ela vai chegando aos poucos (fica bonito!)
    aliada.x += (alvoX - aliada.x) * 0.12;
    aliada.y = nave.y + 12;

    // As aliadas atiram sozinhas, sem você precisar apertar nada
    if (aliada.esperaDoTiro > 0) {
      aliada.esperaDoTiro -= 1;
    } else {
      atirarComAliada(aliada);
    }
  }
}

// Quanto maior o nível, menor o tempo entre um inimigo e outro (até um limite).
function intervaloEntreInimigos() {
  // No modo naves fortes elas demoram mais para aparecer: como cada uma
  // aguenta um monte de tiro, se viessem de montão a tela entupia.
  if (estaNoModoNavesFortes()) return 75;

  return Math.max(25, 90 - nivel * 6);
}

// --- Cria um novo inimigo no topo da tela ---
function criarInimigo() {
  // Depois de 1000 pontos, os aliens comuns e os chefões somem de vez:
  // só vêm naves fortes! (sem o alarde do aviso, senão tocaria toda hora)
  if (estaNoModoNavesFortes()) {
    criarNaveForte(false);
    return;
  }

  // A cada 15% das vezes vem um "chefão": mais lento, aguenta 3 tiros e vale 5 pontos.
  const ehChefao = Math.random() < 0.15;

  const tamanho = ehChefao ? 46 : 32;
  const emoji = ehChefao ? "🛸" : emojisDeAlien[Math.floor(Math.random() * emojisDeAlien.length)];
  const vida = ehChefao ? 3 : 1; // quantos tiros ele aguenta

  inimigos.push({
    x: Math.random() * (canvas.width - tamanho),
    y: -tamanho,
    tamanho: tamanho,
    emoji: emoji,
    velocidade: ehChefao ? velocidadeDoInimigo() * 0.6 : velocidadeDoInimigo(),
    vidaDoInimigo: vida,
    vidaMaxima: vida, // guardamos a vida cheia para desenhar a barrinha
    pontosQueVale: ehChefao ? 5 : 1,
    ehChefao: ehChefao,
    ehForte: false,
    // Os inimigos também balançam para os lados, para ficar mais difícil de acertar
    balanco: Math.random() * Math.PI * 2,
    forcaDoBalanco: ehChefao ? 0.8 : 1.4,
  });
}

// --- Cria uma NAVE FORTE (aparece a cada 7 aliens abatidos) ---
// Cada onda de nave forte vem mais poderosa que a anterior: aguenta mais
// tiros, é maior e vale mais pontos.
// O "comAviso" liga o som de alerta e o recado na tela. No modo naves fortes
// ele fica desligado, senão o alarme tocaria a cada nave que nascesse.
function criarNaveForte(comAviso = true) {
  ondasDeNaveForte += 1;

  // A vida começa em 4 e sobe 1 a cada onda, até no máximo 14 tiros.
  // Depois dos 1000 pontos entra a força extra, que NÃO tem limite: elas
  // vão ficando cada vez mais fortes, sem parar.
  const vida = Math.min(14, 3 + ondasDeNaveForte) + forcaExtraDoModoForte();
  const tamanho = Math.min(70, 48 + ondasDeNaveForte * 2);

  // Quanto mais ondas, mais assustador fica o bichinho
  const emojisFortes = ["👹", "🐲", "🦑", "👺", "☠️"];
  const emoji = emojisFortes[Math.min(emojisFortes.length - 1, Math.floor((ondasDeNaveForte - 1) / 2))];

  inimigos.push({
    x: Math.random() * (canvas.width - tamanho),
    y: -tamanho,
    tamanho: tamanho,
    emoji: emoji,
    // A nave forte é lenta: dá tempo de acertar todos os tiros nela.
    // No modo naves fortes ela também vai acelerando aos poucos.
    velocidade: Math.min(3, velocidadeDoInimigo() * 0.45 + forcaExtraDoModoForte() * 0.05),
    vidaDoInimigo: vida,
    vidaMaxima: vida,
    pontosQueVale: vida, // quanto mais dura, mais pontos vale
    ehChefao: false,
    ehForte: true,
    balanco: Math.random() * Math.PI * 2,
    forcaDoBalanco: 0.6,
  });

  if (comAviso) {
    tocarSomDeAlerta();
    mostrarMensagem("NAVE FORTE!");
  }
}

// --- Faz a nave atirar (respeitando a espera entre um tiro e outro) ---
function atirar() {
  if (esperaDoTiro > 0) return;

  const quantidade = quantidadeDeTiros();
  const meioDaNave = nave.x + nave.largura / 2;
  const velocidade = velocidadeDoTiro();

  // Com 2 ou 3 tiros, eles saem lado a lado, espalhados a partir do meio da nave.
  const espacamento = 10;
  const deslocamentoInicial = -((quantidade - 1) / 2) * espacamento;

  for (let i = 0; i < quantidade; i++) {
    tiros.push({
      x: meioDaNave + deslocamentoInicial + i * espacamento - 2,
      y: nave.y,
      largura: 4,
      altura: 12,
      velocidade: velocidade,
    });
  }

  esperaDoTiro = esperaEntreTiros();
  tocarSomDeTiro();
}

// --- EFEITOS VISUAIS: partículas ---
// Cria vários pontinhos que se espalham a partir de um lugar.
function criarParticulas(x, y, cor, quantidade = 12) {
  for (let i = 0; i < quantidade; i++) {
    particulas.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 6, // velocidade para os lados
      vy: (Math.random() - 0.5) * 6, // velocidade para cima/baixo
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
    p.vida -= 1;
    if (p.vida <= 0) particulas.splice(i, 1);
  }
}

// --- Move a nave de acordo com as teclas pressionadas ---
function moverNave() {
  if (teclas.esquerda) nave.x -= nave.velocidade;
  if (teclas.direita) nave.x += nave.velocidade;

  // Não deixa a nave sair da tela
  if (nave.x < 0) nave.x = 0;
  if (nave.x + nave.largura > canvas.width) {
    nave.x = canvas.width - nave.largura;
  }
}

// --- Move os tiros e apaga os que saíram pela parte de cima da tela ---
function atualizarTiros() {
  for (let i = tiros.length - 1; i >= 0; i--) {
    const tiro = tiros[i];
    tiro.y -= tiro.velocidade;
    if (tiro.y + tiro.altura < 0) {
      tiros.splice(i, 1);
    }
  }
}

// --- Verifica se dois retângulos estão se encostando ---
// É assim que o jogo sabe que um tiro acertou um alien, ou que um alien
// bateu na nave: a gente imagina uma caixinha em volta de cada um e vê
// se as duas caixinhas se cruzam.
function estaoColidindo(a, b) {
  return (
    a.x < b.x + b.largura &&
    a.x + a.largura > b.x &&
    a.y < b.y + b.altura &&
    a.y + a.altura > b.y
  );
}

// Transforma um inimigo (que é quadrado) numa "caixinha" para a colisão
function caixaDoInimigo(inimigo) {
  return {
    x: inimigo.x,
    y: inimigo.y,
    largura: inimigo.tamanho,
    altura: inimigo.tamanho,
  };
}

// --- Tira uma vida do jogador (e pisca a tela de vermelho) ---
function perderVida() {
  vidas -= 1;
  placarVidas.textContent = vidas;
  flashVermelho = 15;
  tocarSomDeDano();
  if (vidas <= 0) {
    terminarJogo();
  }
}

// --- Ganha pontos e sobe de nível quando dá a hora ---
function ganharPontos(quantidade) {
  pontos += quantidade;
  placarPontos.textContent = pontos;

  const novoNivel = nivelPelosPontos();
  if (novoNivel > nivel) {
    nivel = novoNivel;
    placarNivel.textContent = nivel;
    tocarSomDeNivel();
  }

  // A cada 5 aliens destruídos, a arma da nave melhora
  const novaArma = armaPelosPontos();
  if (novaArma > nivelDaArma) {
    nivelDaArma = novaArma;
    placarArma.textContent = nivelDaArma;
    tocarSomDeMelhoria();

    if (nivelDaArma === 3) {
      mostrarMensagem("TIRO DUPLO!");
    } else if (nivelDaArma === 5) {
      mostrarMensagem("TIRO TRIPLO!");
    } else if (nivelDaArma === NIVEL_MAXIMO_DA_ARMA) {
      mostrarMensagem("ARMA NO MÁXIMO!");
    } else {
      mostrarMensagem("ARMA MELHOROU!");
    }

    // Soltinha de partículas douradas em volta da nave, para comemorar
    criarParticulas(nave.x + nave.largura / 2, nave.y + nave.altura / 2, "gold", 20);
  }

  // A cada 10 aliens destruídos, uma navinha aliada entra no time.
  // O "while" é porque o chefão vale 5 pontos de uma vez: se você passar de
  // 9 para 14 pontos, ainda assim ganha a aliada que estava faltando.
  while (aliadas.length < quantidadeDeAliadas()) {
    criarAliada();
    tocarSomDeAliada();
    mostrarMensagem("NAVE ALIADA!");
    criarParticulas(nave.x + nave.largura / 2, nave.y, "#4dd0e1", 20);
  }

  // Chegou a 1000 pontos? Avisa (uma vez só) que agora o bicho vai pegar.
  if (estaNoModoNavesFortes() && !jaAvisouModoForte) {
    jaAvisouModoForte = true;
    tocarSomDeAlerta();
    mostrarMensagem("SÓ NAVES FORTES!");

    // Limpa os aliens fraquinhos que ainda estavam na tela: acabou a moleza
    for (const inimigo of inimigos) {
      criarParticulas(
        inimigo.x + inimigo.tamanho / 2,
        inimigo.y + inimigo.tamanho / 2,
        "#7cfc00",
        8
      );
    }
    inimigos = [];
  }
}

// --- Mostra um recadinho no meio da tela por um tempinho ---
function mostrarMensagem(texto) {
  mensagem.texto = texto;
  mensagem.tempo = 70; // dura uns 70 quadros (mais ou menos 1 segundo)
}

// --- Conta mais um inimigo destruído e chama a nave forte na hora certa ---
function contarAbatido() {
  abatidos += 1;

  // O "resto da divisão" (%) por 7 dá zero de 7 em 7: 7, 14, 21, 28...
  // (no modo naves fortes isso não faz sentido, porque TODAS já são fortes)
  if (abatidos % 7 === 0 && !estaNoModoNavesFortes()) {
    criarNaveForte();
  }
}

// --- Move todos os inimigos e verifica o que aconteceu com cada um ---
function atualizarInimigos() {
  for (let i = inimigos.length - 1; i >= 0; i--) {
    const inimigo = inimigos[i];

    // Desce e balança de um lado para o outro
    inimigo.y += inimigo.velocidade;
    inimigo.balanco += 0.05;
    inimigo.x += Math.sin(inimigo.balanco) * inimigo.forcaDoBalanco;

    // Não deixa o inimigo sair pelos lados da tela
    if (inimigo.x < 0) inimigo.x = 0;
    if (inimigo.x + inimigo.tamanho > canvas.width) {
      inimigo.x = canvas.width - inimigo.tamanho;
    }

    // Bateu na nave? Perde uma vida e o inimigo some.
    const naveComoCaixa = {
      x: nave.x,
      y: nave.y,
      largura: nave.largura,
      altura: nave.altura,
    };
    if (estaoColidindo(caixaDoInimigo(inimigo), naveComoCaixa)) {
      criarParticulas(inimigo.x + inimigo.tamanho / 2, inimigo.y + inimigo.tamanho / 2, "#ff5b7f", 18);
      inimigos.splice(i, 1);
      perderVida();
      continue;
    }

    // Chegou lá embaixo sem ser destruído? Também perde uma vida.
    if (inimigo.y > canvas.height) {
      inimigos.splice(i, 1);
      perderVida();
    }
  }
}

// --- Vê se algum tiro acertou algum inimigo ---
function verificarTiros() {
  for (let i = tiros.length - 1; i >= 0; i--) {
    const tiro = tiros[i];

    for (let j = inimigos.length - 1; j >= 0; j--) {
      const inimigo = inimigos[j];

      if (estaoColidindo(tiro, caixaDoInimigo(inimigo))) {
        // O tiro sempre some ao acertar
        tiros.splice(i, 1);
        inimigo.vidaDoInimigo -= 1;

        const centroX = inimigo.x + inimigo.tamanho / 2;
        const centroY = inimigo.y + inimigo.tamanho / 2;

        if (inimigo.vidaDoInimigo <= 0) {
          // O inimigo foi destruído!
          if (inimigo.ehForte) {
            tocarSomDeChefao();
            criarParticulas(centroX, centroY, "#e94560", 30);
            criarParticulas(centroX, centroY, "gold", 20);
          } else if (inimigo.ehChefao) {
            tocarSomDeChefao();
            criarParticulas(centroX, centroY, "gold", 24);
          } else {
            tocarSomDeExplosao();
            criarParticulas(centroX, centroY, "#7cfc00");
          }

          inimigos.splice(j, 1);
          ganharPontos(inimigo.pontosQueVale);
          contarAbatido();
        } else {
          // Só levou um arranhão: solta poucas partículas e continua vivo
          criarParticulas(centroX, centroY, "#ffa500", 6);
        }

        break; // esse tiro já acabou, não precisa testar os outros inimigos
      }
    }
  }
}

// --- Desenha a nave do jogador (um foguetinho desenhado com linhas) ---
function desenharNave() {
  const { x, y, largura, altura } = nave;

  // Fogo do motor, tremendo um pouquinho a cada quadro
  const tamanhoDoFogo = 8 + Math.random() * 6;
  ctx.fillStyle = "#ff9f1c";
  ctx.beginPath();
  ctx.moveTo(x + largura / 2 - 6, y + altura);
  ctx.lineTo(x + largura / 2 + 6, y + altura);
  ctx.lineTo(x + largura / 2, y + altura + tamanhoDoFogo);
  ctx.closePath();
  ctx.fill();

  // Corpo da nave (um triângulo apontando para cima)
  ctx.fillStyle = "#4dd0e1";
  ctx.beginPath();
  ctx.moveTo(x + largura / 2, y); // bico
  ctx.lineTo(x + largura, y + altura); // canto de baixo à direita
  ctx.lineTo(x, y + altura); // canto de baixo à esquerda
  ctx.closePath();
  ctx.fill();

  // Janelinha da cabine
  ctx.fillStyle = "#0f3460";
  ctx.beginPath();
  ctx.arc(x + largura / 2, y + altura * 0.6, 5, 0, Math.PI * 2);
  ctx.fill();
}

// --- Desenha as navinhas aliadas (versões menores da sua nave) ---
function desenharAliadas() {
  for (const aliada of aliadas) {
    const { x, y, largura, altura } = aliada;

    // Fogo do motorzinho
    ctx.fillStyle = "#ff9f1c";
    ctx.beginPath();
    ctx.moveTo(x + largura / 2 - 3, y + altura);
    ctx.lineTo(x + largura / 2 + 3, y + altura);
    ctx.lineTo(x + largura / 2, y + altura + 4 + Math.random() * 4);
    ctx.closePath();
    ctx.fill();

    // Corpo da aliada (mesmo triângulo da sua nave, só que verdinho e menor)
    ctx.fillStyle = "#7cfc00";
    ctx.beginPath();
    ctx.moveTo(x + largura / 2, y);
    ctx.lineTo(x + largura, y + altura);
    ctx.lineTo(x, y + altura);
    ctx.closePath();
    ctx.fill();
  }
}

// --- Desenha os tiros ---
// A cor do tiro muda conforme a arma vai melhorando: amarelo, laranja e roxo.
function desenharTiros() {
  if (nivelDaArma >= 5) {
    ctx.fillStyle = "#c77dff";
  } else if (nivelDaArma >= 3) {
    ctx.fillStyle = "#ff9f1c";
  } else {
    ctx.fillStyle = "#fff45b";
  }

  for (const tiro of tiros) {
    ctx.fillRect(tiro.x, tiro.y, tiro.largura, tiro.altura);
  }
}

// --- No modo naves fortes, mostra um avisinho no topo da tela ---
function desenharAvisoDoModoForte() {
  if (!estaNoModoNavesFortes()) return;

  ctx.fillStyle = "#ff2e63";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`☠️ MODO NAVES FORTES — força +${forcaExtraDoModoForte()}`, canvas.width / 2, 22);
  ctx.textAlign = "left";
}

// --- Desenha o recadinho no meio da tela (quando tem um para mostrar) ---
function desenharMensagem() {
  if (mensagem.tempo <= 0) return;

  // O recado vai sumindo aos poucos no final
  ctx.globalAlpha = Math.min(1, mensagem.tempo / 25);
  ctx.fillStyle = "gold";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(mensagem.texto, canvas.width / 2, canvas.height / 2);

  // Volta tudo ao normal para não bagunçar os outros desenhos
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

// --- Desenha os inimigos ---
function desenharInimigos() {
  for (const inimigo of inimigos) {
    const centroX = inimigo.x + inimigo.tamanho / 2;
    const centroY = inimigo.y + inimigo.tamanho / 2;

    // A nave forte tem um brilho vermelho pulsando em volta, para você já
    // ver de longe que aquela ali é perigosa.
    if (inimigo.ehForte) {
      const pulso = 0.25 + Math.sin(Date.now() / 150) * 0.15;
      ctx.globalAlpha = pulso;
      ctx.fillStyle = "#e94560";
      ctx.beginPath();
      ctx.arc(centroX, centroY, inimigo.tamanho * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.font = `${inimigo.tamanho}px Arial`;
    // O fillText desenha o emoji com a base na altura y, por isso somamos
    // o tamanho: assim o emoji fica dentro da "caixinha" da colisão.
    ctx.fillText(inimigo.emoji, inimigo.x, inimigo.y + inimigo.tamanho);

    // Todo inimigo que aguenta mais de um tiro ganha uma barrinha de vida
    if (inimigo.vidaMaxima > 1) {
      const larguraCheia = inimigo.tamanho;
      const larguraAtual = (inimigo.vidaDoInimigo / inimigo.vidaMaxima) * larguraCheia;
      ctx.fillStyle = "#555";
      ctx.fillRect(inimigo.x, inimigo.y - 8, larguraCheia, 4);
      ctx.fillStyle = inimigo.ehForte ? "#ff2e63" : "#e94560";
      ctx.fillRect(inimigo.x, inimigo.y - 8, larguraAtual, 4);
    }
  }
}

// --- Desenha o fundo estrelado ---
function desenharEstrelas() {
  ctx.fillStyle = "white";
  for (const estrela of estrelas) {
    ctx.fillRect(estrela.x, estrela.y, estrela.tamanho, estrela.tamanho);
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

  desenharEstrelas();
  desenharAliadas();
  desenharNave();
  desenharTiros();
  desenharInimigos();
  desenharParticulas();
  desenharAvisoDoModoForte();
  desenharMensagem();

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

  moverNave();

  // Se a tecla de atirar está pressionada, tenta atirar
  if (teclas.atirar) atirar();
  if (esperaDoTiro > 0) esperaDoTiro -= 1;

  atualizarAliadas();
  atualizarEstrelas();
  atualizarTiros();
  atualizarInimigos();
  verificarTiros();
  atualizarParticulas();
  desenhar();

  if (flashVermelho > 0) flashVermelho -= 1;
  if (mensagem.tempo > 0) mensagem.tempo -= 1;

  // Cria um inimigo novo de tempos em tempos (mais rápido conforme o nível)
  contadorParaProximoInimigo++;
  if (contadorParaProximoInimigo > intervaloEntreInimigos()) {
    criarInimigo();
    contadorParaProximoInimigo = 0;
  }

  idAnimacao = requestAnimationFrame(loopDoJogo);
}

// --- Termina o jogo e mostra a tela de fim de jogo ---
function terminarJogo() {
  jogoAtivo = false;

  // Se o jogador bateu o recorde, guarda o novo recorde no navegador
  if (pontos > recorde) {
    recorde = pontos;
    localStorage.setItem("recordeJogoTiro", recorde);
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
  vidas = 3;
  nivel = 1;
  nivelDaArma = 1;
  abatidos = 0;
  ondasDeNaveForte = 0;
  jaAvisouModoForte = false;
  mensagem = { texto: "", tempo: 0 };
  aliadas = [];
  tiros = [];
  inimigos = [];
  particulas = [];
  flashVermelho = 0;
  esperaDoTiro = 0;
  contadorParaProximoInimigo = 0;
  nave.x = canvas.width / 2 - nave.largura / 2;

  criarEstrelas();

  placarPontos.textContent = pontos;
  placarVidas.textContent = vidas;
  placarNivel.textContent = nivel;
  placarArma.textContent = nivelDaArma;
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

// Neste jogo a tecla espaço é o tiro, então quem reinicia é a tecla R
document.addEventListener("keydown", (evento) => {
  if (evento.key === "r" || evento.key === "R") {
    reiniciarJogo();
  }
});

// Começa o jogo!
criarEstrelas();
loopDoJogo();
