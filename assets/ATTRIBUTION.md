# Atribuição de Créditos — Age of the Apes (demo 3D)

A demo 3D do **Age of the Apes** é construída com software livre e conteúdo
aberto. Este arquivo lista todas as bibliotecas, assets de terceiros e
respectivas licenças, conforme exigido por cada uma.

---

## 1. Modelos 3D (primatas)

Todos os modelos de chimpanzé, gorila e orangotango são usados sob
**Creative Commons Attribution (CC-BY)**, conforme redistribuídos pela
plataforma **Poly Pizza**. Link de origem preservado, autor creditado.

### Chimpanzee
- **Autor**: Poly by Google
- **Origem**: <https://poly.pizza/m/6m3diqGPysx>
- **Arquivo**: `assets/models/chimpanzee.glb`
- **Tamanho**: ~49 KB · ~704 triângulos
- **Licença**: CC-BY

### Gorilla
- **Autor**: Poly by Google
- **Origem**: <https://poly.pizza/m/bmfQ1j9CeO2>
- **Arquivo**: `assets/models/gorilla.glb`
- **Tamanho**: ~41 KB · ~576 triângulos
- **Licença**: CC-BY

### Orangutan
- **Autor**: cameron_
- **Origem**: <https://poly.pizza/m/kD8hdFa32e>
- **Arquivo**: `assets/models/orangutan.glb`
- **Tamanho**: ~520 KB · ~1,9 k triângulos
- **Licença**: CC-BY

### Bonobo
- **Reutilização**: Reusa o mesmo mesh do **Chimpanzee** com material em tom
  mais escuro (espécies anatomicamente idênticas).
- **Origem do mesh**: <https://poly.pizza/m/6m3diqGPysx>
- **Arquivo**: `assets/models/bonobo.glb`
- **Licença**: CC-BY

---

## 2. Plataforma de distribuição dos modelos

Os modelos acima são hospedados e redistribuídos pela plataforma
**Poly Pizza** (<https://poly.pizza/>), que mantém os metadados de autor e
licença originais.

- **Poly Pizza** (Lee Martin) — MIT License
- Site: <https://poly.pizza/>
- Função: agregador e hospedagem dos modelos CC-BY acima

---

## 3. Engine 3D

A renderização 3D é feita com **Three.js**, carregado via CDN (`unpkg`,
versão `0.160.0`) através do `<script type="importmap">` em `index3d.html`.

### Three.js
- **Autor**: mr.doob e contribuidores (<https://github.com/mrdoob/three.js>)
- **Origem**: <https://threejs.org/>
- **CDN**: <https://unpkg.com/three@0.160.0/>
- **Licença**: MIT

```
Three.js - JavaScript 3D Library
Copyright (C) 2010-present Three.js Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
```

---

## 4. Áudio

Não há amostras de áudio de terceiros. Todos os efeitos sonoros
(passos, tiro, ataque, item, fala) são **sintetizados em tempo real** via
**WebAudio API** em `js/audio.js`. Nenhuma licença de áudio se aplica.

---

## 5. Código-fonte do jogo

O código de jogo do Age of the Apes é de autoria do projeto e segue a
licença indicada no arquivo `LICENSE` na raiz do repositório.

---

## Resumo rápido (para telas "About")

```
Three.js               (MIT)        https://threejs.org/
Poly Pizza             (MIT)        https://poly.pizza/
Chimpanzee model       (CC-BY)      Poly by Google
Gorilla model          (CC-BY)      Poly by Google
Orangutan model        (CC-BY)      cameron_
```

Se redistribuir ou criar derivados, preserve esta atribuição.
