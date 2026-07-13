// Pega as coisas que vamos usar no HTML
const canvas = document.getElementById("jogo");
const ctx = canvas.getContext("2d");
const placarPontos = document.getElementById("pontos");
const placarRecorde = document.getElementById("recorde");
const placarFinal = document.getElementById("placarFinal");
const telaFimDeJogo = document.getElementById("fimDeJogo");
const botaoReiniciar = document.getElementById("botaoReiniciar");

// O tabuleiro é dividido em casinhas quadradas, como um tabuleiro de xadrez.
// A cobrinha nunca fica "no meio" de uma casinha: ela pula de uma para a outra.
const TAMANHO_DA_CASA = 20; // cada casinha tem 20 pixels
const CASAS = canvas.width / TAMANHO_DA_CASA; // 400 / 20 = 20 casinhas de cada lado

// A cobrinha é uma LISTA de casinhas. A primeira da lista é a cabeça.
// Ex: [{x:5,y:10}, {x:4,y:10}, {x:3,y:10}] é uma cobrinha de 3 pedaços.
let cobrinha = [];

// Para que lado a cobrinha está andando (uma casinha por vez).
// x:1 = direita, x:-1 = esquerda, y:1 = baixo, y:-1 = cima.
let direcao = { x: 1, y: 0 };

// As viradas que o jogador pediu e ainda não aconteceram.
// Sem essa fila, apertando ⬆️ e ⬅️ bem rápido a cobrinha viraria duas vezes
// no mesmo passo e daria meia-volta em cima de si mesma.
let filaDeViradas = [];

// A fruta que está no tabuleiro agora
let fruta = null;

// Partículas dos efeitos visuais (os pontinhos coloridos)
let particulas = [];

// Estado do jogo
let pontos = 0;
let jogoAtivo = true;
let idDoPasso = null; // o "relógio" que faz a cobrinha andar

// O recorde fica guardado no navegador, então não some quando fecha a página
let recorde = Number(localStorage.getItem("recordeCobrinha")) || 0;
placarRecorde.textContent = recorde;

// Emojis sorteados para a fruta
const emojisDeFruta = ["🍎", "🍌", "🍇", "🍊", "🍓", "🍒"];

// --- VELOCIDADE ---
// A cobrinha começa devagar e vai ficando mais rápida a cada fruta comida,
// MAS só até um certo ponto. Sem esse limite o jogo viraria impossível.
const TEMPO_INICIAL = 140; // milissegundos entre um passo e outro (quanto maior, mais devagar)
const TEMPO_MINIMO = 70; // o teto de velocidade: daqui não passa
const ACELERACAO_POR_FRUTA = 4; // o quanto cada fruta encurta o tempo do passo

function tempoDoPasso() {
  const tempo = TEMPO_INICIAL - pontos * ACELERACAO_POR_FRUTA;

  // O Math.max escolhe o MAIOR entre os dois: enquanto a conta acima for
  // maior que o mínimo, vale ela; quando ficar menor, vale o mínimo.
  return Math.max(TEMPO_MINIMO, tempo);
}

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

// O barulhinho de comer a fruta: duas notas rápidas subindo.
function tocarSomDeComer() {
  tocarNota(660, 0.08, "square", 0.15);
  setTimeout(() => tocarNota(880, 0.1, "square", 0.15), 60);
}

// O som de bater: duas notas graves e roucas.
function tocarSomDeBatida() {
  tocarNota(160, 0.25, "sawtooth", 0.25);
  setTimeout(() => tocarNota(80, 0.3, "sawtooth", 0.2), 100);
}

// Os navegadores só deixam tocar som depois que o jogador interage com a
// página (clica, aperta uma tecla ou encosta o dedo).
function acordarOSom() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

document.addEventListener("keydown", acordarOSom, { once: true });
canvas.addEventListener("touchstart", acordarOSom, { once: true });

// --- Pede para a cobrinha virar para um lado ---
// A cobrinha não pode dar meia-volta em cima do próprio corpo, então uma
// virada que seja o contrário exato de onde ela vai é simplesmente ignorada.
function pedirVirada(x, y) {
  // De onde a cobrinha vai virar: da última virada da fila, ou de onde ela
  // está indo agora se a fila estiver vazia.
  const anterior = filaDeViradas.length > 0 ? filaDeViradas[filaDeViradas.length - 1] : direcao;

  const eMeiaVolta = anterior.x === -x && anterior.y === -y;
  const eOMesmoLado = anterior.x === x && anterior.y === y;
  if (eMeiaVolta || eOMesmoLado) return;

  filaDeViradas.push({ x: x, y: y });
}

// --- Controles do teclado (setas e também W A S D) ---
document.addEventListener("keydown", (evento) => {
  const tecla = evento.key.toLowerCase();

  if (tecla === "arrowup" || tecla === "w") pedirVirada(0, -1);
  if (tecla === "arrowdown" || tecla === "s") pedirVirada(0, 1);
  if (tecla === "arrowleft" || tecla === "a") pedirVirada(-1, 0);
  if (tecla === "arrowright" || tecla === "d") pedirVirada(1, 0);

  // As setas rolariam a página para baixo; aqui elas são só do jogo.
  if (tecla.startsWith("arrow")) evento.preventDefault();

  // A tecla espaço reinicia o jogo a qualquer momento
  if (evento.key === " ") {
    evento.preventDefault();
    reiniciarJogo();
  }
});

