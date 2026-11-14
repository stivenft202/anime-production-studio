import type { LoreEntry, TimelineEvent } from '../db/db'

/**
 * Datos semilla DEMO de lore (copia pública).
 *
 * 4 entradas de lore + 3 acontecimientos de la cronología, todos
 * INVENTADOS para demostrar el módulo de Universo y lore. No
 * pertenecen a ningún proyecto real.
 *
 * `characterNames` guarda NOMBRES de personajes: `seed.ts` los resuelve
 * a IDs consultando el mapa de personajes demo que se acaba de sembrar
 * (sin búsquedas por nombre en la base de datos). `episodeNumbers`
 * solo incluye episodios demo donde aparece la entrada.
 */

/** Entrada de lore semilla: como `LoreEntry` pero sin los campos generados y con nombres de personaje en vez de IDs. */
export type SeedLoreEntry = Omit<
  LoreEntry,
  'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'characterIds'
> & { characterNames: string[] }

/** Acontecimiento semilla: como `TimelineEvent` pero sin los campos generados y con nombres de personaje en vez de IDs. */
export type SeedTimelineEvent = Omit<
  TimelineEvent,
  'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'characterIds'
> & { characterNames: string[] }

export const seedLoreEntries: SeedLoreEntry[] = [
  {
    title: 'El Valle del Eco',
    type: 'misterio',
    description:
      'Un valle estrecho entre dos colinas, al norte de Puerto Bruma. Todo sonido que se hace en el valle vuelve repetido tres veces, cada vez más suave, como si las colinas contestaran. El eco tarda unos segundos en volver y nunca repite la última palabra.',
    history:
      'Los primeros cartógrafos de Puerto Bruma marcaron el valle en sus mapas con una nota: «Aquí el valle contesta». Nadie sabe por qué ocurre; Mara lo estudia desde su primera expedición.',
    features:
      'Quien grita el nombre de un lugar del valle escucha, en el tercer eco, el nombre de otro lugar cercano. Los viajeros usan el eco para orientarse cuando hay niebla.',
    rules:
      'Regla del valle: no se grita de noche. El eco nocturno suena distinto, más grave, y los viajeros dicen que no conviene escucharlo dos veces.',
    tags: ['valle', 'eco', 'misterio'],
    spoiler: false,
    characterNames: ['Mara', 'Nia'],
    locationNames: ['El Valle del Eco', 'Puerto Bruma'],
    episodeNumbers: [1, 2],
    imageAssetIds: [],
    orderIndex: 0,
  },
  {
    title: 'Las Luciérnagas de cristal',
    type: 'criatura',
    description:
      'Pequeños insectos luminosos del Bosque de los Susurros. Su luz es azul pálida y parpadea despacio, como si respiraran. De día duermen bajo las hojas; de noche salen en grupos y dibujan caminos de luz entre los árboles.',
    history:
      'Nia las descubrió la noche que llegó a Puerto Bruma: siguió su luz hasta salir del bosque. Desde entonces las dibuja en su libreta y distingue el canto de cada grupo.',
    features:
      'Su luz se vuelve más intensa cuando hay luna llena. Si una luciérnaga se posa en la mano de alguien, dicen que esa persona tendrá buena suerte en su próximo viaje.',
    rules:
      'No se las atrapa ni se las guarda en frascos: sin el aire del bosque, su luz se apaga en minutos y no vuelve a encenderse.',
    tags: ['luciérnaga', 'bosque', 'criatura'],
    spoiler: false,
    characterNames: ['Nia', 'Mara'],
    locationNames: ['Bosque de los Susurros'],
    episodeNumbers: [1, 3],
    imageAssetIds: [],
    orderIndex: 1,
  },
  {
    title: 'El Gremio de Cartógrafos',
    type: 'organizacion',
    description:
      'El gremio de quienes dibujan los mapas de la costa. Tiene su sede en una casa vieja junto al Mercado de las Telas, en Puerto Bruma. Sus mapas se reconocen por una pequeña brújula dibujada en la esquina inferior.',
    history:
      'Lo fundaron tres cartógrafos hace 60 años, cuando los barcos empezaron a perderse entre las mareas. Hoy lo forman una docena de miembros; Mara es la más joven en tener su propio sello.',
    features:
      'Cada miembro guarda un cuaderno de campo con sus rutas. Los cuadernos viejos se heredan: el de Mara fue de su madre, vendedora de mapas.',
    rules:
      'Regla del gremio: un mapa nunca se vende sin haber recorrido el camino al menos dos veces. Quien rompe la regla pierde su sello.',
    tags: ['gremio', 'cartografía', 'Puerto Bruma'],
    spoiler: false,
    characterNames: ['Mara', 'Dario'],
    locationNames: ['Puerto Bruma', 'Mercado de las Telas'],
    episodeNumbers: [1],
    imageAssetIds: [],
    orderIndex: 2,
  },
  {
    title: 'La Marea de Cristal',
    type: 'acontecimiento',
    description:
      'Una vez al año, la marea baja deja al descubierto una franja de arena brillante en la costa de Puerto Bruma. La arena refleja la luz como si fuera cristal molido y el mar se ve de un azul distinto durante un día entero.',
    history:
      'La primera Marea de Cristal que se recuerda ocurrió hace 120 años, el mismo año en que se fundó Puerto Bruma. Desde entonces los pescadores la usan para marcar el inicio de la temporada.',
    features:
      'Durante la marea, el Faro de Coral se ve desde el doble de distancia. Corvo dice que es el mejor día del año para salir a navegar.',
    rules: '',
    tags: ['marea', 'costa', 'Puerto Bruma'],
    spoiler: false,
    characterNames: ['Corvo', 'Elia'],
    locationNames: ['Puerto Bruma', 'Faro de Coral'],
    episodeNumbers: [2, 3],
    imageAssetIds: [],
    orderIndex: 3,
  },
]

