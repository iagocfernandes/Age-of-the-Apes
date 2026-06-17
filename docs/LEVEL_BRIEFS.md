# Level Briefs — Age of the Apes

Este documento resume as duas frentes visuais de fase que devem evoluir sem quebrar o gameplay contract da `main`.

## Objetivo das branches de fase

As branches de fase servem para explorar layout, atmosfera, composição visual e navegação. Elas não devem redefinir sozinhas regras centrais de combate, movimento, quest, atributos, facções ou inventário.

Qualquer mudança sistêmica descoberta durante a criação de fase deve virar proposta separada contra o `docs/GAMEPLAY_CONTRACT.md`.

## `level/iago-ape-forest` — Fase visual do Iago

### Intenção

Floresta símia explorável, com leitura clara de aventura, perigo e refúgio. Deve funcionar como área de identidade do protagonista e como prova visual para navegação orgânica em ambiente natural.

### Função no jogo

- Área ligada à floresta símia/leste do mapa.
- Espaço para testar exploração, vegetação, rochas, desníveis leves e caminhos não urbanos.
- Pode abrigar NPCs pacifistas, patrulhas ou pontos de quest relacionados à comunidade símia.

### Requisitos mínimos

- Spawn seguro do jogador.
- Caminho principal legível mesmo com vegetação.
- Obstáculos com colisão consistente.
- Pelo menos um ponto de interesse reconhecível à distância.
- Espaço suficiente para combate com lock-on sem câmera prender constantemente.
- Rota clara para retornar ao hub/assentamento ou avançar para objetivo de quest.

### Direção visual

- Floresta estilizada, legível e “um nível acima de N64”, sem realismo excessivo.
- Silhuetas fortes para árvores, pedras e marcos.
- Névoa/atmosfera pode ajudar profundidade, desde que não esconda objetivos.
- Cores devem diferenciar caminho, área perigosa e ponto de interesse.

### Validação

A fase é considerada utilizável quando o jogador consegue:

1. nascer;
2. andar/correr/esquivar;
3. encontrar o objetivo visual principal;
4. travar alvo em ao menos um inimigo de teste;
5. sair da área sem ficar preso.

## `level/ar2-gorilla-kingdom` — Fase visual do AR2

### Intenção

Reino/território dos gorilas, com sensação de força, hierarquia e presença militar/social. Deve contrastar com a floresta orgânica do Iago por ter composição mais monumental, defensiva e territorial.

### Função no jogo

- Área ligada a facções fortes, autoridade, conflito ou negociação.
- Espaço para testar arquitetura tribal/fortificada, praças, portões, arena ou sala do líder.
- Pode abrigar inimigos mais fortes, guardas, NPCs de reputação e decisões de combate/diplomacia.

### Requisitos mínimos

- Entrada principal clara.
- Ponto focal reconhecível: trono, portão, arena, torre ou árvore/rocha monumental.
- Pelo menos um percurso navegável para combate e outro para aproximação diplomática quando aplicável.
- Espaços de combate amplos o suficiente para lock-on, strafe e câmera.
- NPCs/guardas posicionados sem bloquear o fluxo básico da quest.

### Direção visual

- Formas robustas e pesadas.
- Materiais naturais/tribais: pedra, madeira, terra, ossos ou bandeiras/símbolos, conforme o tom aprovado.
- Composição vertical ou centralizada para comunicar reino/domínio.
- Paleta pode ser mais quente, densa ou ameaçadora que a floresta do Iago.

### Validação

A fase é considerada utilizável quando o jogador consegue:

1. entrar no território;
2. identificar o centro de poder;
3. interagir com ao menos um NPC ou inimigo de teste;
4. executar combate com lock-on em área adequada;
5. completar ou simular um objetivo sem quebrar movimento, câmera ou colisão.

## Checklist comum para qualquer fase

Antes de abrir PR:

- [ ] branch correta (`level/iago-ape-forest` ou `level/ar2-gorilla-kingdom`);
- [ ] sem Unreal/C++ entrando na `main` por acidente;
- [ ] sem builds/caches commitados;
- [ ] compatível com `docs/GAMEPLAY_CONTRACT.md`;
- [ ] navegação testada do spawn ao objetivo;
- [ ] câmera testada em corredores, obstáculos e combate;
- [ ] lock-on testado em inimigo válido;
- [ ] pontos de interesse nomeados/documentados no PR.
