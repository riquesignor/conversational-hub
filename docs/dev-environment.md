# Ambiente de desenvolvimento (pen drive exFAT)

> Nota lateral ao projeto: este repositório é levado entre máquinas
> Windows/Linux num pen drive formatado em exFAT. Este documento existe só
> pra isso funcionar de forma reprodutível — não é necessário lê-lo pra
> entender a aplicação em si (ver [README.md](../README.md)).

## 1. Node.js

- Requisito real: **Node >= 22** (não está em `package.json.engines`, mas
  várias deps travam nisso: `vitest@5` exige
  `^22.12.0 || ^24.0.0 || >=26.0.0`; `firebase-admin`, `ai`, `@ai-sdk/*` e
  `@supabase/*` exigem `>=22`).
- Gerenciado via `nvm`. `.nvmrc` na raiz do projeto fixa a versão. Rode
  `nvm use` (lê o `.nvmrc` automaticamente) antes de `npm`/`next`/`vitest`
  em qualquer shell novo ou script — o `node` "cru" fora de um shell de
  login pode resolver pra um Node antigo do sistema.

## 2. node_modules e .next em exFAT (sem suporte a symlink Unix)

exFAT não suporta symlinks. Dois pontos do projeto precisam de symlink:
- `node_modules/.bin` (criado pelo `npm install`)
- `.next/node_modules/<pkg-hash>` (criado pelo Turbopack no build/dev,
  para pacotes "externos" como `firebase-admin` — sem isso, `next build`
  falha com `FATAL: ... failed to create symlink ... Operation not
  permitted`)

Solução: bind mount de `node_modules` e `.next` para um cache em disco
local (`~/.cache/pendrive-node-modules/<projeto>/{node_modules,.next}`),
por cima das pastas homônimas no pen drive.

- **`docs/scripts/mount-node-modules.sh`** — faz o bind mount das duas
  pastas (idempotente). Precisa rodar como root.
- **`docs/scripts/setup-linux-devenv.sh`** — roda o script acima (via
  `sudo`),
  garante a versão certa de Node (via `.nvmrc`) e roda `npm ci`. É o que
  rodar sempre que trocar de máquina e o ambiente ainda não estiver
  montado/instalado:
  ```bash
  bash docs/scripts/setup-linux-devenv.sh
  ```
- **`docs/scripts/install-linux-automount.sh`** — instala uma regra udev
  (casando pelo UUID do filesystem, não pelo `/dev/sdX`, que muda) + um
  serviço systemd oneshot que dispara o bind mount automaticamente sempre
  que este pen drive é conectado nesta máquina. De propósito não usa um
  `.path` unit com `PathExists` numa pasta sempre presente — isso causaria
  loop de restart e o systemd bloquearia a unit (`unit-start-limit-hit`);
  em vez disso, o udev dispara o serviço só no evento de conexão do device
  (`ENV{SYSTEMD_WANTS}`), e o próprio serviço espera o pen drive terminar
  de montar antes de rodar o script.

  O bind mount cobre só `node_modules`/`.next`; depois de plugar o pen
  drive, ainda é preciso rodar `npm ci`/`npm install` manualmente se o
  `package-lock.json` mudou.

## 3. Line endings (CRLF/LF)

O pen drive já causou contaminação de CRLF em vários arquivos (editados no
Windows). Corrigido via `.gitattributes` (`* text=auto eol=lf`) +
`git add --renormalize .`. Se `git status` voltar a mostrar um monte de
arquivo "modificado" sem edição real, é provavelmente o mesmo problema de
novo — confirme com `git diff -w` (deve dar zero linhas de diff real)
antes de reescrever o working tree.

## 4. Deploy

Deploy é na **Vercel**, com o projeto importado direto do repositório do
GitHub — ver [README.md § "Deploy na Vercel"](../README.md). O
comportamento padrão da Vercel é fazer deploy de produção automaticamente
a cada push na branch `main` — revise o que está sendo enviado antes de
dar `git push` nela.
