// ===== Corrida de Carro 3D (com Three.js) =====
// Você dirige o carro azul numa estrada de 3 faixas, vista de trás e de cima.
// Desvie dos carros que vêm de longe. A velocidade aumenta com o tempo!

// --- Pega as coisas do HTML ---
const container = document.getElementById("cena3d");
const painelPontos = document.getElementById("pontos");
const painelVelocidade = document.getElementById("velocidade");
const painelRecorde = document.getElementById("recorde");
const telaFim = document.getElementById("fimDeJogo");
const placarFinal = document.getElementById("placarFinal");
const botaoReiniciar = document.getElementById("botaoReiniciar");

const LARGURA = 480;
const ALTURA = 560;

// --- Configuração da estrada ---
const FAIXAS = 3;
const POS_FAIXAS = [-3, 0, 3]; // posição X de cada faixa
const DIST_LONGE = -120;       // onde os carros nascem (bem longe)
const DIST_PERTO = 8;          // onde o carro passa da câmera

// ================= MONTAGEM DA CENA 3D =================

// A "cena" é o mundo onde tudo mora.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // céu azul
scene.fog = new THREE.Fog(0x87ceeb, 40, 110); // névoa ao longe (dá profundidade)

// A "câmera" é o olho do jogador, colocada atrás e acima do carro.
const camera = new THREE.PerspectiveCamera(60, LARGURA / ALTURA, 0.1, 1000);
camera.position.set(0, 6, 14);
camera.lookAt(0, 0, -10);

// O "renderer" é quem desenha a cena na tela.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(LARGURA, ALTURA);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// --- Luzes ---
const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(luzAmbiente);

const luzSol = new THREE.DirectionalLight(0xffffff, 0.8);
luzSol.position.set(10, 20, 10);
luzSol.castShadow = true;
scene.add(luzSol);

// --- A estrada (um chão cinza comprido) ---
const estradaGeo = new THREE.PlaneGeometry(12, 400);
const estradaMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const estrada = new THREE.Mesh(estradaGeo, estradaMat);
estrada.rotation.x = -Math.PI / 2; // deita o plano no chão
estrada.position.z = -180;
estrada.receiveShadow = true;
scene.add(estrada);

// --- Gramado dos dois lados (verde) ---
const gramaMat = new THREE.MeshLambertMaterial({ color: 0x3a9d23 });
for (const lado of [-1, 1]) {
  const grama = new THREE.Mesh(new THREE.PlaneGeometry(60, 400), gramaMat);
  grama.rotation.x = -Math.PI / 2;
  grama.position.set(lado * 36, -0.05, -180);
  scene.add(grama);
}

// --- Faixas tracejadas da estrada (linhas amarelas que "correm") ---
const listras = [];
const listraMat = new THREE.MeshBasicMaterial({ color: 0xf5d020 });
for (const x of [-1.5, 1.5]) {
  for (let z = 10; z > DIST_LONGE; z -= 8) {
    const listra = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 3), listraMat);
    listra.position.set(x, 0.02, z);
    scene.add(listra);
    listras.push(listra);
  }
}

// --- Função que monta um carrinho 3D e devolve o grupo de peças ---
function criarCarro3D(cor) {
  const carro = new THREE.Group();

  // corpo de baixo
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.8, 4),
    new THREE.MeshLambertMaterial({ color: cor })
  );
  base.position.y = 0.6;
  base.castShadow = true;
  carro.add(base);

  // cabine (parte de cima)
  const cabine = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.7, 2),
    new THREE.MeshLambertMaterial({ color: cor })
  );
  cabine.position.set(0, 1.3, -0.2);
  cabine.castShadow = true;
  carro.add(cabine);

  // vidro da frente
  const vidro = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.5, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x223344 })
  );
  vidro.position.set(0, 1.35, 0.8);
  carro.add(vidro);

  // 4 rodas pretas
  const rodaGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  const rodaMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const posRodas = [
    [-1, 0.4, 1.2], [1, 0.4, 1.2],
    [-1, 0.4, -1.2], [1, 0.4, -1.2],
  ];
  for (const [x, y, z] of posRodas) {
    const roda = new THREE.Mesh(rodaGeo, rodaMat);
    roda.rotation.z = Math.PI / 2; // deita a roda
    roda.position.set(x, y, z);
    carro.add(roda);
  }

  return carro;
}

