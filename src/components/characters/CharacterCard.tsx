import { useEffect, useState } from 'react';
import { Copy, Trash2, User } from 'lucide-react';
import { db } from '../../db/db';
import { getCharacterMainImageUrlFor, type Character } from '../../lib/characters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

interface CharacterCardProps {
  character: Character;
  onSelect: (character: Character) => void;
  onDuplicate: (character: Character) => void;
  onDelete: (character: Character) => void;
}

export function CharacterCard({ character, onSelect, onDuplicate, onDelete }: CharacterCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCharacterMainImageUrlFor(db, character).then((url) => {
      if (!cancelled) setImageUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [character]);

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
      onClick={() => onSelect(character)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={character.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight">{character.name}</h3>
            <p className="text-sm text-muted-foreground">
              {character.age ? `${character.age} años · ` : ''}
              {character.species}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {character.role}
          </Badge>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => onDuplicate(character)}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Duplicar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(character)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
