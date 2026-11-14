/**
 * Registro de los 3 episodios DEMO del proyecto de ejemplo
 * (copia pública). Episodios INVENTADOS para demostrar el módulo de
 * guiones y episodios. Todos llevan título; `places` y `characters`
 * usan solo lugares y personajes demo.
 */

export type SeedEpisode = {
  number: number;
  title: string;
  places: string[];
  characters: string[];
};

export const seedEpisodes: SeedEpisode[] = [
  {
    number: 1,
    title: 'La llegada al valle',
    places: ['Puerto Bruma', 'El Valle del Eco', 'Mercado de las Telas'],
    characters: ['Mara', 'Dario', 'Nia'],
  },
  {
    number: 2,
    title: 'El canto de las luciérnagas',
    places: ['Bosque de los Susurros', 'Faro de Coral'],
    characters: ['Mara', 'Nia', 'Elia'],
  },
  {
    number: 3,
    title: 'La Marea de Cristal',
    places: ['Puerto Bruma', 'Torre de los Vientos'],
    characters: ['Mara', 'Dario', 'Corvo', 'Elia'],
  },
];