// --- Nosso carro (azul) ---
const meuCarro = criarCarro3D(0x3a86ff);
meuCarro.position.set(0, 0, 4);
scene.add(meuCarro);
let faixaAtual = 1; // 0, 1 ou 2 (começa no meio)

// ================= ESTADO DO JOGO =================
let inimigos = [];
let pontos = 0;
let velocidade = 0.25;
let jogando = true;
let contadorSpawn = 0;
let idAnimacao = null;

let recorde = Number(localStorage.getItem("recordeCorrida")) || 0;
painelRecorde.textContent = recorde;

// ================= SOM =================
// O AudioContext é o "alto-falante" do JavaScript. Com ele dá pra criar
// sons na hora, sem precisar de nenhum arquivo de música.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Toca uma nota. "frequencia" define se o som é grave ou agudo.
function tocarNota(frequencia, duracao, tipoOnda = "sine", volume = 0.2) {
  const oscilador = audioCtx.createOscillator();
  const ganho = audioCtx.createGain();
  oscilador.type = tipoOnda;
  oscilador.frequency.value = frequencia;
  // O volume começa em "volume" e cai suave até quase zero (evita "clique" feio)
  ganho.gain.setValueAtTime(volume, audioCtx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duracao);
  oscilador.connect(ganho);
  ganho.connect(audioCtx.destination);
  oscilador.start();
  oscilador.stop(audioCtx.currentTime + duracao);
}

// Barulhinho de "click" para os botões e ao trocar de faixa.
function tocarClique() {
  tocarNota(700, 0.05, "square", 0.12);
}

// Som da batida: notas graves e roucas, tipo uma explosão.
function tocarBatida() {
  tocarNota(160, 0.3, "sawtooth", 0.3);
  setTimeout(() => tocarNota(90, 0.35, "sawtooth", 0.25), 100);
  setTimeout(() => tocarNota(55, 0.4, "sawtooth", 0.2), 200);
}

// Uma musiquinha animada que fica se repetindo em loop enquanto o jogo roda.
const melodia = [392.0, 392.0, 523.25, 392.0, 659.25, 587.33, 523.25, 440.0];
let indiceNota = 0;
let musicaTocando = false;

function tocarProximaNota() {
  if (!jogando) {
    musicaTocando = false;
    return;
  }
  musicaTocando = true;
  tocarNota(melodia[indiceNota], 0.22, "triangle", 0.07);
  indiceNota = (indiceNota + 1) % melodia.length;
  setTimeout(tocarProximaNota, 230);
}

// Os navegadores só deixam tocar som depois que o jogador clica ou aperta uma
// tecla. Por isso a música só começa de verdade aqui, na primeira interação.
let musicaJaComecou = false;
function comecarMusica() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (!musicaTocando && jogando) {
    musicaJaComecou = true;
    tocarProximaNota();
  }
}
document.addEventListener("keydown", comecarMusica, { once: true });
document.addEventListener("click", comecarMusica, { once: true });

const coresInimigos = [0xe94560, 0xf9a826, 0x7b2cbf, 0x2ec4b6, 0xff6b6b];

function corAleatoria() {
  return coresInimigos[Math.floor(Math.random() * coresInimigos.length)];
}

// --- Cria um carro inimigo lá longe, numa faixa aleatória ---
function criarInimigo() {
  const faixa = Math.floor(Math.random() * FAIXAS);
  const carro = criarCarro3D(corAleatoria());
  carro.position.set(POS_FAIXAS[faixa], 0, DIST_LONGE);
  carro.rotation.y = Math.PI; // vira de frente para nós
  carro.userData.faixa = faixa;
  scene.add(carro);
  inimigos.push(carro);
}

// --- Verifica se dois carros se encostaram ---
function colidiu(a, b) {
  const dx = Math.abs(a.position.x - b.position.x);
  const dz = Math.abs(a.position.z - b.position.z);
  return dx < 1.8 && dz < 3.5;
}

