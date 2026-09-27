#!/usr/bin/env bash
# Instala a automação que faz o bind mount de node_modules acontecer sozinho
# sempre que ESTE pen drive (identificado pelo UUID do filesystem, não pelo
# /dev/sdX, que muda) for conectado NESTA máquina.
#
# Mecanismo: uma regra udev casa no UUID do filesystem e usa
# ENV{SYSTEMD_WANTS} pra disparar um serviço systemd oneshot só no evento de
# conexão do device. De propósito NÃO usamos um systemd `.path` unit com
# PathExists numa pasta que existe sempre (ex: o próprio diretório do
# projeto) — isso reavalia com frequência e entra em loop de restart até o
# systemd bloquear a unit por excesso de tentativas (unit-start-limit-hit).
#
# O ExecStart espera o pen drive terminar de montar antes de rodar o script
# de bind mount que mora dentro do próprio pen drive (evita a corrida entre
# o udev disparar o serviço e o automounter de disco - udisks2/gvfs -
# terminar de montar o filesystem).
#
# Precisa de sudo. Rode uma vez por máquina.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

UUID="$(lsblk -no UUID "$(df --output=source "$PROJECT_ROOT" | tail -1)" | tr -d ' ')"
MOUNT_POINT="$(df --output=target "$PROJECT_ROOT" | tail -1)"

if [ -z "$UUID" ]; then
  echo "ERRO: não consegui detectar o UUID do filesystem do pen drive." >&2
  exit 1
fi

SERVICE_NAME="pendrive-nodemodules-${PROJECT_NAME}.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
UDEV_RULE_PATH="/etc/udev/rules.d/99-${PROJECT_NAME}-nodemodules.rules"

echo "==> Projeto:     $PROJECT_NAME"
echo "==> Pen drive:   UUID=$UUID, mount point esperado=$MOUNT_POINT"
echo "==> Serviço:     $SERVICE_PATH"
echo "==> Regra udev:  $UDEV_RULE_PATH"

sudo tee "$SERVICE_PATH" > /dev/null <<EOF
[Unit]
Description=Bind mount node_modules cache para ${PROJECT_NAME} (pen drive UUID=${UUID})

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'for i in \$(seq 1 60); do mountpoint -q "${MOUNT_POINT}" && break; sleep 1; done; exec "${SCRIPT_DIR}/mount-node-modules.sh"'
EOF

sudo tee "$UDEV_RULE_PATH" > /dev/null <<EOF
ACTION=="add", SUBSYSTEM=="block", ENV{ID_FS_UUID}=="${UUID}", TAG+="systemd", ENV{SYSTEMD_WANTS}+="${SERVICE_NAME}"
EOF

echo "==> Recarregando systemd e udev..."
sudo systemctl daemon-reload
sudo udevadm control --reload-rules

echo "==> Testando o serviço agora (drive já conectado)..."
sudo systemctl start "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager || true

echo "==> Instalado. Da próxima vez que este pen drive (UUID=${UUID}) for"
echo "    conectado nesta máquina, node_modules será montado sozinho."
