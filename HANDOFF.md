# HANDOFF — Age of the Apes (ponto de parada p/ continuar em outro chat)

> Cole o conteúdo abaixo como primeira mensagem no novo chat. Estado em 2026-06-16.

---

Você vai CONTINUAR a produção do jogo "Age of the Apes" — action-adventure estilo
Zelda (exploração + trava de alvo + quests com 2 finais) na Unreal Engine 5.7,
gráficos toon "um degrau acima do N64". Responda em PORTUGUÊS. Aja autonomamente;
só me peça o que SÓ eu posso fazer (GUI do editor, contas/navegador p/ IA, gastar
dinheiro, julgar visual em tela cheia).

ANTES DE AGIR leia: CLAUDE.md, PRODUCTION_PLAN.md (raiz do repo) e a memória do
projeto (~/.claude/projects/.../memory/). O protótipo Three.js (js/*.js,
index3d.html) é o SPEC de comportamento.

== MÁQUINA / COMANDOS (Mac, UE em /Users/Shared/UnrealEngine/UE_5.7) ==
- Compilar editor: Engine/Build/BatchFiles/Mac/Build.sh AgeOfTheApesEditor Mac
  Development -Project=<.uproject> -NoHotReloadFromIDE
- Rodar + auto-screenshot (editor): UnrealEditor <proj> /Game/AOA/Maps/L_AOA -game
  -windowed -ResX=1280 -ResY=720 (background). Controle remoto por arquivo:
  escreva em <ProjectSaved>/aoa_ctrl.txt; cmds: start <esp> | tp <tx> <ty> |
  yaw/pitch/dir <g> | arm <len> (zoom câmera) | drive <s> <run0/1> (anda p/ frente)
  | footlift <n> | lock | attack | interact | dialog <id> | pick <n> | give ... |
  stage <n> | shot <nome> (grava Saved/Screenshots/rc_<nome>.png). Leio o PNG p/
  julgar. O jogo -game costuma SAIR sozinho após ~3-4 min e MORRE se eu der tp em
  zona hostil (Militaristas -20) → fico perto do spawn.
- Scripts que precisam de Slate (import GLB/FBX, editar material, set_lods,
  usage flags): editor COMPLETO headless, SEMPRE com "-stdout -unattended"
  (sem isso ele sai antes de inicializar e não escreve log) e script em /tmp
  SEM espaços no path (o parser de py exec(open(...)) quebra em espaços):
  cp script /tmp/x.py ; UnrealEditor <proj> -stdout -unattended -nosplash
  -ExecCmds="py exec(open('/tmp/x.py').read()),QUIT_EDITOR"
  (use print via unreal.log_warning p/ aparecer no log). "timeout" não existe no
  zsh → python3 -c "import time;time.sleep(N)". Disco apertado (~9 GB livres).

== ESTADO (tudo já feito e na maior parte verificado) ==
- Gameplay PORTADO p/ C++ em unreal/AgeOfTheApes/Source/AgeOfTheApes/ (AOAPawn,
  AOACombat, AOADialog, AOAHUD, AOAGameMode). Funciona: criação, mundo 3 zonas,
  combate+Z-target, diálogos c/ Carisma, quest com 2 FINAIS, HUD/minimapa, save/load.
- Assets CC0 reais: macacos /Game/AOA/Apes, Kenney Nature+City Kit /Game/AOA/Kit,
  12 SFX /Game/AOA/Audio. Materiais: M_AOA_Tile (chão/HISM), M_AOA_Building.
- LODs gerados em todas as 29 malhas (unreal/scripts/13_setup_lods.py).
- ⭐ ANIMAÇÃO ESQUELETAL DO CHIMPANZÉ feita e VERIFICADA: usuário rigou no Mixamo,
  baixou 7 clipes → assets/models/incoming/chimpanze_<estado>.fbx. Importados por
  unreal/scripts/14_import_skeletal.py → /Game/AOA/Apes/Skel/SK_chimpanze + Skeleton
  + 7 A_chimpanze_<estado>. C++ ADITIVO no AOAPawn: USkeletalMeshComponent PlayerSkel
  ao lado do PlayerMesh static (fallback se não houver SK_); ApplyPlayerSkeletal();
  SyncVisuals toca PlayAnimation por estado SEM AnimBP; estado de locomoção =
  PlayerLoco (0/1/2) derivado do INPUT em UpdatePlayer; SkelYawOffset=-90 (Mixamo
  vira +Y). Idle/walk/run/attack verificados por screenshot. SÓ o chimpanzé está
  rigado (gorila/orango/bonobo = fallback static). NPCs macaco = static + bob.
- Bugs corrigidos: (a) FLUTUAVA → aterro pelo osso de pé/dedo mais baixo
  (GetBoneLocation ComponentSpace) + FootLift=5 (membro, calibrável live via cmd
  "footlift"; o osso fica acima da sola → leve afundamento sem o lift); (b) câmera
  passava SOB o chão (HISM são NoCollision) → componente CamFloor invisível em z=-4,
  colisão só p/ ECC_Camera, bloqueia o SpringArm. AINDA PENDENTE: confirmar c/ o
  usuário se FootLift=5 deixa os pés exatamente na superfície (não consigo julgar
  fino por screenshot: dusk deixa o macaco em contraluz/silhueta).

== BUILD MAC PORTÁTIL (p/ compartilhar) ==
- Empacotar: RunUAT.sh BuildCookRun -project=<proj> -noP4 -platform=Mac
  -clientconfig=Development -cook -build -stage -pak -nocompileeditor -utf8output
  (cook quente ~1-2 min). Build runnable = Saved/StagedBuilds/Mac/AgeOfTheApes.app.
- O -stage do UE5.7 já deixa o .app AUTOSSUFICIENTE (rpaths @executable_path/../UE/
  + dylibs no bundle) — NÃO precisa mais do antigo Jogar_*.command/DYLD. Assinar:
  codesign --deep --force --sign - <app>. Zip: cp -c (clone APFS) p/ pasta + LEIA-ME
  → ditto -c -k --sequesterRsrc --keepParent → Builds/AgeOfTheApes_Mac_AppleSilicon.zip
  (~473 MB). Verificado bootar extraído em /tmp sem engine. Alvo escolhido pelo
  usuário: SÓ Mac Apple Silicon (Windows = build à parte, não dá neste Mac).

== ✅ RESOLVIDO (2026-06-16) — bug CUBOS + XADREZ do build empacotado ==
Eram 2 causas, ambas corrigidas e VERIFICADAS NO BUILD EMPACOTADO (não no editor):

1. ✅ assets não cozinhavam (LoadObject por string) → +DirectoriesToAlwaysCook=
   (Path="/Game/AOA") em DefaultGame.ini [/Script/UnrealEd.ProjectPackagingSettings].

2. ✅ flags de uso faltando nos materiais. DESCOBERTA: os 44 materiais Kenney
   (leafsGreen/woodBark/colorRed/grass/colormap) são MaterialInstanceConstant cujo
   pai é /InterchangeAssets/gltf/MaterialInstances/MI_Default_Opaque(_DS), e o
   UMaterial BASE no topo da cadeia é /InterchangeAssets/gltf/M_Default (conteúdo do
   plugin Interchange, mas GRAVÁVEL nesta máquina). As flags vivem no UMaterial base,
   nunca na instância — por isso o script 15 (isinstance Material) só pegou 3. FIX:
   unreal/scripts/16_fix_cook_materials.py resolve get_base_material() de TODO
   MaterialInterface de /Game/AOA → 4 bases (M_Default + M_AOA_Tile/Building/PP_Toon),
   liga as 4 flags (instanced/skeletal/nanite/static_lighting) e salva. M_Default
   cobre TUDO de uma vez (macacos, props Kenney HISM e o esqueletal do chimpanzé →
   used_with_skeletal_mesh no M_Default = PLAYER ok). O mesmo script reconstrói
   M_AOA_Building como flat-color (Constant3Vector→BaseColor, two-sided, flags ANTES
   do compile) — o script 11 falhava no SM6 ("Shadermap null") pq samplava uma
   textura colormap INEXISTENTE.
   Rodar headless: cp p/ /tmp/x.py ; UnrealEditor <proj> -stdout -unattended
   -nosplash -ExecCmds="py exec(open('/tmp/x.py').read()),QUIT_EDITOR"

Re-empacotamento: RunUAT BuildCookRun -cook -stage -pak -nocompileeditor -nocompile
(sem -build pq o binário Mac do jogo já estava atual) → BUILD SUCCESSFUL, log do cook
LIMPO. codesign --deep → cp -c → ditto → Builds/AgeOfTheApes_Mac_AppleSilicon.zip
(agora 513 MB).

VERIFICAÇÃO no empacotado: rodei o .app staged com -abslog=/tmp/pkgrun.log → log sem
"Failed to compile"/"Default Material"/"missing bUsedWith". 3 self-screenshots: mundo
com materiais e malhas REAIS (player chimpanzé esqueletal, prédios bege flat,
vegetação verde HISM, terreno, contorno toon) — SEM cubo/xadrez.

DESCOBERTA: o controle remoto por arquivo FUNCIONA no empacotado. FPaths::
ProjectSavedDir() resolve p/ ~/Library/Application Support/Epic/AgeOfTheApes/Saved/ ;
escrever aoa_ctrl.txt lá é consumido em ~1s; "shot <n>" grava
Saved/Screenshots/rc_<n>.png. Lançar: <app>/Contents/MacOS/AgeOfTheApes
/Game/AOA/Maps/L_AOA -windowed -ResX=1280 -ResY=720 -abslog=/tmp/pkgrun.log.

== PENDÊNCIAS (não-bloqueantes) ==
a) COR dos props Kenney: estão FLAT/sem textura pq o atlas Textures/colormap.png
   (referenciado externamente pelos GLBs) nunca foi baixado — só as 4 texturas dos
   macacos existem. Para cor real: baixar colormap.png dos kits Kenney (City+Nature,
   CC0) e re-wirar M_AOA_Building + material foliage p/ samplar. Não é regressão.
b) FootLift=5: confirmar com o usuário se os pés ficam na superfície (difícil julgar
   por self-screenshot no dusk/contraluz).

== CONCORRÊNCIA ==
Pode haver OUTRO agente editando os mesmos .cpp. Mudanças cirúrgicas; AOAPawn.cpp é
o mais quente.