// ================= LOOP PRINCIPAL =================
function animar() {
  if (!jogando) return;
  idAnimacao = requestAnimationFrame(animar);

  // Faz o carro deslizar suavemente até a faixa escolhida
  const alvoX = POS_FAIXAS[faixaAtual];
  meuCarro.position.x += (alvoX - meuCarro.position.x) * 0.2;
  // inclina um pouquinho na direção do movimento (dá vida)
  meuCarro.rotation.z = (alvoX - meuCarro.position.x) * 0.15;

  // As listras da estrada "correm" para dar sensação de movimento
  for (const listra of listras) {
    listra.position.z += velocidade;
    if (listra.position.z > DIST_PERTO) listra.position.z = DIST_LONGE;
  }

  // Cria inimigos de tempos em tempos (mais rápido conforme acelera)
  contadorSpawn++;
  const intervalo = Math.max(25, 60 - Math.floor(pontos / 100));
  if (contadorSpawn > intervalo) {
    criarInimigo();
    contadorSpawn = 0;
  }

  // Move os inimigos na nossa direção
  for (let i = inimigos.length - 1; i >= 0; i--) {
    const ini = inimigos[i];
    ini.position.z += velocidade;

    if (colidiu(meuCarro, ini)) {
      return fimDeJogo();
    }

    // Passou por nós? conta ponto e remove
    if (ini.position.z > DIST_PERTO) {
      scene.remove(ini);
      inimigos.splice(i, 1);
      pontos += 10;
      painelPontos.textContent = pontos;
      velocidade += 0.006; // acelera bem de leve
      painelVelocidade.textContent = Math.floor((velocidade - 0.25) * 20 + 1);
    }
  }

  renderer.render(scene, camera);
}

function fimDeJogo() {
  jogando = false;
  tocarBatida(); // efeito sonoro da batida (e a música para porque jogando = false)
  if (pontos > recorde) {
    recorde = pontos;
    localStorage.setItem("recordeCorrida", recorde);
    painelRecorde.textContent = recorde;
  }
  placarFinal.textContent = "Você fez " + pontos + " pontos!";
  telaFim.classList.remove("escondido");
}

function reiniciar() {
  // tira todos os inimigos da cena
  for (const ini of inimigos) scene.remove(ini);
  inimigos = [];

  pontos = 0;
  velocidade = 0.25;
  faixaAtual = 1;
  meuCarro.position.x = 0;
  contadorSpawn = 0;
  painelPontos.textContent = 0;
  painelVelocidade.textContent = 1;
  telaFim.classList.add("escondido");

  if (!jogando) {
    jogando = true;
    animar();
  }

  // Volta a tocar a música se ela tiver parado
  if (musicaJaComecou && !musicaTocando) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    tocarProximaNota();
  }
}

// ================= CONTROLES =================
document.addEventListener("keydown", function (e) {
  // A tecla espaço reinicia o jogo a qualquer momento
  if (e.key === " ") {
    e.preventDefault(); // evita que a página role para baixo
    reiniciar();
    return;
  }

  if (!jogando) return;
  if (e.key === "ArrowLeft" && faixaAtual > 0) {
    faixaAtual--;
    tocarClique(); // barulhinho ao trocar de faixa
  } else if (e.key === "ArrowRight" && faixaAtual < FAIXAS - 1) {
    faixaAtual++;
    tocarClique();
  }
});

// --- Controles de toque (celular) ---
// A estrada tem 3 faixas. A gente divide a tela em 3 pedaços: se o dedo
// está no pedaço da esquerda, o carro vai para a faixa da esquerda, e assim
// por diante. Como isso roda enquanto o dedo arrasta, o carro acompanha ele.
function moverCarroComODedo(evento) {
  evento.preventDefault(); // impede a página de rolar enquanto você joga
  if (!jogando) return;

  const dedo = evento.touches[0];
  const area = container.getBoundingClientRect();

  // De 0 (bem na esquerda da tela) até 1 (bem na direita)
  const fracao = (dedo.clientX - area.left) / area.width;

  // Transforma esse 0 a 1 em uma faixa: 0, 1 ou 2
  let faixaDoDedo = Math.floor(fracao * FAIXAS);
  if (faixaDoDedo < 0) faixaDoDedo = 0;
  if (faixaDoDedo > FAIXAS - 1) faixaDoDedo = FAIXAS - 1;

  // Só faz barulho quando o carro realmente troca de faixa
  if (faixaDoDedo !== faixaAtual) {
    faixaAtual = faixaDoDedo;
    tocarClique();
  }
}

container.addEventListener("touchstart", moverCarroComODedo, { passive: false });
container.addEventListener("touchmove", moverCarroComODedo, { passive: false });

// No celular não existe teclado, então a música começa no primeiro toque
container.addEventListener("touchstart", comecarMusica, { once: true });

// Faz TODOS os botões da página soltarem um "click" ao serem apertados
for (const botao of document.querySelectorAll("button")) {
  botao.addEventListener("click", tocarClique);
}

botaoReiniciar.addEventListener("click", reiniciar);

// --- Começa! ---
animar();
