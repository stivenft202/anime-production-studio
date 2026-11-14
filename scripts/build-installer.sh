#!/usr/bin/env bash
# Anime Production Studio — construye el instalador de Windows (Fase 1)
#
# Pasos:
#   1) npx electron-builder --win dir   (usa el front ya construido en dist/;
#      NO reconstruye el front si dist/ ya existe)
#   2) verifica que existe release/win-unpacked/"Anime Production Studio.exe"
#   3) makensis con el script .nsi -> release/ANIME-PRODUCTION-STUDIO-SETUP.exe
#
# Uso:
#   scripts/build-installer.sh            (versión 1.0.0 por defecto)
#   VERSION=1.0.1 scripts/build-installer.sh
#
# Requisitos: node_modules instalados (electron-builder), makensis (paquete
# nsis de apt) y dist/ ya construido (npm run build, lo hace otro agente).
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${VERSION:-1.0.0}"
EXE_NAME="Anime Production Studio.exe"
# Rutas ABSOLUTAS: makensis resuelve las rutas relativas del .nsi respecto
# a la carpeta del script (installer/), no respecto al cwd.
# UNPACKED_DIR lleva barra final: el .nsi usa "${SRCDIR}*.*" (sin "/" entre
# SRCDIR y *.*) porque el makensis de Windows (3.13) no acepta la ruta
# mezclada "D:\...\win-unpacked/*.*"; con la barra final la ruta queda con
# el separador correcto en cada plataforma.
UNPACKED_DIR="$(pwd)/release/win-unpacked/"
OUT_SETUP="$(pwd)/release/ANIME-PRODUCTION-STUDIO-SETUP.exe"

echo "== Anime Production Studio — build del instalador (v${VERSION}) =="

if [ ! -d "dist" ]; then
  echo "ERROR: no existe dist/. Primero hay que construir el front (npm run build)."
  exit 1
fi

if ! command -v makensis >/dev/null 2>&1; then
  echo "ERROR: makensis no está instalado. Instala el paquete nsis (apt install nsis)."
  exit 1
fi

# 1) Empaquetado Windows (solo directorio, sin wine).
#    - Se usa --config electron-builder.yml explícitamente (package.json
#      también tiene una clave "build" y no incluye el icono).
#    - CSC_IDENTITY_AUTO_DISCOVERY=false desactiva la firma de código:
#      el instalador es SIN FIRMA (SmartScreen avisará) y firmar en Linux
#      exigiría wine, que no se puede instalar por el muro de disco.
echo "--> electron-builder --win dir"
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --config electron-builder.yml --win dir

# 2) Verificar el ejecutable desempaquetado.
if [ ! -f "${UNPACKED_DIR}/${EXE_NAME}" ]; then
  echo "ERROR: no se encontró ${UNPACKED_DIR}/${EXE_NAME} tras electron-builder."
  exit 1
fi
echo "--> OK: ${UNPACKED_DIR}/${EXE_NAME}"

# 3) Instalador NSIS con asistente.
echo "--> makensis installer/anime-production-studio.nsi"
makensis \
  -DVERSION="${VERSION}" \
  -DSRCDIR="${UNPACKED_DIR}" \
  -DOUTFILE="${OUT_SETUP}" \
  installer/anime-production-studio.nsi

if [ ! -f "${OUT_SETUP}" ]; then
  echo "ERROR: no se generó ${OUT_SETUP}."
  exit 1
fi

echo "== Instalador listo: ${OUT_SETUP} ($(du -h "${OUT_SETUP}" | cut -f1)) =="

# 4) latest.yml (+ .blockmap) para el actualizador en la app (Fase 2.5).
#    No es fatal: si falla, el instalador sigue siendo válido y el
#    latest.yml se puede generar a mano con:
#      node scripts/make-latest-yml.mjs "${OUT_SETUP}" "${VERSION}" release
echo "--> latest.yml para electron-updater"
if ! node scripts/make-latest-yml.mjs "${OUT_SETUP}" "${VERSION}" release; then
  echo "AVISO: no se generó latest.yml (ver el error de arriba)."
fi
