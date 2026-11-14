import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import {
  newId,
  now,
  tables,
  type Character,
  type CharacterInput,
} from '../../lib/characters';
import { Button } from '../ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Textarea } from '../ui/Textarea';

const EMPTY_FORM: CharacterInput = {
  name: '',
  internalId: '',
  age: 0,
  species: 'Humano',
  occupation: '',
  role: 'Protagonista',
  description: '',
  personality: '',
  biography: '',
  hair: '',
  hairColor: '#111111',
  eyes: '',
  eyeColorHex: '#3B2F2F',
  height: 0,
  build: '',
  skin: '',
  distinctiveFeatures: '',
  clothing: '',
  voiceActorId: undefined,
  voiceLanguage: 'Español',
  voiceTone: '',
  vocalAge: '',
  accent: 'Latinoamericano neutro',
  performanceNotes: '',
};

interface CharacterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Si se pasa, el formulario edita; si no, crea un personaje nuevo. */
  character?: Character | null;
  onSaved?: (id: string) => void;
}

export function CharacterForm({
  open,
  onOpenChange,
  projectId,
  character,
  onSaved,
}: CharacterFormProps) {
  const [form, setForm] = useState<CharacterInput>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicia el formulario cada vez que se abre el diálogo.
  useEffect(() => {
    if (!open) return;
    if (character) {
      setForm({
        name: character.name,
        internalId: character.internalId,
        age: character.age,
        species: character.species,
        occupation: character.occupation,
        role: character.role,
        description: character.description,
        personality: character.personality,
        biography: character.biography,
        hair: character.hair,
        hairColor: character.hairColor,
        eyes: character.eyes,
        eyeColorHex: character.eyeColorHex,
        height: character.height,
        build: character.build,
        skin: character.skin,
        distinctiveFeatures: character.distinctiveFeatures,
        clothing: character.clothing,
        voiceActorId: character.voiceActorId,
        voiceLanguage: character.voiceLanguage,
        voiceTone: character.voiceTone,
        vocalAge: character.vocalAge,
        accent: character.accent,
        performanceNotes: character.performanceNotes,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setNameError(null);
  }, [open, character]);

  const set = <K extends keyof CharacterInput>(key: K, value: CharacterInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError('El nombre es obligatorio.');
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const payload: CharacterInput = {
        ...form,
        name: form.name.trim(),
        internalId: form.internalId.trim(),
        voiceActorId: form.voiceActorId?.trim() || undefined,
      };
      if (character) {
        await tables(db).characters.update(character.id, { ...payload, updatedAt: now() });
        onSaved?.(character.id);
      } else {
        const id = newId();
        const timestamp = now();
        await tables(db).characters.add({
          ...payload,
          id,
          projectId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        onSaved?.(id);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{character ? `Editar: ${character.name}` : 'Nuevo personaje'}</DialogTitle>
          <DialogDescription>
            {character
              ? 'Modifica la información del personaje.'
              : 'Crea un personaje para el proyecto activo.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
            <TabsTrigger value="voz">Voz</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="char-name">Nombre *</Label>
              <Input
                id="char-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Mara"
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="char-internal-id">ID interno</Label>
                <Input
                  id="char-internal-id"
                  value={form.internalId}
                  onChange={(e) => set('internalId', e.target.value)}
                  placeholder="mara"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-age">Edad</Label>
                <Input
                  id="char-age"
                  type="number"
                  min={0}
                  value={form.age || ''}
                  onChange={(e) => set('age', Number(e.target.value) || 0)}
                  placeholder="25"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="char-species">Especie</Label>
                <Input
                  id="char-species"
                  value={form.species}
                  onChange={(e) => set('species', e.target.value)}
                  placeholder="Humano"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-role">Rol</Label>
                <Input
                  id="char-role"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  placeholder="Protagonista"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-occupation">Ocupación</Label>
              <Input
                id="char-occupation"
                value={form.occupation}
                onChange={(e) => set('occupation', e.target.value)}
                placeholder="Guardiana del faro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-description">Descripción</Label>
              <Textarea
                id="char-description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Resumen del personaje…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-personality">Personalidad</Label>
              <Textarea
                id="char-personality"
                value={form.personality}
                onChange={(e) => set('personality', e.target.value)}
                placeholder="Seria, determinada, protectora…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-biography">Biografía</Label>
              <Textarea
                id="char-biography"
                value={form.biography}
                onChange={(e) => set('biography', e.target.value)}
                placeholder="Historia del personaje…"
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="apariencia" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="char-hair">Pelo</Label>
                <Input
                  id="char-hair"
                  value={form.hair}
                  onChange={(e) => set('hair', e.target.value)}
                  placeholder="Negro, largo y liso"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-eyes">Ojos</Label>
                <Input
                  id="char-eyes"
                  value={form.eyes}
                  onChange={(e) => set('eyes', e.target.value)}
                  placeholder="Oscuros"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                label="Color de pelo"
                value={form.hairColor}
                onChange={(v) => set('hairColor', v)}
              />
              <ColorField
                label="Color de ojos (hex)"
                value={form.eyeColorHex}
                onChange={(v) => set('eyeColorHex', v)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="char-height">Estatura (cm)</Label>
                <Input
                  id="char-height"
                  type="number"
                  min={0}
                  value={form.height || ''}
                  onChange={(e) => set('height', Number(e.target.value) || 0)}
                  placeholder="168"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-build">Complexión</Label>
                <Input
                  id="char-build"
                  value={form.build}
                  onChange={(e) => set('build', e.target.value)}
                  placeholder="Atlética"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-skin">Piel</Label>
                <Input
                  id="char-skin"
                  value={form.skin}
                  onChange={(e) => set('skin', e.target.value)}
                  placeholder="Clara"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-features">Rasgos distintivos</Label>
              <Textarea
                id="char-features"
                value={form.distinctiveFeatures}
                onChange={(e) => set('distinctiveFeatures', e.target.value)}
                placeholder="Cicatriz leve, capa oscura…"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-clothing">Vestimenta</Label>
              <Textarea
                id="char-clothing"
                value={form.clothing}
                onChange={(e) => set('clothing', e.target.value)}
                placeholder="Armadura oscura con capa"
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="voz" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="char-voice-actor">ID de actor de voz (opcional)</Label>
              <Input
                id="char-voice-actor"
                value={form.voiceActorId ?? ''}
                onChange={(e) => set('voiceActorId', e.target.value)}
                placeholder="Se completará con el módulo de voces (fase 5)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="char-voice-lang">Idioma de voz</Label>
                <Input
                  id="char-voice-lang"
                  value={form.voiceLanguage}
                  onChange={(e) => set('voiceLanguage', e.target.value)}
                  placeholder="Español"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-accent">Acento</Label>
                <Input
                  id="char-accent"
                  value={form.accent}
                  onChange={(e) => set('accent', e.target.value)}
                  placeholder="Latinoamericano neutro"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="char-voice-tone">Tono de voz</Label>
                <Input
                  id="char-voice-tone"
                  value={form.voiceTone}
                  onChange={(e) => set('voiceTone', e.target.value)}
                  placeholder="Serio y firme"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-vocal-age">Edad vocal</Label>
                <Input
                  id="char-vocal-age"
                  value={form.vocalAge}
                  onChange={(e) => set('vocalAge', e.target.value)}
                  placeholder="Joven adulta"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-performance">Notas de interpretación</Label>
              <Textarea
                id="char-performance"
                value={form.performanceNotes}
                onChange={(e) => set('performanceNotes', e.target.value)}
                placeholder="Cómo debe sonar el personaje…"
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Selector de color: input de color + campo de texto hex sincronizados. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colorValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer p-1"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono"
        />
      </div>
    </div>
  );
}
