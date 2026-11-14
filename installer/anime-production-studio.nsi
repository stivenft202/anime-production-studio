; ============================================================================
; Anime Production Studio — Instalador NSIS (Fase 1)
; Se compila en Linux con makensis (paquete nsis de apt), sin wine.
;
; El script recibe valores por /D desde scripts/build-installer.sh:
;   /DVERSION=1.0.0            versión que se muestra en el instalador
;   /DSRCDIR=release/win-unpacked   carpeta con la app ya empaquetada
;   /DOUTFILE=release/ANIME-PRODUCTION-STUDIO-SETUP.exe
;
; IMPORTANTE — datos del usuario:
;   Los datos (proyectos, personajes, ajustes) viven en
;   %APPDATA%\Anime Production Studio, FUERA de la carpeta de instalación,
;   para que sobrevivan a actualizaciones y reinstalaciones.
;   El desinstalador NUNCA borra esa carpeta: no hay ningún RMDir ni Delete
;   sobre $APPDATA\Anime Production Studio en este script. Si algún día se
;   quiere ofrecer borrar los datos, debe ser una opción explícita del
;   usuario, nunca el comportamiento por defecto.
; ============================================================================

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!ifndef SRCDIR
  !define SRCDIR "release/win-unpacked"
!endif
!ifndef OUTFILE
  !define OUTFILE "release/ANIME-PRODUCTION-STUDIO-SETUP.exe"
!endif

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "StrFunc.nsh"
${Using:StrFunc} StrStr

; --- Bitmap de bienvenida/fin ----------------------------------------------
; Bitmap genérico derivado de assets/icon.png (letra "A" violeta) en 24 bits
; 164x314 px, sin texto. Sale en la página de bienvenida y en la de fin.
; La ruta puede venir como /DWELCOMEBMP=... (ruta ABSOLUTA, la usa el build
; de GitHub Actions); sin ella se usa la ruta relativa, que el makensis de
; Linux resuelve respecto a la carpeta del .nsi. El makensis de Windows
; (3.13, runner) NO resuelve esa ruta relativa ni desde la raíz del repo
; ni desde installer/: por eso en Actions se pasa la ruta absoluta.
!ifndef WELCOMEBMP
  !define WELCOMEBMP "assets/welcome.bmp"
!endif
!define MUI_WELCOMEFINISHPAGE_BITMAP "${WELCOMEBMP}"

; --- Datos generales -------------------------------------------------------
Name "Anime Production Studio"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\Anime Production Studio"
InstallDirRegKey HKLM "Software\Anime Production Studio" "InstallDir"
RequestExecutionLevel admin
BrandingText "Anime Production Studio ${VERSION}"

; --- Variables ---------------------------------------------------------------
; Declaradas ANTES de .onInit: en modo silencioso .onInit asigna
; $CreateDesktopShortcut y NSIS exige la variable ya declarada.
Var Dialog
Var CheckboxDesktop
Var CreateDesktopShortcut
; $IsUpdate = 1 cuando el instalador lo lanzó electron-updater para aplicar
; una actualización descargada (argumentos --updated / --force-run).
; Se detecta en .onInit y se consume en .onInstSuccess para reabrir la app.
Var IsUpdate

; Instalación silenciosa (/S): la admite NSIS de forma nativa (se saltan
; todas las páginas) y es la que usa el actualizador en la app
; (electron-updater ejecuta el SETUP con /S al pulsar "Instalar al salir").
; En modo silencioso la página de opciones no se muestra, así que el
; acceso directo del escritorio queda activado por defecto, igual que en
; la instalación normal. Los datos del usuario (%APPDATA%) no se tocan
; nunca, ni al instalar ni al desinstalar.
Function .onInit
  SetRegView 64
  ${If} ${Silent}
    StrCpy $CreateDesktopShortcut ${BST_CHECKED}
  ${EndIf}

  ; --- Detección de actualización (corrección v1.4.1) -----------------------
  ; electron-updater lanza el instalador con "--updated --force-run" al
  ; pulsar "Instalar al salir". NSIS no entiende esos argumentos por sí
  ; mismo, así que se buscan como subcadena en $CMDLINE con ${StrStr}
  ; (StrFunc.nsh, de serie): devuelve la parte desde el hallazgo, o ""
  ; si no hay coincidencia. Basta con que aparezca UNO de los dos.
  ; El resultado se guarda en $IsUpdate para reabrir la app en
  ; .onInstSuccess. Una instalación manual (doble clic o /S sin esos
  ; argumentos) deja $IsUpdate en 0 y NO reabre la app.
  StrCpy $IsUpdate 0
  ${StrStr} $0 $CMDLINE "--updated"
  ${If} $0 != ""
    StrCpy $IsUpdate 1
  ${Else}
    ${StrStr} $0 $CMDLINE "--force-run"
    ${If} $0 != ""
      StrCpy $IsUpdate 1
    ${EndIf}
  ${EndIf}
