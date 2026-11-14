import {
  BookOpen,
  Clapperboard,
  FolderKanban,
  Home,
  Image,
  Lightbulb,
  MapPin,
  Mic,
  Rocket,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { SectionId } from '../store/appStore'

export interface SectionMeta {
  id: SectionId
  label: string
  icon: LucideIcon
  /** Fase en la que llega la sección; null = ya existe en la fase 1. */
  phase: number | null
}

export const SECTIONS: SectionMeta[] = [
  { id: 'inicio', label: 'Inicio', icon: Home, phase: null },
  { id: 'proyectos', label: 'Proyectos', icon: FolderKanban, phase: null },
  { id: 'personajes', label: 'Personajes', icon: Users, phase: null },
  { id: 'lore', label: 'Lore', icon: BookOpen, phase: null },
  { id: 'guiones', label: 'Guiones', icon: ScrollText, phase: null },
  { id: 'prompts', label: 'Prompts', icon: Lightbulb, phase: null },
  { id: 'referencias', label: 'Referencias', icon: Image, phase: null },
  { id: 'lugares', label: 'Lugares', icon: MapPin, phase: 5 },
  { id: 'voces', label: 'Voces', icon: Mic, phase: 5 },
  { id: 'publicacion', label: 'Publicación', icon: Rocket, phase: 6 },
  { id: 'equipo', label: 'Equipo', icon: UserCog, phase: 7 },
  { id: 'configuracion', label: 'Configuración', icon: Settings, phase: null },
]

/** Icono decorativo de la marca (no es una sección). */
export const BrandIcon = Clapperboard
