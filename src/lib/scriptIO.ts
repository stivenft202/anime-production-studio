/**
 * Importar y exportar el guion de un episodio (fase 3).
 *
 * Formatos:
 * - TXT y Markdown: lectura y escritura reales (File/Blob).
 * - DOCX: exporta con `docx`, importa con `mammoth` (texto plano).
 * - PDF: exporta con `jspdf` (texto plano con paginación).
 *
 * El guion vive en el episodio como `scriptJson` (JSON de Tiptap) y
 * `scriptText` (texto plano). Estas funciones convierten entre ambos y
 * los formatos de archivo sin inventar contenido: lo que no cabe en el
 * formato de destino (p. ej. el formato enriquecido en TXT) se pierde
 * de forma explícita y documentada en la interfaz.
 */
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'
import mammoth from 'mammoth'
import type { Episode } from '../db/db'
import { episodeLabel } from './scripts'

/* ------------------------------------------------------------------ */
/* Descarga de un archivo (funciona en navegador y en Electron)        */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, fileName: string, mime: string): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), fileName)
}

/** Nombre de archivo base para exportar un episodio, p. ej. `ep03-guion`. */
export function episodeFileBase(episode: Pick<Episode, 'number' | 'title'>): string {
  const slug = episode.title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const number = String(episode.number).padStart(2, '0')
  return slug ? `ep${number}-${slug}-guion` : `ep${number}-guion`
}

/* ------------------------------------------------------------------ */
/* Nodos de Tiptap (JSON)                                              */
/* ------------------------------------------------------------------ */

type TiptapNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: { type?: string }[]
}

function parseScriptJson(scriptJson?: string): TiptapNode | null {
  if (!scriptJson) return null
  try {
    const parsed: unknown = JSON.parse(scriptJson)
    if (parsed && typeof parsed === 'object' && (parsed as TiptapNode).type === 'doc') {
      return parsed as TiptapNode
    }
    return null
  } catch {
    return null
  }
}

/** Texto plano de un nodo (recursivo, sin formato). */
function nodeToText(node: TiptapNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(nodeToText).join('')
}

/** Texto plano de todo el documento Tiptap (un párrafo por línea). */
export function tiptapJsonToText(scriptJson?: string): string {
  const doc = parseScriptJson(scriptJson)
  if (!doc) return ''
  return (doc.content ?? []).map((block) => nodeToText(block)).join('\n')
}

function blockToMarkdown(block: TiptapNode): string {
  const text = nodeToText(block)
  switch (block.type) {
    case 'heading': {
      const level = typeof block.attrs?.level === 'number' ? block.attrs.level : 1
      return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${text}`
    }
    case 'bulletList':
      return (block.content ?? [])
        .map((item) => `- ${nodeToText(item)}`)
        .join('\n')
    case 'orderedList':
      return (block.content ?? [])
        .map((item, i) => `${i + 1}. ${nodeToText(item)}`)
        .join('\n')
    case 'blockquote':
      return text
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'codeBlock':
      return `\`\`\`\n${text}\n\`\`\``
    default:
      return text
  }
}

/** Markdown a partir del JSON de Tiptap (encabezados, listas y citas). */
export function tiptapJsonToMarkdown(scriptJson?: string): string {
  const doc = parseScriptJson(scriptJson)
  if (!doc) return ''
  return (doc.content ?? [])
    .map(blockToMarkdown)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** JSON de Tiptap a partir de texto plano (un párrafo por línea en blanco). */
export function textToTiptapJson(text: string): string {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  return JSON.stringify({
    type: 'doc',
    content: paragraphs.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })),
  })
}

/**
 * JSON de Tiptap a partir de Markdown (encabezados `#`, listas `-`/`1.`
 * y citas `>`; el resto son párrafos). El formato enriquecido en línea
 * (negrita, cursiva) no se reconstruye: queda como texto plano.
 */
