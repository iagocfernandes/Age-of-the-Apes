// Árvores de diálogo + UI. Opções podem ter: cond() para aparecer,
// check (Carisma mínimo) ou disabledIf() para aparecerem travadas, fx() e next.
import { G, effCAR, addSkillXP } from './state.js';
import { notify, showEnd } from './ui.js';
import { objectiveText } from './quests.js';
import { gainAlert, aggroVaultGuards } from './combat.js';
import { sfx } from './audio.js';

const panel = document.getElementById('dialogPanel');
const elName = document.getElementById('dlgName');
const elText = document.getElementById('dlgText');
const elOpts = document.getElementById('dlgOpts');

let current = null;

function inv() { return G.player.inv; }
function setStage(n) {
  G.quest.stage = n;
  notify('Diário atualizado: ' + objectiveText());
  sfx('quest');
}

const DIALOGS = {
  // ===== MAYA — líder da Resistência humana =====
  maya: {
    name: 'Maya — Líder da Resistência',
    entry() { const s = G.quest.stage; return s === 0 ? 'm0' : s === 1 ? 'm1' : s === 2 ? 'm2' : 'm3'; },
    nodes: {
      m0: {
        text: 'Então você é o símio que desertou do exército do General. Bromo garante por você — ' +
          'e, sinceramente, precisamos de alguém que circule onde humanos são abatidos à vista. ' +
          'Antes do Colapso, nossos cientistas selaram uma "Arca de Dados": remédios, cultivo, ' +
          'tudo que perdemos. Ela está no Cofre, no extremo oeste das ruínas... que agora é um posto militarista.',
        opts: [
          { label: 'O que exatamente você quer que eu faça?', next: 'm0b' },
          { label: 'Por que um humano confiaria em um símio?', next: 'm0c' },
          { label: 'Agora não.', next: null },
        ],
      },
      m0b: {
        text: 'Recupere a Arca. À força, se for preciso — mas cada soldado morto traz mais patrulhas ' +
          'atrás de você. Há outro caminho: a Anciã Lira, na vila pacifista da floresta a leste, emite ' +
          'Selos de Paz que até os militaristas respeitam. Com um Selo, talvez o Capitão Krag recue.',
        opts: [
          { label: 'Aceito. (recebe Pistola + 12 munições)',
            fx() { inv().ammo += 12; if (!G.player.weapons.includes('pistol')) G.player.weapons.push('pistol');
              G.facRep.hum += 5; setStage(1); notify('Recebeu: Pistola e 12 munições (tecla 2 para equipar)'); },
            next: 'm0d' },
          { label: 'Preciso me preparar primeiro.', next: null },
        ],
      },
      m0c: {
        text: 'Não confio. Confio no que você tem a perder: o General executa desertores em praça pública. ' +
          'Nós dois precisamos um do outro vivo. É o suficiente.',
        opts: [{ label: 'Justo.', next: 'm0' }],
      },
      m0d: {
        text: 'Boa sorte, exilado. O Cofre fica seguindo a estrada para oeste, até o fim. Volte com a Arca.',
        opts: [{ label: '(Sair)', next: null }],
      },
      m1: {
        text: 'O Cofre fica no fim da estrada, a oeste das ruínas. Se quiser evitar sangue, procure a ' +
          'Anciã Lira na floresta — a trilha sobe a partir da estrada, a leste. E cuidado com as patrulhas: ' +
          'eles sabem que você desertou.',
        opts: [{ label: 'Entendido.', next: null }],
      },
      m2: {
        text: 'Pelos velhos deuses... a Arca. Você realmente conseguiu.',
        opts: [
          { label: '(Entregar a Arca de Dados)',
            fx() { inv().artifact = false; inv().artifactDelivered = true;
              G.facRep.hum += 20; G.quest.stage = 3; sfx('quest'); },
            next: 'm2b' },
          { label: 'Ainda não. (manter a Arca)', next: null },
        ],
      },
      m2b: {
        text: 'Décadas de conhecimento humano... e quem o trouxe de volta foi um símio. Talvez seja assim ' +
          'que este mundo se conserta: não uma espécie sobre a outra, mas lado a lado. ' +
          'Você sempre terá um lugar entre nós.',
        opts: [{ label: '(Ver o resultado)', fx() { showEnd(); }, next: null }],
      },
      m3: {
        text: 'Estamos decodificando a Arca. Sementes, vacinas, mapas de aquíferos... Você nos deu um futuro, exilado.',
        opts: [{ label: '(Sair)', next: null }],
      },
    },
  },

  // ===== BROMO — comerciante pacifista =====
  bromo: {
    name: 'Bromo — Comerciante Pacifista',
    entry() { return 'b0'; },
    nodes: {
      b0: {
        text() {
          return 'Olha só quem aparece: o desertor mais famoso do território. Relaxa, aqui dentro ninguém ' +
            'atira em ninguém — regra do assentamento. Negócio é negócio. Você tem ' + inv().scrap + ' de sucata.';
        },
        opts: [
          { label: 'Comprar medkit (15 sucata)',
            disabledIf: () => inv().scrap < 15,
            fx() { inv().scrap -= 15; inv().medkits++; sfx('pickup'); notify('+1 medkit'); },
            next: 'b0' },
          { label: 'Comprar 6 munições (10 sucata)',
            disabledIf: () => inv().scrap < 10,
            fx() { inv().scrap -= 10; inv().ammo += 6; sfx('pickup'); notify('+6 munições'); },
            next: 'b0' },
          { label: 'Alguma dica sobre as ruínas?', next: 'b1' },
          { label: 'Até mais.', next: null },
        ],
      },
      b1: {
        text: 'Os soldados do Cofre não abandonam o posto — mas as patrulhas circulam. Os contêineres das ' +
          'ruínas ainda têm sucata e munição, se você for rápido. E escuta: a Anciã Lira não dá Selo de Paz ' +
          'pra quem tem sangue da vila nas mãos. Pense nisso antes de puxar o gatilho.',
        opts: [{ label: 'Valeu, Bromo.', next: 'b0' }],
      },
    },
  },

  // ===== ANCIÃ LIRA — vila pacifista =====
  lira: {
    name: 'Anciã Lira — Vila Pacifista',
    entry() {
      if (G.facRep.pac < -10) return 'lrefuse';
      if (inv().seal) return 'ldone';
      return 'l0';
    },
    nodes: {
      l0: {
        text: 'Paz, irmão da floresta. Soube da sua deserção — é preciso coragem para largar a lança do General. ' +
          'O que traz você à nossa vila?',
        opts: [
          { label: '(Saudar com respeito) Paz à sua vila, Anciã.',
            cond: () => !G.flags.liraGreeted,
            fx() { G.flags.liraGreeted = true; G.facRep.pac += 3; notify('Pacifistas +3'); },
            next: 'l0' },
          { label: 'Preciso de um Selo de Paz para entrar no Cofre.',
            cond: () => G.quest.stage >= 1,
            next: 'l1' },
          { label: 'Como vocês vivem aqui, sem soldados?', next: 'l2' },
          { label: 'Até logo, Anciã.', next: null },
        ],
      },
      l1: {
        text: 'O Selo é um juramento de não-violência, não um passe-livre. O Capitão Krag o respeita porque ' +
          'minha vila alimentou a dele na grande seca. Por que eu o entregaria a um ex-soldado?',
        opts: [
          { label: 'Sem o Selo haverá sangue no Cofre — símio e humano. Me ajude a evitar isso.',
            check: 6,
            fx() { inv().seal = true; G.facRep.pac += 10;
              notify('Recebeu: Selo de Paz · Pacifistas +10'); sfx('quest'); },
            next: 'l1ok' },
          { label: 'Doar 20 de sucata para a vila.',
            disabledIf: () => inv().scrap < 20,
            fx() { inv().scrap -= 20; inv().seal = true; G.facRep.pac += 15;
              notify('Recebeu: Selo de Paz · Pacifistas +15'); sfx('quest'); },
            next: 'l1ok' },
          { label: 'A vila me conhece. Sabem que não levanto a mão contra símios.',
            cond: () => G.facRep.pac >= 25,
            fx() { inv().seal = true; notify('Recebeu: Selo de Paz'); sfx('quest'); },
            next: 'l1ok' },
          { label: 'Esquece. Resolvo do meu jeito.', next: null },
        ],
      },
      l1ok: {
        text: 'Leve o Selo, então. Mostre-o ao Capitão Krag antes que as lanças falem. ' +
          'E lembre-se: que ele pese na sua mão mais do que qualquer arma.',
        opts: [{ label: '(Sair)', next: null }],
      },
      l2: {
        text: 'Vivemos como a floresta ensina: devagar, em silêncio, partilhando. O General chama isso de ' +
          'fraqueza. Nós chamamos de paz. Você, que carregou a lança dele... sabe qual dos dois custa mais caro.',
        opts: [{ label: '(Voltar)', next: 'l0' }],
      },
      lrefuse: {
        text: 'Há sangue do meu povo nas suas mãos, exilado. A floresta vê tudo. Saia da minha vila.',
        opts: [{ label: '(Sair)', next: null }],
      },
      ldone: {
        text: 'O Selo já está com você. Que ele chegue ao Cofre antes da violência.',
        opts: [{ label: '(Sair)', next: null }],
      },
    },
  },

  // ===== CAPITÃO KRAG — posto militarista no Cofre =====
  krag: {
    name: 'Capitão Krag — Exército do General',
    entry() {
      if (G.captainPeace) return 'kdone';
      return G.quest.stage >= 1 ? 'k0' : 'kgen';
    },
    nodes: {
      kgen: {
        text: 'Ora, ora. O desertor em pessoa. Eu devia te arrastar até o General agora — mas estou de bom ' +
          'humor. Circulando, traidor. Este posto é do exército.',
        opts: [{ label: '(Recuar devagar)', next: null }],
      },
      k0: {
        text: 'Pare aí, traidor. Eu sei o que você veio buscar: a relíquia humana. O General quer esse lixo ' +
          'trancado para sempre — e a sua cabeça numa estaca. Me dê um motivo para não resolver os dois agora.',
        opts: [
          { label: 'Mostrar o Selo de Paz da Anciã Lira.',
            disabledIf: () => !inv().seal,
            fx() { G.captainPeace = true; G.facRep.mil += 10; G.facRep.pac += 5;
              for (const e of G.entities) if (e.ai === 'guard') e.aggro = false;
              notify('Os guardas baixam as lanças. · Militaristas +10, Pacifistas +5'); sfx('quest'); },
            next: 'kpeace' },
          { label: 'Somos da mesma espécie, capitão. Quantos símios você quer enterrar por causa de lixo humano?',
            check: 7,
            fx() { G.captainPeace = true; G.facRep.mil += 5;
              for (const e of G.entities) if (e.ai === 'guard') e.aggro = false;
              notify('Krag recua. · Militaristas +5'); sfx('quest'); },
            next: 'kpeace2' },
          { label: 'Então a Arca será tomada à força.',
            fx() { G.vaultHostile = true; aggroVaultGuards();
              gainAlert(2, 'O Cofre entra em alerta de combate!'); },
            next: null },
          { label: 'Só estou de passagem.', next: null },
        ],
      },
      kpeace: {
        text: '...Lira. Aquela velha teimosa alimentou meu pelotão inteiro na seca. O Selo vale. ' +
          'Pegue a relíquia e desapareça, traidor — e reze para o General nunca saber que estive de bom humor.',
        opts: [{ label: '(Entrar no Cofre)', next: null }],
      },
      kpeace2: {
        text: 'Grrh... Você fala como os pacifistas. E o pior é que fala certo: meus soldados valem mais que ' +
          'sucata humana. Pegue essa porcaria e suma. Se contar a alguém, eu nego — e te caço pessoalmente.',
        opts: [{ label: '(Entrar no Cofre)', next: null }],
      },
      kdone: {
        text: 'Você de novo. Pegue o que veio pegar e desapareça antes que eu mude de ideia.',
        opts: [{ label: '(Sair)', next: null }],
      },
    },
  },
};

