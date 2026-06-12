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

## Controles

| Tecla | Ação |
|---|---|
| WASD / setas | mover (Shift: correr) |
| Mouse | mirar · clique: atacar (segurar funciona) |
| E | interagir / falar / saquear |
| 1 / 2 | cano de ferro / pistola |
| H | usar medkit |
| I ou Tab | inventário e ficha |
| F5 / F9 | salvar / carregar (memória da sessão) |
| M | som on/off |

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