export function markdownToTiptapJson(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const blocks: TiptapNode[] = []
  let listItems: string[] | null = null
  let listOrdered = false

  const flushList = () => {
    if (!listItems) return
    blocks.push({
      type: listOrdered ? 'orderedList' : 'bulletList',
      content: listItems.map((item) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: item }],
          },
        ],
      })),
    })
    listItems = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') {
      flushList()
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: [{ type: 'text', text: heading[2] }],
      })
      continue
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      if (!listItems || listOrdered) {
        flushList()
        listItems = []
        listOrdered = false
      }
      listItems.push(bullet[1])
      continue
    }
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (ordered) {
      if (!listItems || !listOrdered) {
        flushList()
        listItems = []
        listOrdered = true
      }
      listItems.push(ordered[1])
      continue
    }
    flushList()
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      blocks.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: quote[1] }],
          },
        ],
      })
      continue
    }
    blocks.push({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })
  }
  flushList()
  return JSON.stringify({ type: 'doc', content: blocks })
}

/* ------------------------------------------------------------------ */
/* Exportar                                                            */
/* ------------------------------------------------------------------ */

export function exportEpisodeTxt(episode: Episode): void {
  downloadText(episode.scriptText ?? '', `${episodeFileBase(episode)}.txt`, 'text/plain')
}

export function exportEpisodeMd(episode: Episode): void {
  const body = episode.scriptJson
    ? tiptapJsonToMarkdown(episode.scriptJson)
    : (episode.scriptText ?? '')
  const header = `# ${episodeLabel(episode)}\n\n`
  downloadText(header + body, `${episodeFileBase(episode)}.md`, 'text/markdown')
}

export async function exportEpisodeDocx(episode: Episode): Promise<void> {
  const text = episode.scriptText ?? ''
  const children: Paragraph[] = [
    new Paragraph({
      heading: 'Heading1',
      children: [new TextRun({ text: episodeLabel(episode), bold: true, size: 32 })],
    }),
  ]
  if (episode.synopsis.trim()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: episode.synopsis, italics: true })],
      }),
    )
  }
  for (const line of text.split(/\r?\n/)) {
    children.push(new Paragraph({ children: [new TextRun(line)] }))
  }
  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${episodeFileBase(episode)}.docx`)
}

export function exportEpisodePdf(episode: Episode): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const titleLines = doc.splitTextToSize(episodeLabel(episode), maxWidth)
  for (const line of titleLines) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += 8
  }
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const body = episode.scriptText ?? ''
  const lines = doc.splitTextToSize(body, maxWidth)
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += 6
  }
  doc.save(`${episodeFileBase(episode)}.pdf`)
}

/* ------------------------------------------------------------------ */
/* Importar                                                            */
/* ------------------------------------------------------------------ */

export type ImportedScript = {
  /** Texto plano del archivo. */
  text: string
  /** JSON de Tiptap reconstruido a partir del texto. */
  scriptJson: string
  /** Formato detectado por la extensión del archivo. */
  format: 'txt' | 'md' | 'docx'
}

/**
 * Lee un archivo de guion (.txt, .md o .docx) y devuelve su texto plano
 * y el JSON de Tiptap equivalente. El contenido actual del episodio se
 * sustituye por completo (la interfaz lo advierte antes de importar).
 */
export async function importScriptFile(file: File): Promise<ImportedScript> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.replace(/\r\n/g, '\n').trim()
    return { text, scriptJson: textToTiptapJson(text), format: 'docx' }
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    const text = (await file.text()).replace(/\r\n/g, '\n').trim()
    return { text, scriptJson: markdownToTiptapJson(text), format: 'md' }
  }
  if (name.endsWith('.txt')) {
    const text = (await file.text()).replace(/\r\n/g, '\n').trim()
    return { text, scriptJson: textToTiptapJson(text), format: 'txt' }
  }
  throw new Error('Formato no admitido. Usa un archivo .txt, .md o .docx.')
}
