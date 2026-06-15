# Age of the Apes — protótipo jogável

RPG de ação top-down em mundo aberto (HTML/JS/Canvas, sem dependências).
Você é um **símio exilado** do exército do General em um mundo pós-Colapso.

## Como rodar

Os módulos ES exigem um servidor local (não funciona via `file://`):

```bash
cd "Age of the Apes"
python3 -m http.server 8000
```

Abra http://localhost:8000 no navegador.

### Duas versões

| Arquivo | Renderer | Câmera | Controles |
|---|---|---|---|
| `index.html` (clássico 2D) | Canvas 2D (`js/render.js`) | Top-down, scroll | mouse em coords de canvas |
| `index3d.html` (demo 3D) | Three.js via CDN (`js/render3d.js`) | **Terceira pessoa** (orbital, com colisão contra paredes) | Pointer Lock + mouse relativo |

Ambas compartilham a mesma simulação (`state`, `map`, `entities`, `combat`, `dialog`, `quests`, `ui`, `audio`). Na demo 3D você vê o seu símio (modelo GLB da espécie escolhida — o chimpanzé é o herói padrão) com a arma na mão, animação procedural de caminhada e câmera atrás do ombro; mover o mouse para baixo eleva a câmera para uma vista mais aérea. O beam ciano marca o objetivo da quest. O cenário tem floresta de pinheiros, vegetação rasteira e rochas instanciadas, com névoa de montanha no horizonte.

### Combate estilo Zelda N64 (Z-targeting)

A demo 3D usa o esquema de combate do Ocarina of Time: aperte **F** (ou o botão do meio do mouse) para **travar o alvo** mais próximo à sua frente. Com o alvo travado:

- o personagem **encara o inimigo** automaticamente;
- **W/S** aproxima/recua e **A/D** circula o alvo (*strafe*), mantendo a frente nele;
- a **câmera enquadra você e o alvo** juntos, e uma **retícula amarela** giratória marca o inimigo travado;
- acertar um golpe gera um **hit-stop** (micro-pausa de impacto) que dá peso ao combate.

Aperte **F** de novo para destravar; o lock solta sozinho se o alvo morrer ou se afastar demais.

### Movimento (terceira pessoa)

- **Mouse gira a câmera**, não o personagem. Em movimento livre, o símio **vira suavemente para a direção em que anda** (como o Link corre); travado no alvo, faz *strafe* mantendo a frente no inimigo.
- **Inércia**: o passo acelera e desacelera de forma suave (dá peso ao movimento) em vez de ligar/desligar instantaneamente.
- A **esquiva** (Q) é um impulso instantâneo que desliza ao terminar.

### Animação esqueletal (pronto para receber modelo riggado)

Os GLBs atuais são **estáticos** (sem esqueleto), então o personagem é animado por
transformações procedurais do corpo e do braço. A infraestrutura para **animação
esqueletal de verdade** já existe e fica *dormente* até um GLB trazer clipes:

- Se um modelo em `assets/models/` tiver `gltf.animations`, o `render3d` clona-o com
  `SkeletonUtils.clone` (religa os ossos), cria um `THREE.AnimationMixer` e troca de
  clipe por **crossfade** conforme o estado (idle / walk / run / attack / jump).
- O reconhecimento de clipe é por substring (`'walk'`, `'run'`, `'attack'`…), então
  tolera as convenções do Mixamo, Quaternius, etc.
- Sem clipes, cai no procedural — nada quebra.

**Para plugar um personagem animado (ex.: Mixamo):**
1. Em [mixamo.com](https://www.mixamo.com) escolha um personagem (ou faça upload de um) e
   baixe os clipes **Idle, Walking, Running, Melee/Attack, Jump** como **glTF/GLB** (skin incluso).
2. Junte os clipes num único `.glb` (no Blender ou via ferramenta de merge) e salve como, por
   exemplo, `assets/models/chimpanzee.glb` (substituindo o estático).
3. Rode o jogo: o mixer ativa sozinho. Ajuste só o `MODEL_YAW` da espécie em `render3d.js`
   se o modelo nascer virado para o lado errado.

## Controles

| Tecla | Ação |
|---|---|
| WASD / setas | mover (Shift: correr) |
| **F** ou botão do meio | **travar/destravar alvo (Z-target, estilo Zelda N64)** |
| Espaço | pular (3D) |
| Q | esquiva — impulso rápido com cooldown (3D) |
| Mouse | mirar · clique: atacar (segurar funciona; corpo a corpo dá um lunge à frente) |
| E | interagir / falar / saquear |
| 1 / 2 | cano de ferro / pistola |
| H | usar medkit |
| I ou Tab | inventário e ficha |
| F5 / F9 | salvar / carregar (memória da sessão) |
| M | som on/off |
| Esc | (3D) liberar/retomar o mouse |

> **Demo 3D:** clique em "▶ COMEÇAR (3D)" para travar o ponteiro. `Esc` libera; clique no canvas para retomar. O crosshair (+) só aparece no modo 3D; a arma equipada aparece na mão do personagem.

## O que tem na demo (~10 min)

- **3 zonas**: ruínas da cidade humana (oeste), assentamento neutro de comércio (centro), floresta símia (leste)
- **4 espécies jogáveis** com modificadores: chimpanzé, gorila, orangotango, bonobo + 3 pontos para distribuir (F.P.C.A.: Força, Percepção, Carisma, Agilidade)
- **3 facções com reputação numérica**: Militaristas (hostis), Pacifistas (negociáveis), Resistência humana (aliada)
- **Quest principal** ("A Arca de Dados") com dois desfechos: combate ou diplomacia (Selo de Paz da Anciã Lira, ou check de Carisma 7 contra o Capitão Krag)
- **4 NPCs com diálogo** (Maya, Bromo, Lira, Krag), com escolhas que mudam reputação e 2 checks de Carisma
- **Nível de alerta** estilo GTA (estrelas): crimes atraem caçadores; some ficando fora de vista
- **Progressão por uso**: Corpo a corpo, Tiro e Lábia sobem conforme você usa
- **Loot**: contêineres nas ruínas (sucata/munição/medkits); Bromo vende suprimentos
- NPCs com rotinas simples (patrulhas com rotas, aldeões vagando), save/load em memória, SFX procedurais (WebAudio)

## Estrutura (para expandir)

```
js/state.js     estado global, atributos, espécies, save/load
js/map.js       geração procedural do mundo + colisão
js/entities.js  spawn, IA (patrulha/guarda/caçador/vagar), interação
js/combat.js    dano, projéteis, alerta símio, efeitos
js/dialog.js    árvores de diálogo + UI (checks de Carisma)
js/quests.js    estágios e marcador de objetivo
js/ui.js        HUD, minimapa, inventário, telas
js/render.js    desenho do mundo e entidades
js/main.js      loop, input, bootstrap
```

## Créditos (demo 3D)

A versão 3D usa conteúdo de terceiros, listado em [`assets/ATTRIBUTION.md`](assets/ATTRIBUTION.md):

- **Three.js** (MIT) — engine 3D via CDN
- **Poly Pizza** (MIT) — plataforma de hospedagem dos modelos
- **Modelos de primatas** (CC-BY) — Poly by Google (chimpanzee, gorilla) e cameron\_ (orangutan)

Todos os efeitos sonoros são sintetizados em tempo real (WebAudio), sem dependências de áudio externas.