let currentNodeOpts = [];

export function openDialog(id) {
  const d = DIALOGS[id];
  if (!d) return;
  current = d;
  G.mode = 'dialog';
  panel.classList.remove('hidden');
  elName.textContent = d.name;
  sfx('talk');
  renderNode(d.entry());
}

function closeDialogPanel() {
  panel.classList.add('hidden');
  current = null;
  if (G.mode === 'dialog') G.mode = 'play';
}

function renderNode(nid) {
  const node = current.nodes[nid];
  elText.textContent = typeof node.text === 'function' ? node.text() : node.text;
  elOpts.innerHTML = '';
  currentNodeOpts = [];
  let idx = 0;
  for (const opt of node.opts) {
    if (opt.cond && !opt.cond()) continue;
    idx++;
    const btn = document.createElement('button');
    const label = typeof opt.label === 'function' ? opt.label() : opt.label;
    let ok = true;
    if (opt.check !== undefined) {
      ok = effCAR() >= opt.check;
      btn.innerHTML = `${idx}. <span class="chk">[Carisma ${opt.check}]</span> ${label}`;
    } else if (opt.disabledIf) {
      ok = !opt.disabledIf();
      btn.textContent = `${idx}. ${label}`;
    } else {
      btn.textContent = `${idx}. ${label}`;
    }
    if (!ok) btn.classList.add('off');
    const pick = () => {
      if (!ok) return;
      if (opt.check !== undefined && addSkillXP('speech', 15)) {
        notify('Lábia subiu para o nível ' + G.player.skills.speech.lv + '!'); sfx('level');
      }
      sfx('talk');
      if (opt.next) {
        if (opt.fx) opt.fx();
        renderNode(opt.next);
      } else {
        closeDialogPanel();
        if (opt.fx) opt.fx(); // fx terminal roda após fechar (pode trocar G.mode)
      }
    };
    btn.addEventListener('click', pick);
    currentNodeOpts.push({ pick });
    elOpts.appendChild(btn);
  }
}

// Teclas 1..9 selecionam opção; Esc fecha
export function handleDialogKey(n) {
  if (!current) return;
  if (n === 0) { closeDialogPanel(); return; }
  const o = currentNodeOpts[n - 1];
  if (o) o.pick();
}
