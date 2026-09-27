#!/usr/bin/env bash
# Faz bind mount, em disco local, das pastas do projeto que precisam de
# symlinks Unix (node_modules/.bin do npm, e .next/node_modules/* que o
# Turbopack cria durante o build/dev) por cima das mesmas pastas no pen
# drive exFAT (exFAT não suporta symlink). Idempotente: pasta já montada é
# ignorada.
#
# Precisa rodar como root (mount --bind). É chamado tanto manualmente (via
# setup-linux-devenv.sh, com sudo) quanto pelo serviço systemd disparado pela
# regra udev quando o pen drive é conectado (ver install-linux-automount.sh).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

OWNER="$(stat -c '%U' "$PROJECT_ROOT")"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"
CACHE_ROOT="$OWNER_HOME/.cache/pendrive-node-modules/$PROJECT_NAME"

for name in node_modules .next; do
  cache_dir="$CACHE_ROOT/$name"
  target_dir="$PROJECT_ROOT/$name"

  mkdir -p "$cache_dir" "$target_dir"
  chown "$OWNER":"$OWNER" "$cache_dir" "$target_dir" 2>/dev/null || true

  if mountpoint -q "$target_dir"; then
    echo "$name já montado em $target_dir"
    continue
  fi

  mount --bind "$cache_dir" "$target_dir"
  echo "$name montado: $cache_dir -> $target_dir (owner: $OWNER)"
done
