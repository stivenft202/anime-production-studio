/**
 * Editor de texto enriquecido del guion de un episodio (Tiptap, fase 3).
 *
 * El contenido se guarda en el episodio como `scriptJson` (JSON de
 * Tiptap) y `scriptText` (texto plano). Autoguardado con debounce al
 * editar (800 ms) y al salir del editor: el contenido NUNCA se pierde
 * al cerrar o recargar la app, porque cada cambio termina en Dexie.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
} from 'lucide-react'
import { db } from '../../db/db'
import { tiptapJsonToText, textToTiptapJson } from '../../lib/scriptIO'
import { updateEpisode, type Episode } from '../../lib/scripts'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

type SaveState = 'guardado' | 'guardando' | 'sin-cambios'

function initialContent(episode: Episode): string {
  if (episode.scriptJson) {
    try {
      const parsed: unknown = JSON.parse(episode.scriptJson)
      if (parsed && typeof parsed === 'object') return episode.scriptJson
    } catch {
      // JSON corrupto: se reconstruye desde el texto plano, si lo hay.
    }
  }
  if (episode.scriptText) return textToTiptapJson(episode.scriptText)
  return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
}

export function ScriptEditor({ episode }: { episode: Episode }) {
  const [saveState, setSaveState] = useState<SaveState>('sin-cambios')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const timerRef = useRef<number | null>(null)
  const savingRef = useRef(false)
  const editorRef = useRef<typeof editor | null>(null)

  const saveNow = useCallback(
    async (scriptJson: string, scriptText: string) => {
      if (savingRef.current) return
      savingRef.current = true
      setSaveState('guardando')
      try {
        await updateEpisode(db, episode.id, { scriptJson, scriptText })
        setSavedAt(new Date())
        setSaveState('guardado')
      } finally {
        savingRef.current = false
      }
    },
    [episode.id],
  )

  const scheduleSave = useCallback(
    (scriptJson: string, scriptText: string) => {
      setSaveState('guardando')
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void saveNow(scriptJson, scriptText)
      }, 800)
    },
    [saveNow],
  )

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent(episode),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[320px] rounded-md border bg-background p-4 focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const scriptJson = JSON.stringify(ed.getJSON())
      const scriptText = ed.getText()
      scheduleSave(scriptJson, scriptText)
    },
  })

  // Guarda lo pendiente al desmontar (cambiar de episodio o de sección).
  // Se usa un ref porque el editor no existe en el primer render.
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const ed = editorRef.current
      if (ed) {
        const scriptJson = JSON.stringify(ed.getJSON())
        const scriptText = ed.getText()
        void updateEpisode(db, episode.id, { scriptJson, scriptText })
      }
    }
    // Solo al desmontar; `episode.id` es estable mientras vive el editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Si el episodio cambia por fuera (importación), recarga el contenido.
  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    const incoming = initialContent(episode)
    if (current !== incoming && tiptapJsonToText(incoming) !== editor.getText()) {
      editor.commands.setContent(JSON.parse(incoming) as Parameters<typeof editor.commands.setContent>[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.scriptJson, episode.scriptText])

  if (!editor) {
    return <p className="text-sm text-muted-foreground">Cargando editor…</p>
  }

  const toolbarButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    Icon: typeof Bold,
  ) => (
    <Button
      key={label}
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      title={label}
      onClick={onClick}
      className={cn('h-8 w-8 p-0')}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {toolbarButton('Negrita', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), Bold)}
        {toolbarButton('Cursiva', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), Italic)}
        {toolbarButton('Título 1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1)}
        {toolbarButton('Título 2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
        {toolbarButton('Título 3', editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3)}
        {toolbarButton('Lista', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), List)}
        {toolbarButton('Lista numerada', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {toolbarButton('Cita', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), Quote)}
        {toolbarButton('Deshacer', false, () => editor.chain().focus().undo().run(), Undo)}
        {toolbarButton('Rehacer', false, () => editor.chain().focus().redo().run(), Redo)}
        <span className="ml-auto text-xs text-muted-foreground">
          {saveState === 'guardando' && 'Guardando…'}
          {saveState === 'guardado' && savedAt && `Guardado a las ${savedAt.toLocaleTimeString('es-ES')}`}
          {saveState === 'sin-cambios' && 'Los cambios se guardan solos'}
        </span>
      </div>
      <EditorContent editor={editor} />
      <p className="text-xs text-muted-foreground">
        El guion se guarda automáticamente mientras escribes. Puedes cerrar
        la aplicación en cualquier momento sin perder nada.
      </p>
    </div>
  )
}
