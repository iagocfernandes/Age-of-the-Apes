# Gameplay Contract — Age of the Apes

Este documento define o contrato de gameplay que a `main` deve preservar. Qualquer port de engine, fase visual ou branch experimental deve ser compatível com este contrato antes de ser considerado integrável.

## Papel da `main`

A branch `main` é a base estável do protótipo original web/Three.js e da lógica compartilhada do jogo:

- simulação (`state`, `map`, `entities`, `combat`, `dialog`, `quests`, `ui`, `audio`);
- regras de movimento, câmera, combate, progressão e interação;
- protótipo jogável 2D/3D que serve como especificação funcional;
- referência para ports em Unreal/C++ ou outras engines.

Ports de engine não devem substituir o contrato. Eles devem reimplementar o comportamento validado na `main`.

## Movimento

- Controles base: `WASD`/setas para mover, `Shift` para correr, `Q` para esquiva na versão 3D.
- Movimento livre em terceira pessoa: o personagem vira suavemente na direção em que anda.
- Movimento com alvo travado: `W/S` aproxima/recua e `A/D` circula o alvo em strafe.
- Aceleração/desaceleração deve ter inércia perceptível, evitando liga/desliga instantâneo.
- A esquiva é um impulso curto com cooldown e pequena continuidade/deslizamento ao final.
- Colisão com paredes/obstáculos deve impedir atravessar o mapa e manter navegação previsível.

## Câmera

- O protótipo 2D usa câmera top-down com scroll.
- A demo 3D usa terceira pessoa atrás do ombro, com mouse relativo/pointer lock.
- Mouse controla a câmera, não força o personagem a girar imediatamente.
- Em lock-on, a câmera deve enquadrar jogador e alvo juntos sempre que possível.
- A câmera deve evitar atravessar paredes de forma grosseira e manter legibilidade de combate.

## Lock-on / Z-targeting

- Entrada padrão: `F` ou botão do meio do mouse para travar/destravar alvo.
- O alvo válido deve ser inimigo próximo e preferencialmente à frente do jogador.
- Com lock-on ativo:
  - personagem encara automaticamente o inimigo;
  - movimento lateral vira strafe ao redor do alvo;
  - retícula/indicador visual marca o inimigo travado;
  - câmera prioriza manter jogador e alvo visíveis.
- O lock deve soltar se o alvo morrer, sair de alcance ou deixar de ser válido.

## Combate

- Ataque básico por clique do mouse; segurar pode repetir conforme arma/cadência.
- Armas previstas no protótipo: cano de ferro/corpo a corpo e pistola.
- Corpo a corpo pode aplicar pequeno avanço/lunge para dar peso ao golpe.
- Impactos devem dar feedback claro: dano, hit-stop curto, som/efeito e reação visual quando possível.
- Projéteis devem respeitar direção, alcance, colisão e munição.
- Inimigos hostis devem reagir a agressões e crimes por meio do sistema de alerta.
- Combate deve continuar legível tanto em 2D quanto em 3D/engine port.

## Atributos e espécies

- Espécies jogáveis previstas: chimpanzé, gorila, orangotango e bonobo.
- A ficha usa F.P.C.A.:
  - Força;
  - Percepção;
  - Carisma;
  - Agilidade.
- Cada espécie pode ter modificadores próprios.
- O jogador começa com pontos distribuíveis.
- Checks narrativos ou sociais devem usar atributos, principalmente Carisma nos diálogos atuais.

## Facções e reputação

Facções centrais do protótipo:

- Militaristas: hostis ou antagonistas principais;
- Pacifistas: negociáveis, ligados a soluções diplomáticas;
- Resistência humana: aliada/potencial parceira.

Regras mínimas:

- reputação deve ser numérica ou comparável;
- escolhas de diálogo e ações de combate podem alterar reputação;
- facções devem influenciar hostilidade, acesso a soluções e desfechos de quest;
- crimes/violência devem poder aumentar o nível de alerta.

## Quests

Quest principal validada: **A Arca de Dados**.

Critérios mínimos:

- quests têm estágios claros;
- há marcador/objetivo ativo legível no HUD/mundo;
- escolhas podem abrir caminhos de combate ou diplomacia;
- pelo menos dois desfechos devem ser preservados como referência: combate e diplomacia;
- requisitos de atributo/reputação devem ser transparentes o bastante para depuração.

## Inventário e economia

- Inventário acessível por `I` ou `Tab`.
- Itens atuais: sucata, munição, medkits e armas.
- `H` usa medkit quando disponível.
- Contêineres nas ruínas podem gerar loot.
- Bromo atua como vendedor/suprimentos no protótipo.
- Qualquer port deve preservar regras de quantidade, consumo e feedback de item coletado/usado.

## NPCs e diálogos

NPCs de referência:

- Maya;
- Bromo;
- Lira;
- Krag.

Regras mínimas:

- interação por `E` quando próximo;
- diálogos com escolhas;
- escolhas podem alterar reputação, quest e checks de atributo;
- NPCs podem ter rotina simples: patrulha, guarda ou vaguear;
- NPC hostil deve entrar no ecossistema de combate/alerta.

## Mapa e mundo

Zonas de referência:

- ruínas da cidade humana a oeste;
- assentamento neutro de comércio no centro;
- floresta símia a leste.

Critérios mínimos:

- mundo navegável com colisão;
- regiões devem ser reconhecíveis por função e risco;
- objetivos e NPCs precisam estar localizados de modo que a quest possa ser completada;
- alterações visuais não podem quebrar fluxo de quest, combate ou progressão.

## Critérios mínimos para uma fase ser compatível

Uma fase/level branch é compatível com o contrato quando:

1. o jogador nasce em posição válida e consegue se mover sem travar;
2. a câmera funciona no modo esperado da build;
3. há colisão básica em obstáculos importantes;
4. existe pelo menos uma rota clara até o objetivo principal da fase;
5. NPCs/hostis necessários aparecem e podem ser interagidos ou combatidos;
6. lock-on funciona em pelo menos um inimigo válido;
7. ataques causam dano e dão feedback;
8. inventário/itens essenciais permanecem acessíveis;
9. a fase não remove sistemas compartilhados da `main`;
10. o protótipo web/Three.js continua rodando após merge.

## Regra de compatibilidade

Se um port ou fase precisar mudar uma regra deste contrato, a mudança deve ser proposta explicitamente em PR/documento antes do merge para `main`.
