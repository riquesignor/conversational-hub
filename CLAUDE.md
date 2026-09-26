# Ambiente deste projeto — leia antes de mexer em setup/deps

Este projeto roda de um **pen drive formatado em exFAT**, montado em
`/run/media/merda/ACCORTO/chatbot-portfolio`, e é levado entre máquinas
Windows e Linux diferentes. Isso cria alguns problemas que já foram
diagnosticados e resolvidos nesta máquina — não repita o diagnóstico do
zero, só verifique se o que está descrito aqui ainda bate com a realidade.

## 1. Node.js

- Requisito real: **Node >= 22** (não está em `package.json.engines`, mas
  várias deps travam nisso: `vitest@5` exige
  `^22.12.0 || ^24.0.0 || >=26.0.0`; `firebase-admin`, `ai`, `@ai-sdk/*` e
  `@supabase/*` exigem `>=22`).
- Gerenciado via `nvm` (`~/.nvm`, já instalado nesta máquina, `.zshrc` já
  inicializa). `.nvmrc` na raiz do projeto fixa `24.21.0` (LTS instalada
  via `nvm install --lts`).
- O `node` "cru" fora de um shell de login (ex: script não-interativo) pode
  resolver pro Node antigo do snap (`/snap/bin/node`, v10). Sempre rode
  `nvm use` (lê o `.nvmrc` automaticamente) antes de `npm`/`next`/`vitest`
  em qualquer shell novo ou script.

## 2. node_modules e .next em exFAT (sem suporte a symlink Unix)

exFAT não suporta symlinks. Dois pontos do projeto precisam de symlink:
- `node_modules/.bin` (criado pelo `npm install`)
- `.next/node_modules/<pkg-hash>` (criado pelo Turbopack no build/dev,
  para pacotes "externos" como `firebase-admin` — sem isso, `next build`
  falha com `FATAL: ... failed to create symlink ... Operation not
  permitted`)

Solução: bind mount de `node_modules` e `.next` para um cache em disco
local (`~/.cache/pendrive-node-modules/chatbot-portfolio/{node_modules,.next}`),
por cima das pastas homônimas no pen drive.

- **`scripts/mount-node-modules.sh`** — faz o bind mount das duas pastas
  (idempotente). Precisa rodar como root.
- **`scripts/setup-linux-devenv.sh`** — roda o script acima (via `sudo`),
  garante a versão certa de Node (via `.nvmrc`) e roda `npm ci`. É o que
  rodar sempre que trocar de máquina e o ambiente ainda não estiver
  montado/instalado:
  ```bash
  bash scripts/setup-linux-devenv.sh
  ```
- **`scripts/install-linux-automount.sh`** — instala uma regra udev
  (casando pelo **UUID do filesystem**, `B82E-CCB0`, não pelo `/dev/sdX`,
  que muda) + um serviço systemd oneshot (`pendrive-nodemodules-chatbot-
  portfolio.service`) que dispara o bind mount automaticamente sempre que
  este pen drive é conectado nesta máquina. **Já foi instalado e testado
  nesta máquina** (rodar de novo é seguro/idempotente, mas não é
  necessário). De propósito não usa um `.path` unit com `PathExists` numa
  pasta sempre presente — isso causaria loop de restart e o systemd
  bloquearia a unit (`unit-start-limit-hit`); em vez disso, o udev dispara
  o serviço só no evento de conexão do device (`ENV{SYSTEMD_WANTS}`), e o
  próprio serviço espera o pen drive terminar de montar antes de rodar o
  script.

  O bind mount cobre só `node_modules`/`.next`; depois de plugar o pen
  drive, ainda é preciso rodar `npm ci`/`npm install` manualmente se o
  `package-lock.json` mudou.

## 3. Line endings (CRLF/LF)

O pen drive já causou contaminação de CRLF em vários arquivos (editados no
Windows). Isso foi corrigido: `.gitattributes` com `* text=auto eol=lf`,
`git add --renormalize .` e reescrita física do working tree. Se
`git status` voltar a mostrar um monte de arquivo "modificado" sem edição
real, é provavelmente o mesmo problema de novo — confirme com
`git diff -w` (deve dar zero linhas de diff real) antes de reescrever o
working tree.

## 4. Autenticação com GitHub

Já configurado nesta máquina: `gh auth status` mostra login ativo, e
`git config credential.helper` já usa `gh auth git-credential` (rodado via
`gh auth setup-git`). Push/pull não devem pedir usuário/token. Se pedirem,
rode `gh auth login` de novo.

## 5. Deploy

Deploy é na **Vercel**, com o projeto importado direto do repositório do
GitHub (`riquesignor/conversational-hub`) — ver
[README.md § "Deploy na Vercel"](README.md). A integração GitHub↔Vercel é
via GitHub App (não aparece como webhook clássico na API do repo), e o
comportamento padrão da Vercel é **fazer deploy de produção automaticamente
a cada push na branch de produção (`main`)**. Ou seja: **push na `main`
provavelmente dispara deploy real** — tenha isso em mente antes de dar
`git push`, revise o que está sendo enviado, e prefira branches/PRs para
mudanças que precisam de revisão antes de ir ao ar.

## Autorização de edição

Você (Claude Code) pode **editar arquivos deste projeto livremente**
quando o usuário pedir, sem precisar confirmar cada edição individual.
**`git commit` e `git push` só quando o usuário pedir explicitamente** —
nunca por iniciativa própria, dado o auto-deploy na Vercel descrito acima.
