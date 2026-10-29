#!/bin/bash
# Instalador de L&A Gestión para macOS. Se ejecuta en la Terminal con:
#   curl -fsSL https://github.com/LuChM27/lya-gestion/releases/download/vX.Y.Z/instalar.sh | bash
#
# Todo se descarga con curl y las apps se crean en la Mac, así que macOS no las marca
# en cuarentena y Gatekeeper no muestra el aviso de desarrollador no verificado.
# Se puede ejecutar varias veces: nunca borra ~/LyA/datos.
#
# Variables opcionales:
#   LYA_PAQUETE=/ruta/lya-gestion-X.Y.Z-<plataforma>.tar.gz  instala sin descargar
#   LYA_VERSION=X.Y.Z                                         versión a instalar
set -euo pipefail

VERSION="${LYA_VERSION:-__VERSION__}"
REPO="LuChM27/lya-gestion"
LYA="$HOME/LyA"
AGENTES="$HOME/Library/LaunchAgents"
ETIQUETAS=(co.lyatejidos.gestion co.lyatejidos.menu)
NOMBRE_APP="L&A Gestión.app"
FIREWALL=/usr/libexec/ApplicationFirewall/socketfilterfw
URL_SALUD="http://127.0.0.1:8080/api/salud"

aviso() { printf '\n==> %s\n' "$1"; }
fallar() { printf '\nError: %s\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || fallar "Este instalador es para macOS."
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fallar "Falta la versión (usa LYA_VERSION=X.Y.Z)."
case "$(uname -m)" in
  x86_64) PLATAFORMA=x86_64-apple-darwin ;;
  arm64) PLATAFORMA=aarch64-apple-darwin ;;
  *) fallar "Procesador no reconocido: $(uname -m)" ;;
esac

PAQUETE="lya-gestion-$VERSION-$PLATAFORMA.tar.gz"
TEMPORAL="$(mktemp -d)"
trap 'rm -rf "$TEMPORAL"' EXIT
UID_GUI="$(id -u)"

aviso "Descargando L&A Gestión $VERSION ($PLATAFORMA)"
if [ -n "${LYA_PAQUETE:-}" ]; then
  cp "$LYA_PAQUETE" "$TEMPORAL/$PAQUETE"
  cp "$LYA_PAQUETE.sha256" "$TEMPORAL/$PAQUETE.sha256"
else
  BASE="https://github.com/$REPO/releases/download/v$VERSION"
  curl -fL --progress-bar -o "$TEMPORAL/$PAQUETE" "$BASE/$PAQUETE"
  curl -fsSL -o "$TEMPORAL/$PAQUETE.sha256" "$BASE/$PAQUETE.sha256"
fi
(cd "$TEMPORAL" && shasum -a 256 -c "$PAQUETE.sha256" >/dev/null) \
  || fallar "El paquete descargado está dañado. Vuelve a ejecutar el instalador."

aviso "Instalando en $LYA"
DESTINO="$LYA/versiones/$VERSION"
mkdir -p "$LYA/versiones" "$LYA/datos" "$LYA/registros" "$HOME/LyA-Respaldos" "$AGENTES"
rm -rf "$DESTINO.nuevo"
mkdir -p "$DESTINO.nuevo"
tar -xzf "$TEMPORAL/$PAQUETE" -C "$DESTINO.nuevo"

# Detener lo que esté corriendo antes de reemplazar archivos en uso.
for etiqueta in "${ETIQUETAS[@]}"; do
  launchctl bootout "gui/$UID_GUI/$etiqueta" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    launchctl print "gui/$UID_GUI/$etiqueta" >/dev/null 2>&1 || break
    sleep 0.5
  done
done
rm -rf "$DESTINO"
mv "$DESTINO.nuevo" "$DESTINO"
ln -sfn "versiones/$VERSION" "$LYA/actual"

aviso "Registrando el servicio y el ícono de la barra de menú"
HOME_SED="$(printf '%s' "$HOME" | sed 's/[&|\\]/\\&/g')"
for etiqueta in "${ETIQUETAS[@]}"; do
  sed "s|__HOME__|$HOME_SED|g" "$DESTINO/recursos/$etiqueta.plist" > "$AGENTES/$etiqueta.plist"
  launchctl bootstrap "gui/$UID_GUI" "$AGENTES/$etiqueta.plist" \
    || fallar "macOS no aceptó el servicio $etiqueta."
done

aviso "Creando $NOMBRE_APP"
if [ -w /Applications ]; then
  APLICACIONES=/Applications
else
  APLICACIONES="$HOME/Applications"
  mkdir -p "$APLICACIONES"
fi
APP="$APLICACIONES/$NOMBRE_APP"
rm -rf "$APP"
osacompile -o "$APP" "$DESTINO/recursos/lanzador.applescript"
cp "$DESTINO/recursos/icono.icns" "$APP/Contents/Resources/applet.icns"
touch "$APP"

# El Dock guarda la ruta como URL de archivo: espacios y tildes van codificados.
URL_APP="file://${APP// /%20}/"
URL_APP="${URL_APP//ó/%C3%B3}"
if ! defaults read com.apple.dock persistent-apps 2>/dev/null | grep -qF "L&A%20Gesti"; then
  defaults write com.apple.dock persistent-apps -array-add \
    "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>${URL_APP//&/&amp;}</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>"
  killall Dock
fi

if "$FIREWALL" --getglobalstate 2>/dev/null | grep -q "State = [12]"; then
  aviso "El firewall está activo: escribe la contraseña de la Mac para que el celular pueda entrar"
  sudo "$FIREWALL" --add "$DESTINO/python/bin/python3.13" >/dev/null
  sudo "$FIREWALL" --unblockapp "$DESTINO/python/bin/python3.13" >/dev/null
fi

aviso "Encendiendo L&A"
for _ in $(seq 1 30); do
  if curl -fsS -m 2 "$URL_SALUD" >/dev/null 2>&1; then
    open "http://localhost:8080"
    aviso "Listo. L&A quedó en el Dock y en la barra de menú."
    exit 0
  fi
  sleep 1
done
(cd "$DESTINO" && ./python/bin/python3 -m app.lanzador diagnostico) || true
fallar "L&A no respondió en 30 segundos. Envía a Luciano el diagnóstico de arriba."
