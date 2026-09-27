#!/usr/bin/env bash
# Setup do ambiente Linux para este projeto quando ele mora num pen drive
# exFAT (sem suporte a symlinks Unix). Faz o bind mount de node_modules pra
# disco local (via mount-node-modules.sh, com sudo) e instala as
# dependências com a versão de Node certa (via nvm + .nvmrc).
#
# Rode isso manualmente sempre que trocar de máquina e o node_modules ainda
# não estiver montado. Se você já rodou install-linux-automount.sh nesta
# máquina, o mount acontece sozinho ao plugar o pen drive — mas o
# `npm ci`/`npm install` ainda precisa ser rodado manualmente aqui.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==> Garantindo bind mount de node_modules em disco local (pode pedir sudo)..."
sudo "$SCRIPT_DIR/mount-node-modules.sh"

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
else
  echo "AVISO: nvm não encontrado em $NVM_DIR — usando o node do PATH." >&2
fi

cd "$PROJECT_ROOT"
nvm use || nvm install

echo "==> node: $(node --version 2>&1)"
echo "==> npm:  $(npm --version 2>&1)"

if [ -f package-lock.json ]; then
  echo "==> Instalando dependências (npm ci)..."
  npm ci
else
  echo "==> Instalando dependências (npm install)..."
  npm install
fi

echo "==> Setup completo."
