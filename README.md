# Anime Production Studio

> **English summary:** Anime Production Studio is a free, open source
> desktop application for Windows 11 that helps creators manage anime
> production projects powered by AI: characters, world and lore, scripts
> and episodes, prompt libraries, visual references, voices and dubbing,
> and publishing. It is built with Electron, Vite, React and TypeScript,
> stores data locally first, and optionally syncs with Supabase.
> Downloads are published as GitHub Releases. License: MIT.

Aplicación de escritorio gratuita y de código abierto para **Windows 11**
que gestiona proyectos de producción de anime con IA: personajes, universo
y lore, guiones y episodios, biblioteca de prompts, referencias visuales,
voces y doblaje, y publicación.

## Funciones

- **Proyectos:** crea y gestiona varios proyectos de anime en una misma
  instalación, cada uno con sus personajes, lore, guiones y recursos.
- **Personajes:** fichas completas (descripción, apariencia, vestimentas,
  personalidad, voz, relaciones entre personajes) con galería de imágenes.
- **Universo y lore:** entradas de lore organizadas por tipo, con búsqueda,
  filtros y spoilers, más una cronología con línea temporal por eras.
- **Guiones y episodios:** editor de guiones con escenas, planos y
  diálogos por personaje; import y export en TXT, DOCX, PDF y Markdown.
- **Biblioteca de prompts:** prompts de generación organizados, con copia
  en un clic, filtros y variantes.
- **Referencias visuales:** galería central de medios con vista previa,
  zoom y enlaces a personajes y episodios.
- **Voces y doblaje:** registro de voces y actores de doblaje por
  personaje (en desarrollo).
- **Publicación:** preparación y seguimiento de la publicación de episodios
  (en desarrollo).
- **Actualizador integrado:** la app comprueba si hay nuevas versiones al
  arrancar y las instala con un clic, sin perder los datos del usuario.

## Datos locales primero

Los datos viven en tu equipo (base de datos local con Dexie / IndexedDB y
la carpeta de datos del usuario). La app funciona sin internet.

La sincronización en la nube con **Supabase** (Postgres + Auth + Storage)
es opcional. Sin configurar, todo funciona en local. La app nunca finge
estar conectada sin credenciales reales, y la clave `service_role` nunca
se usa en la app: solo URL + `anon key`.

Tus proyectos se guardan en `%APPDATA%\Anime Production Studio`, fuera de
la carpeta de instalación, así que sobreviven a actualizaciones y
reinstalaciones. Desinstalar la app **no borra tus datos**.

## Descarga

La forma recomendada de instalar la app es descargar el instalador desde
las **GitHub Releases**:

👉 https://github.com/stivenft202/anime-production-studio/releases

1. Descarga `ANIME-PRODUCTION-STUDIO-SETUP.exe` de la última release.
2. Haz doble clic para instalarlo.
3. Sigue el asistente (puedes elegir si crea un acceso directo en el
   escritorio) y abre la app desde el menú Inicio o el escritorio.

## Stack

- **Electron 34** + **Vite 6** + **React 18** + **TypeScript 5**
- **Tailwind CSS 3** para la interfaz
- **Dexie / IndexedDB** para persistencia local, **Zustand** para el estado
- **Tiptap** para el editor de guiones
- **electron-builder** + **NSIS** para el instalador de Windows
- **Supabase** (opcional) para sincronización en la nube

## Desarrollo

Requisitos: Node.js 20+ y npm.

```bash
npm install
npm run dev        # vista previa web (Vite) en http://localhost:5173
npm run build      # compila front + Electron (genera dist/ y dist-electron/)
```

### Instalador SETUP.exe

El instalador de Windows se construye en dos pasos: `electron-builder`
empaqueta la app en un directorio (`--win dir`) y NSIS (`makensis`)
construye el instalador con asistente a partir de
`installer/anime-production-studio.nsi`.

**En local (Linux, sin wine):**

```bash
scripts/build-installer.sh
# 1) electron-builder --win dir (con electron-builder.yml)
# 2) makensis con installer/anime-production-studio.nsi
# Genera release/ANIME-PRODUCTION-STUDIO-SETUP.exe (~155 MB) + latest.yml + .blockmap
```

Necesita `makensis` (paquete `nsis` de apt) y `dist/` ya construido
(`npm run build`).

**En GitHub Actions (automático):** el workflow
`.github/workflows/build-windows.yml` construye el instalador en un runner
`windows-latest` en cada push a `main`, en cada pull request y bajo
demanda (`workflow_dispatch`). El instalador, `latest.yml` y el `.blockmap`
quedan como artefacto de la ejecución. Las releases se publican a mano.

## Estructura del repositorio

```
anime-production-studio/
├── electron/            proceso main y preload de Electron
├── src/
│   ├── components/      componentes de la interfaz
│   ├── db/              base de datos local (Dexie)
│   ├── lib/             supabase.ts, syncStatus.ts, …
│   ├── pages/           páginas (Settings, Personajes, …)
│   └── store/           estado global (Zustand)
├── supabase/
│   └── migrations/      0001_init.sql (entidades + RLS + buckets)
├── assets/              icon.png, icon.ico
├── installer/           anime-production-studio.nsi (instalador NSIS)
├── scripts/             build-installer.sh, make-latest-yml.mjs, make-icon.py
├── docs/                guías (supabase-setup.md)
├── public/              archivos estáticos de la app web
├── .github/workflows/   build-windows.yml (build automático en CI)
├── .env.example         variables opcionales de Supabase
└── electron-builder.yml configuración del empaquetado Windows
```

## Supabase (opcional)

Guía paso a paso en [`docs/supabase-setup.md`](docs/supabase-setup.md):
crear el proyecto (plan gratis), ejecutar la migración
`supabase/migrations/0001_init.sql` en el editor SQL, copiar la URL y la
`anon key`, y pegarlas en **Configuración** dentro de la app.

## Firma de código

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

Los instaladores de las releases oficiales se firman con un certificado de
la SignPath Foundation. La política completa está en
[`CODE_SIGNING_POLICY.md`](CODE_SIGNING_POLICY.md): solo se firman
binarios propios construidos desde este repositorio en GitHub Actions, y
cada versión necesita aprobación manual antes de publicarse.

## Cómo contribuir

¡Las contribuciones son bienvenidas!

1. Abre un *issue* describiendo el cambio o el problema.
2. Haz un *fork* del repositorio y crea una rama desde `main`.
3. Haz tus cambios, comprueba que `npm run build` pasa sin errores y abre
   un *pull request* describiendo qué cambia y por qué.
4. Los cambios de comportamiento deben venir acompañados de una
   descripción clara de cómo probarlos.

Por favor, no incluyas datos personales, claves ni credenciales en issues
ni en pull requests. Las claves de Supabase van solo en tu archivo `.env`
local, que nunca se sube al repositorio.

## Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo
[LICENSE](LICENSE).
