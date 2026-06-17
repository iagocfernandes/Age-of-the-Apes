# Team Workflow — Age of the Apes

Este documento define o fluxo mínimo para manter o protótipo estável, separar ports de engine e permitir trabalho paralelo em fases.

## Branches oficiais

| Branch | Uso | Pode receber |
|---|---|---|
| `main` | Gameplay contract estável, protótipo web/Three.js e lógica compartilhada | correções pequenas, docs de contrato, ajustes validados do protótipo |
| `engine/unreal-port-iago` | Port Unreal/C++ do jogo | projeto Unreal, C++, Blueprints, Content, Config, scripts e assets de engine |
| `level/iago-ape-forest` | Fase visual do Iago | layout, arte, set dressing e validação da floresta/área do Iago |
| `level/ar2-gorilla-kingdom` | Fase visual do AR2 | layout, arte, set dressing e validação do reino dos gorilas |

## Regra principal

Não commitar Unreal/C++ diretamente na `main`.

A `main` deve continuar sendo a referência jogável e leve do gameplay: web/Three.js, lógica compartilhada, regras de combate, movimento, quests, NPCs, mapa, facções e progressão.

## Como começar trabalho novo

1. Atualize a base relevante:

```bash
git switch main
git pull --ff-only
```

2. Crie ou atualize a branch correta:

```bash
git switch -c nome/da-branch
# ou, se já existir:
git switch nome/da-branch
git pull --ff-only
```

3. Trabalhe apenas no escopo da branch.

## Regras de commit

- Faça commits pequenos e descritivos.
- Não misture separação de branch, refatoração grande e feature nova no mesmo commit.
- Não adicione builds empacotados, caches, `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/` ou artefatos temporários.
- Se um arquivo binário de source asset for necessário, ele deve respeitar Git LFS quando aplicável.
- Antes de commit:

```bash
git status
git diff --stat
```

## Regras de PR / merge

Todo PR deve indicar:

- branch de origem e destino;
- resumo do que mudou;
- impacto no gameplay contract;
- como foi validado;
- riscos conhecidos.

### Para merge em `main`

Antes de mergear na `main`, confirmar:

1. protótipo web/Three.js ainda abre;
2. movimento básico funciona;
3. combate e lock-on não quebraram;
4. quest principal ainda tem caminho completável;
5. não há arquivos Unreal/C++ ou projeto engine novo entrando por acidente;
6. docs foram atualizados se o contrato mudou.

### Para merge no port Unreal

Antes de mergear em `engine/unreal-port-iago`, confirmar:

1. projeto Unreal abre ou compila no ambiente de referência;
2. assets necessários estão versionados ou documentados;
3. caches/builds gerados não foram commitados;
4. diferenças em relação ao gameplay contract estão documentadas.

## Atualização diária

No início do dia:

```bash
git fetch --all --prune
git status
git branch --show-current
git log --oneline --graph --decorate --all -n 20
```

Cada pessoa deve registrar:

- branch em que está trabalhando;
- objetivo do dia;
- arquivos/sistemas tocados;
- bloqueios;
- validação feita.

No fim do dia:

- deixar commitado ou stashed todo trabalho importante;
- empurrar a branch remota se o trabalho precisa ser preservado/compartilhado;
- não deixar mudanças grandes perdidas apenas no working tree.

## Operações perigosas

Antes de qualquer operação como `reset --hard`, limpeza grande, remoção em massa ou mudança de histórico:

1. mostrar estado do Git:

```bash
git status
git branch --show-current
git log --oneline --graph --decorate --all -n 20
```

2. criar branch de backup:

```bash
git switch -c backup/nome-descritivo
```

3. só então executar a operação aprovada.

Nunca usar `git push --force` ou `git push --force-with-lease` sem confirmação explícita de Arthur e Iago de que ninguém depende dos commits atuais.

## Revert vs reset

Opção segura para desfazer mudanças na `main` sem reescrever histórico:

```bash
git revert <sha-do-commit-unreal>
git push origin main
```

Opção limpa, mas perigosa porque reescreve histórico:

```bash
git reset --hard <sha-do-commit-original>
git push --force-with-lease origin main
```

Usar `--force-with-lease` somente com confirmação explícita de Arthur e Iago.