export const seedTimelineEvents: SeedTimelineEvent[] = [
  {
    title: 'Fundación de Puerto Bruma',
    fictionalDate: 'Hace 120 años',
    era: 'Antes del presente',
    description:
      'Un grupo de pescadores y comerciantes levanta las primeras casas junto al puerto, en la desembocadura del río. La primera Marea de Cristal marca el inicio del asentamiento.',
    consequences:
      'Puerto Bruma se convierte en el puerto principal de la costa y en la sede del Gremio de Cartógrafos.',
    spoiler: false,
    characterNames: [],
    locationNames: ['Puerto Bruma'],
    imageAssetIds: [],
    orderIndex: 0,
  },
  {
    title: 'La noche de las luciérnagas',
    fictionalDate: 'Hace 3 años',
    era: 'Antes del presente',
    description:
      'Durante una noche de luna llena, las luciérnagas de cristal salen en un grupo más grande que nunca y dibujan un camino de luz hasta la salida del Bosque de los Susurros. Nia, recién llegada a Puerto Bruma, sigue su luz hasta salir del bosque.',
    consequences:
      'Nia conoce a Mara, que la encuentra dibujando el bosque de memoria, y se convierte en su aprendiz.',
    spoiler: false,
    characterNames: ['Nia', 'Mara'],
    locationNames: ['Bosque de los Susurros', 'Puerto Bruma'],
    imageAssetIds: [],
    orderIndex: 1,
  },
  {
    title: 'Mara llega al Valle del Eco',
    fictionalDate: 'Presente',
    era: 'Presente',
    description:
      'Mara, Dario y Nia parten de Puerto Bruma para completar el primer mapa del Valle del Eco. En el camino, el eco del valle les devuelve un nombre que ninguno de ellos había gritado.',
    consequences:
      'El grupo decide seguir el eco valle adentro: empieza la historia del proyecto de ejemplo.',
    spoiler: false,
    characterNames: ['Mara', 'Dario', 'Nia'],
    locationNames: ['El Valle del Eco', 'Puerto Bruma'],
    imageAssetIds: [],
    orderIndex: 2,
  },
]
