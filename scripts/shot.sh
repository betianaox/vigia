#!/usr/bin/env bash
# Captura la pantalla del telefono conectado y la guarda en `capturas/`.
#
#   ./scripts/shot.sh 01-inicio
#
# Sirve para mirar la app sin tener el telefono en la mano —util cuando la maquina es remota— y
# para sacar las capturas de la ficha de Play.
#
# OJO CON EL RATIO. Play exige que el lado largo no pase del doble del corto. Un nubia Z2463N es
# 1080x2392 (2.21:1) y NO entra: una captura nativa puede ser rechazada. Para las de la ficha hay
# que recortarlas a 1080x2160 o menos de alto. Para mirar el diseño, la nativa sirve igual.
set -euo pipefail

nombre="${1:-captura}"
destino="capturas"
mkdir -p "$destino"

archivo="$destino/$nombre.png"
adb exec-out screencap -p > "$archivo"

# `screencap` no informa el tamaño, y una captura de 0 bytes se ve igual que una buena en un `ls`
# apurado: si el telefono se desconecto, mejor enterarse ahora.
bytes=$(wc -c < "$archivo")
if [ "$bytes" -lt 1000 ]; then
  echo "La captura salio vacia ($bytes bytes). Revisa que el telefono siga conectado:" >&2
  echo "  adb devices -l" >&2
  exit 1
fi

echo "$archivo  ($((bytes / 1024)) KB)"