// --- Controles de toque (celular): deslizar o dedo ---
// Guardamos onde o dedo encostou e, quando ele sai, olhamos para que lado
// ele andou mais: para os lados ou para cima/baixo.
let dedoComecouEm = null;

canvas.addEventListener(
  "touchstart",
  (evento) => {
    evento.preventDefault(); // impede a página de rolar enquanto você joga
    const dedo = evento.touches[0];
    dedoComecouEm = { x: dedo.clientX, y: dedo.clientY };
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (evento) => {
    evento.preventDefault();
    if (dedoComecouEm === null) return;

    const dedo = evento.touches[0];
    const andouX = dedo.clientX - dedoComecouEm.x;
    const andouY = dedo.clientY - dedoComecouEm.y;

    // Só vale como "deslizada" se o dedo andou uma boa distância. Assim um
    // tremidinha de nada não faz a cobrinha virar sem querer.
    const DISTANCIA_MINIMA = 24;
    if (Math.abs(andouX) < DISTANCIA_MINIMA && Math.abs(andouY) < DISTANCIA_MINIMA) return;

    if (Math.abs(andouX) > Math.abs(andouY)) {
      // Andou mais para os lados
      pedirVirada(andouX > 0 ? 1 : -1, 0);
    } else {
      // Andou mais para cima ou para baixo
      pedirVirada(0, andouY > 0 ? 1 : -1);
    }

    // O próximo deslize começa a contar daqui, para dar pra fazer curvas
    // seguidas sem tirar o dedo da tela.
    dedoComecouEm = { x: dedo.clientX, y: dedo.clientY };
  },
  { passive: false }
);

canvas.addEventListener("touchend", () => {
  dedoComecouEm = null;
});

// --- Coloca uma fruta nova numa casinha vazia ---
function criarFruta() {
  // Sorteia uma casinha até cair numa que a cobrinha NÃO esteja ocupando.
  let x, y;
  do {
    x = Math.floor(Math.random() * CASAS);
    y = Math.floor(Math.random() * CASAS);
  } while (estaNaCobrinha(x, y));

  fruta = {
    x: x,
    y: y,
    emoji: emojisDeFruta[Math.floor(Math.random() * emojisDeFruta.length)],
  };
}

// Verifica se uma casinha está ocupada por algum pedaço da cobrinha
function estaNaCobrinha(x, y) {
  return cobrinha.some((pedaco) => pedaco.x === x && pedaco.y === y);
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
      vida: 20, // quantos passos a partícula dura
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

// --- UM PASSO DA COBRINHA ---
// É aqui que o jogo todo acontece: a cobrinha anda uma casinha.
function darUmPasso() {
  // Se o jogador pediu uma virada, ela vale a partir de agora
  if (filaDeViradas.length > 0) {
    direcao = filaDeViradas.shift();
  }

  // A cabeça nova é a cabeça velha andando uma casinha para o lado da direção
  const cabeca = {
    x: cobrinha[0].x + direcao.x,
    y: cobrinha[0].y + direcao.y,
  };

  // Bateu na parede?
  const bateuNaParede =
    cabeca.x < 0 || cabeca.y < 0 || cabeca.x >= CASAS || cabeca.y >= CASAS;

  // Bateu no próprio corpo?
  const bateuNoRabo = estaNaCobrinha(cabeca.x, cabeca.y);

  if (bateuNaParede || bateuNoRabo) {
    terminarJogo();
    return;
  }

  // A cabeça nova entra na frente da lista
  cobrinha.unshift(cabeca);

  if (fruta !== null && cabeca.x === fruta.x && cabeca.y === fruta.y) {
    // Comeu! A cobrinha CRESCE, ou seja: o rabo não é removido.
    pontos += 1;
    placarPontos.textContent = pontos;
    tocarSomDeComer();
    criarParticulas(
      fruta.x * TAMANHO_DA_CASA + TAMANHO_DA_CASA / 2,
      fruta.y * TAMANHO_DA_CASA + TAMANHO_DA_CASA / 2,
      "#7cfc00"
    );
    criarFruta();
  } else {
    // Não comeu: o rabo sai da lista. Assim a cobrinha "anda" sem crescer,
    // porque ganhou uma casinha na frente e perdeu uma atrás.
    cobrinha.pop();
  }
}

// --- Desenha a cobrinha ---
function desenharCobrinha() {
  cobrinha.forEach((pedaco, i) => {
    const x = pedaco.x * TAMANHO_DA_CASA;
    const y = pedaco.y * TAMANHO_DA_CASA;
    const ehCabeca = i === 0;

    // Como o fundo é verde, a cobrinha é de um verde bem escuro, para
    // aparecer bem. A cabeça é mais clara, e o corpo vai escurecendo até a
    // ponta do rabo.
    ctx.fillStyle = ehCabeca ? "#1e5b2a" : `hsl(125, 55%, ${22 - Math.min(i, 10)}%)`;

    // Cada pedaço preenche a casinha INTEIRA, sem sobrar nenhuma folguinha:
    // assim eles se encostam e a cobrinha fica sendo um corpo só.
    ctx.fillRect(x, y, TAMANHO_DA_CASA, TAMANHO_DA_CASA);

    if (ehCabeca) desenharOlhos(x, y);
  });
}

// Os dois olhinhos da cabeça, sempre virados para o lado que ela está indo
function desenharOlhos(x, y) {
  const meio = TAMANHO_DA_CASA / 2;

  // Os olhos ficam um pouco à frente do centro da cabeça, no sentido da
  // direção, e afastados um do outro no sentido de lado.
  const frenteX = direcao.x * 4;
  const frenteY = direcao.y * 4;

  // O "lado" é a direção girada 90 graus: se ela anda na horizontal, os olhos
  // se afastam na vertical, e vice-versa.
  const ladoX = direcao.y * 4;
  const ladoY = direcao.x * 4;

  ctx.fillStyle = "white";
  for (const sinal of [1, -1]) {
    ctx.beginPath();
    ctx.arc(
      x + meio + frenteX + ladoX * sinal,
      y + meio + frenteY + ladoY * sinal,
      2.2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

// --- Desenha as partículas dos efeitos ---
function desenharParticulas() {
  for (const p of particulas) {
    // Quanto menos vida, mais transparente a partícula fica
    ctx.globalAlpha = Math.max(0, p.vida / 20);
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

  // O xadrezinho do gramado, só para ficar bonito: um verde bem parecido
  // com o fundo, um tiquinho mais escuro.
  ctx.fillStyle = "#58a02e";
  for (let linha = 0; linha < CASAS; linha++) {
    for (let coluna = 0; coluna < CASAS; coluna++) {
      const casaEscura = (linha + coluna) % 2 === 0;
      if (casaEscura) {
        ctx.fillRect(
          coluna * TAMANHO_DA_CASA,
          linha * TAMANHO_DA_CASA,
          TAMANHO_DA_CASA,
          TAMANHO_DA_CASA
        );
      }
    }
  }

  if (fruta !== null) {
    ctx.font = `${TAMANHO_DA_CASA - 3}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      fruta.emoji,
      fruta.x * TAMANHO_DA_CASA + TAMANHO_DA_CASA / 2,
      fruta.y * TAMANHO_DA_CASA + TAMANHO_DA_CASA / 2
    );
  }

  desenharCobrinha();
  desenharParticulas();
}

// --- O loop principal: dá um passo, desenha e se agenda de novo ---
// Aqui não usamos requestAnimationFrame como nos outros jogos, porque a
// cobrinha não desliza suavemente: ela pula de casinha em casinha, num
// ritmo certinho. O setTimeout é justamente o "relógio" desse ritmo.
function loopDoJogo() {
  if (!jogoAtivo) return;

  darUmPasso();
  if (!jogoAtivo) return; // o passo pode ter acabado com o jogo (bateu)

  atualizarParticulas();
  desenhar();

  idDoPasso = setTimeout(loopDoJogo, tempoDoPasso());
}

// --- Termina o jogo e mostra a tela de fim de jogo ---
function terminarJogo() {
  jogoAtivo = false;
  tocarSomDeBatida();

  // A cabeça explode em pontinhos vermelhos no lugar onde bateu
  criarParticulas(
    cobrinha[0].x * TAMANHO_DA_CASA + TAMANHO_DA_CASA / 2,
    cobrinha[0].y * TAMANHO_DA_CASA + TAMANHO_DA_CASA / 2,
    "#e94560"
  );
  desenhar();

  // Se o jogador bateu o recorde, guarda o novo recorde no navegador
  if (pontos > recorde) {
    recorde = pontos;
    localStorage.setItem("recordeCobrinha", recorde);
    placarRecorde.textContent = recorde;
  }

  placarFinal.textContent = `Você comeu ${pontos} frutas! Recorde: ${recorde}`;
  telaFimDeJogo.classList.remove("escondido");
}

// --- Reinicia o jogo do zero ---
function reiniciarJogo() {
  // Se já existe um passo agendado, cancela ele antes de começar outro
  if (idDoPasso !== null) {
    clearTimeout(idDoPasso);
  }

  // A cobrinha começa com 3 pedaços, no meio do tabuleiro, olhando para a direita
  const meio = Math.floor(CASAS / 2);
  cobrinha = [
    { x: meio, y: meio },
    { x: meio - 1, y: meio },
    { x: meio - 2, y: meio },
  ];

  direcao = { x: 1, y: 0 };
  filaDeViradas = [];
  particulas = [];
  pontos = 0;
  placarPontos.textContent = pontos;
  telaFimDeJogo.classList.add("escondido");
  criarFruta();

  jogoAtivo = true;
  desenhar();

  // Um respiro antes da cobrinha sair andando, para dar tempo de se preparar
  idDoPasso = setTimeout(loopDoJogo, 600);
}

botaoReiniciar.addEventListener("click", reiniciarJogo);

// Começa o jogo!
reiniciarJogo();
