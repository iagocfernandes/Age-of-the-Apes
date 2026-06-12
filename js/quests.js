// Quest principal: "A Arca de Dados". Estágios em G.quest.stage:
// 0 = falar com Maya | 1 = recuperar a Arca no Cofre | 2 = entregar a Maya | 3 = concluída
import { G } from './state.js';
import { PEDESTAL } from './map.js';

export function objectiveText() {
  switch (G.quest.stage) {
    case 0: return 'Fale com Maya, líder da Resistência humana, no assentamento de comércio.';
    case 1: return 'Recupere a Arca de Dados no Cofre, no extremo oeste das ruínas. ' +
                   'A Anciã Lira, na floresta símia, pode oferecer um caminho sem sangue.';
    case 2: return 'Leve a Arca de Dados de volta para Maya, no assentamento.';
    default: return 'Demo concluída — o mundo é seu. Continue explorando.';
  }
}

export function objectiveTarget() {
  const s = G.quest.stage;
  if (s === 0 || s === 2) {
    const maya = G.entities.find(e => e.dialog === 'maya' && !e.dead);
    return maya ? { x: maya.x, y: maya.y } : null;
  }
  if (s === 1) return G.flags.artifactTaken ? null : { x: PEDESTAL.x, y: PEDESTAL.y };
  return null;
}
