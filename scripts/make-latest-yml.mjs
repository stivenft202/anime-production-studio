#!/usr/bin/env node
/**
 * Genera `latest.yml` (y el `.blockmap` opcional) para la release de GitHub
 * del instalador de Anime Production Studio (Fase 2.5).
 *
 * electron-updater necesita `latest.yml` en la release para saber qué
 * versión hay publicada: lo descarga de
 * https://github.com/stivenft202/anime-production-studio/releases/download/v<VERSION>/latest.yml
 * y compara `version` con la instalada. El `.blockmap` permite la
 * descarga DIFERENCIAL (solo los bloques que cambiaron); sin él, la
 * descarga es completa.
 *
 * El instalador SETUP.exe se construye con NSIS nativo (makensis), no con
 * el target nsis de electron-builder, así que electron-builder no genera
 * este archivo: lo genera este script a partir del .exe ya construido.
 *
 * Uso:
 *   node scripts/make-latest-yml.mjs [exe] [version] [outdir]
 *
 *   exe      ruta del instalador (por defecto
 *            release/ANIME-PRODUCTION-STUDIO-SETUP.exe)
 *   version  versión (por defecto la de package.json)
 *   outdir   carpeta donde escribir latest.yml y el .blockmap
 *            (por defecto la carpeta del exe)
 *
 * Ejemplo:
 *   node scripts/make-latest-yml.mjs release/ANIME-PRODUCTION-STUDIO-SETUP.exe 1.2.0 release
 *
 * La publicación en GitHub la hace el coordinador (no este script).
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const exeArg = process.argv[2] ?? path.join(root, 'release', 'ANIME-PRODUCTION-STUDIO-SETUP.exe')
const exePath = path.resolve(exeArg)
const outDir = path.resolve(process.argv[4] ?? path.dirname(exePath))

let version = process.argv[3]
if (!version) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  version = pkg.version
}

if (!fs.existsSync(exePath)) {
  console.error(`ERROR: no existe el instalador: ${exePath}`)
  console.error('Primero construye el instalador (scripts/build-installer.sh).')
  process.exit(1)
}

const fileName = path.basename(exePath)
const stat = fs.statSync(exePath)
const sha512 = createHash('sha512').update(fs.readFileSync(exePath)).digest('base64')
const releaseDate = new Date().toISOString()

// --- .blockmap (descarga diferencial) --------------------------------------
// Se intenta con el app-builder que trae electron-builder. Si no está o
// falla, se sigue SIN blockmap: la actualización seguirá funcionando, solo
// que la descarga será completa en vez de diferencial.
let blockMapSize = null
const blockmapPath = `${exePath}.blockmap`
const appBuilderCandidates = [
  path.join(root, 'node_modules', 'app-builder-bin', process.platform, process.arch, 'app-builder'),
  path.join(root, 'node_modules', 'app-builder-bin', process.platform, process.arch, 'app-builder.exe'),
]
const appBuilder = appBuilderCandidates.find((p) => fs.existsSync(p))
if (appBuilder) {
  const result = spawnSync(appBuilder, ['blockmap', '--input', exePath, '--output', blockmapPath], {
    stdio: 'inherit',
  })
  if (result.status === 0 && fs.existsSync(blockmapPath)) {
    blockMapSize = fs.statSync(blockmapPath).size
    console.log(`blockmap OK: ${blockmapPath} (${blockMapSize} bytes)`)
  } else {
    console.warn('AVISO: no se pudo generar el .blockmap; la descarga será completa (no diferencial).')
  }
} else {
  console.warn('AVISO: no se encontró app-builder; no se genera .blockmap (descarga completa).')
}

// --- latest.yml ------------------------------------------------------------
// Formato que espera electron-updater (el mismo que genera
// electron-builder): version, files[] con url/sha512/size, path y sha512
// en la raíz, y releaseDate. blockMapSize solo si se generó el blockmap.
const lines = [
  `version: ${version}`,
  'files:',
  `  - url: ${fileName}`,
  `    sha512: ${sha512}`,
  `    size: ${stat.size}`,
]
if (blockMapSize !== null) lines.push(`    blockMapSize: ${blockMapSize}`)
lines.push(`path: ${fileName}`)
lines.push(`sha512: ${sha512}`)
lines.push(`releaseDate: '${releaseDate}'`)
lines.push('')

fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'latest.yml')
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')

console.log(`latest.yml OK: ${outPath}`)
console.log(`  version: ${version}`)
console.log(`  archivo: ${fileName} (${stat.size} bytes, sha512 ${sha512.slice(0, 16)}…)`)
console.log(`  blockmap: ${blockMapSize !== null ? 'sí' : 'no (descarga completa)'}`)
console.log('Sube latest.yml (y el .blockmap si existe) como archivos de la release v' + version + ' en GitHub.')