FunctionEnd

; Al terminar la instalación con éxito, si fue una actualización lanzada
; por electron-updater, se reabre la app instalada para que el usuario la
; vea actualizada, como promete la interfaz ("se cerrará y se abrirá de
; nuevo actualizada"). .onInstSuccess también corre en modo silencioso
; /S, donde las páginas (incluida MUI_PAGE_FINISH) se saltan, así que
; este es el único punto que cubre ambos modos. Exec no espera: el
; instalador termina mientras la app arranca. Si no es una actualización
; ($IsUpdate = 0) no se abre nada.
Function .onInstSuccess
  ${If} $IsUpdate == 1
    IfFileExists "$INSTDIR\Anime Production Studio.exe" 0 +2
      Exec '"$INSTDIR\Anime Production Studio.exe"'
  ${EndIf}
FunctionEnd

Function un.onInit
  SetRegView 64
FunctionEnd

; --- Páginas del instalador -------------------------------------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom DesktopShortcutPageCreate DesktopShortcutPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; --- Páginas del desinstalador ----------------------------------------------
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

; --- Página personalizada: acceso directo en el escritorio -------------------
Function DesktopShortcutPageCreate
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Opciones de instalación"
  ${NSD_CreateCheckbox} 0 32u 100% 12u "Crear acceso directo en el escritorio"
  Pop $CheckboxDesktop
  ; Marcado por defecto.
  ${NSD_Check} $CheckboxDesktop

  nsDialogs::Show
FunctionEnd

Function DesktopShortcutPageLeave
  ${NSD_GetState} $CheckboxDesktop $CreateDesktopShortcut
FunctionEnd

; --- Instalación ---------------------------------------------------------------
Section "Anime Production Studio" SecMain
  SectionIn RO
  SetOutPath $INSTDIR

  ; Copia TODO el contenido desempaquetado por electron-builder.
  File /r "${SRCDIR}/*.*"

  ; Desinstalador.
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Acceso directo en el menú Inicio (siempre).
  ; El exe conserva el icono por defecto de Electron (sin wine no se puede
  ; incrustar el icono en el exe); los accesos directos usan icon.ico, que
  ; electron-builder copia a $INSTDIR\resources\icon.ico (extraResources).
  CreateDirectory "$SMPROGRAMS\Anime Production Studio"
  CreateShortcut "$SMPROGRAMS\Anime Production Studio\Anime Production Studio.lnk" "$INSTDIR\Anime Production Studio.exe" "" "$INSTDIR\resources\icon.ico"
  CreateShortcut "$SMPROGRAMS\Anime Production Studio\Desinstalar Anime Production Studio.lnk" "$INSTDIR\Uninstall.exe"

  ; Acceso directo en el escritorio (opcional, marcado por defecto).
  ${If} $CreateDesktopShortcut == ${BST_CHECKED}
    CreateShortcut "$DESKTOP\Anime Production Studio.lnk" "$INSTDIR\Anime Production Studio.exe" "" "$INSTDIR\resources\icon.ico"
  ${EndIf}

  ; Registro de la ruta de instalación (para futuras actualizaciones).
  WriteRegStr HKLM "Software\Anime Production Studio" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Anime Production Studio" "Version" "${VERSION}"

  ; Claves de "Programas y características" (Agregar o quitar programas).
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "DisplayName" "Anime Production Studio"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "Publisher" "Stiven"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "DisplayIcon" "$INSTDIR\resources\icon.ico"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio" "NoRepair" 1
SectionEnd

; --- Desinstalación ------------------------------------------------------------
; NUNCA borra %APPDATA%\Anime Production Studio: ahí viven los datos del
; usuario (proyectos, personajes, ajustes de Supabase) y deben sobrevivir
; a la desinstalación. Solo se elimina la carpeta de instalación.
Section "Uninstall"
  Delete "$DESKTOP\Anime Production Studio.lnk"
  Delete "$SMPROGRAMS\Anime Production Studio\Anime Production Studio.lnk"
  Delete "$SMPROGRAMS\Anime Production Studio\Desinstalar Anime Production Studio.lnk"
  RMDir "$SMPROGRAMS\Anime Production Studio"

  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AnimeProductionStudio"
  DeleteRegKey HKLM "Software\Anime Production Studio"
SectionEnd
