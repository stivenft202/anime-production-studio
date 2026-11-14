/**
 * Datos semilla DEMO de personajes (copia pública).
 *
 * 5 personajes INVENTADOS para demostrar la aplicación. No pertenecen
 * a ningún proyecto real: son datos de ejemplo y así se indica en el
 * proyecto demo («Proyecto de ejemplo»).
 *
 * Cada entrada es un objeto de personaje SIN `id` (Dexie lo genera al
 * insertar) y con `imageFile`, el retrato placeholder en `public/demo/`
 * que se importa como imagen principal al sembrar el proyecto.
 * Los retratos son placeholders generados (fondo de color plano +
 * inicial del personaje), sin arte real.
 */

export type SeedCharacter = {
  name: string;
  internalId: string;
  age: number;
  species: string;
  occupation: string;
  role: string;
  description: string;
  personality: string;
  biography: string;
  hair: string;
  hairColor: string;
  eyes: string;
  eyeColorHex: string;
  height: number;
  build: string;
  skin: string;
  distinctiveFeatures: string;
  clothing: string;
  voiceLanguage: string;
  voiceTone: string;
  vocalAge: string;
  accent: string;
  performanceNotes: string;
  imageFile: string;
  /**
   * Imágenes adicionales de galería (además de la principal `imageFile`).
   * `file` es el nombre del archivo en `public/demo/`; `category` usa
   * las mismas categorías de `CharacterImageCategory` ('rostro' |
   * 'cuerpo' | 'vestimenta' | 'expresiones' | 'poses' | 'alternativos' |
   * 'otro'). Los personajes demo no tienen imágenes adicionales.
   */
  extraImages?: { file: string; category: string }[];
};

export const seedCharacters: SeedCharacter[] = [
  {
    name: 'Mara',
    internalId: 'mara',
    age: 28,
    species: 'Humano',
    occupation: 'Exploradora y cartógrafa',
    role: 'Protagonista',
    description:
      'Cartógrafa de Puerto Bruma. Conoce el Valle del Eco como nadie y dibuja los mapas que usan los viajeros de la costa. Su lema es «Todo camino empieza con un mapa».',
    personality:
      'Curiosa, tenaz y algo cabezota. No deja un mapa a medias. Le cuesta pedir ayuda, pero nunca abandona a un compañero en el camino.',
    biography:
      'Nació en Puerto Bruma, hija de una pescadora y un vendedor de mapas. De niña se perdía por el mercado copiando los planos de los barcos; a los 16 años hizo su primer mapa del Valle del Eco y desde entonces no ha parado de explorar la costa.',
    hair: 'Castaño, recogido en una trenza',
    hairColor: '#6B4226',
    eyes: 'Verdes',
    eyeColorHex: '#4E7A51',
    height: 167,
    build: 'Atlética',
    skin: 'Morena clara',
    distinctiveFeatures: 'Peca en la mejilla izquierda, siempre lleva un lápiz tras la oreja',
    clothing: 'Chaqueta verde oliva, pantalón marrón, botas de cuero',
    voiceLanguage: 'Español',
    voiceTone: 'Clara y decidida, con energía',
    vocalAge: 'Joven adulta',
    accent: 'Latinoamericano neutro',
    performanceNotes:
      'Habla rápido cuando describe un lugar nuevo; hace pausas cortas para mirar su mapa antes de seguir.',
    imageFile: 'mara.png',
  },
  {
    name: 'Dario',
    internalId: 'dario',
    age: 34,
    species: 'Humano',
    occupation: 'Herrero y mecánico',
    role: 'Aliado de Mara',
    description:
      'Herrero de Puerto Bruma. Repara desde herramientas de pesca hasta brújulas rotas, y acompaña a Mara en sus expediciones como apoyo y amigo.',
    personality:
      'Paciente, bromista y leal. Prefiere resolver las cosas con las manos antes que con palabras. Su risa se escucha desde el otro lado del mercado.',
    biography:
      'Aprendió el oficio en la fragua de su padre, junto al puerto. Conoció a Mara cuando ella le llevó una brújula rota que nadie más sabía arreglar; desde entonces trabajan juntos.',
    hair: 'Negro, corto, con barba poblada',
    hairColor: '#2B2118',
    eyes: 'Marrones',
    eyeColorHex: '#6B4226',
    height: 181,
    build: 'Robusta',
    skin: 'Morena',
    distinctiveFeatures: 'Barba poblada, cicatriz pequeña en la mano izquierda',
    clothing: 'Delantal de cuero, camisa gris, pantalón de trabajo',
    voiceLanguage: 'Español',
    voiceTone: 'Grave y pausado, voz tranquila',
    vocalAge: 'Adulto',
    accent: 'Latinoamericano neutro',
    performanceNotes:
      'Habla despacio y con peso; cuando se ríe, la frase siguiente siempre es un chiste.',
    imageFile: 'dario.png',
  },
  {
    name: 'Nia',
    internalId: 'nia',
    age: 19,
    species: 'Humano',
    occupation: 'Aprendiz de cartógrafa',
    role: 'Protagonista',
    description:
      'Aprendiz de Mara. Joven, entusiasta y con un oído fino: distingue el canto de cada luciérnaga de cristal del Bosque de los Susurros.',
    personality:
      'Entusiasta, preguntón y valiente. Se emociona con cada descubrimiento y anota todo en su libreta, hasta lo que no entiende.',
    biography:
      'Llegó a Puerto Bruma con su familia hace tres años, durante la noche de las luciérnagas. Mara la encontró dibujando el bosque de memoria y la tomó como aprendiz.',
    hair: 'Oscuro y rizado, hasta los hombros',
    hairColor: '#3A2A1A',
    eyes: 'Ámbar',
    eyeColorHex: '#C98A2E',
    height: 160,
    build: 'Delgada',
    skin: 'Clara',
    distinctiveFeatures: 'Libreta de bocetos siempre en la mano',
    clothing: 'Túnica beige, pantalón gris, sandalias',
    voiceLanguage: 'Español',
    voiceTone: 'Aguda y alegre, energía contagiosa',
    vocalAge: 'Joven',
    accent: 'Latinoamericano neutro',
    performanceNotes:
      'Ritmo rápido y entonación ascendente; su voz se ilumina cuando descubre algo nuevo.',
    imageFile: 'nia.png',
  },
  {
    name: 'Corvo',
    internalId: 'corvo',
    age: 41,
    species: 'Humano',
    occupation: 'Capitán de barco',
    role: 'Aliado ocasional de Mara',
    description:
      'Capitán del barco «La Gaviota». Lleva viajeros y cartas entre Puerto Bruma y el Faro de Coral; conoce las mareas mejor que nadie en la costa.',
    personality:
      'Serio en el mar y bromista en tierra. Desconfía de los extraños, pero una vez que alguien se gana su respeto, lo lleva a donde haga falta.',
    biography:
      'Navega desde los 14 años. Heredó «La Gaviota» de su abuela, que fue la primera capitana de Puerto Bruma. Ha cruzado la Marea de Cristal dos veces y cuenta que la segunda casi no vuelve.',
    hair: 'Gris, corto, con el pelo recogido atrás',
    hairColor: '#8A8A8A',
    eyes: 'Grises',
    eyeColorHex: '#5A6B7A',
    height: 178,
    build: 'Robusta',
    skin: 'Curtida por el sol y el mar',
    distinctiveFeatures: 'Cicatriz en la ceja derecha, tatuaje de gaviota en el antebrazo',
    clothing: 'Chaqueta azul marino, camisa blanca, botas altas',
    voiceLanguage: 'Español',
    voiceTone: 'Firme y enérgico, voz de mando',
    vocalAge: 'Adulto',
    accent: 'Latinoamericano neutro',
    performanceNotes:
      'Da las órdenes en frases cortas; en tierra baja la voz y habla como si contara un cuento.',
    imageFile: 'corvo.png',
  },
  {
    name: 'Elia',
    internalId: 'elia',
    age: 62,
    species: 'Humano',
    occupation: 'Guardiana del faro',
    role: 'Mentora de Nia',
    description:
      'Guardiana del Faro de Coral desde hace 30 años. Conoce las historias de la costa y enseña a Nia a leer el cielo y las mareas.',
    personality:
      'Cálida, paciente y observadora. Escucha más de lo que habla y cuando habla, todos la escuchan. Tiene un chiste para cada tormenta.',
    biography:
      'Llegó al faro de joven, huyendo de una vida en la ciudad. Aprendió a cuidar la luz del faro de la guardiana anterior y nunca se fue. Es la memoria viva de Puerto Bruma.',
    hair: 'Blanco, recogido en un moño',
    hairColor: '#E8E8E8',
    eyes: 'Grises',
    eyeColorHex: '#7A7A7A',
    height: 165,
    build: 'Delgada',
    skin: 'Clara',
    distinctiveFeatures: 'Gafas redondas, chal de lana siempre puesto',
    clothing: 'Vestido gris, chal de lana azul, zapatos cómodos',
    voiceLanguage: 'Español',
    voiceTone: 'Suave y pausada, voz cálida',
    vocalAge: 'Mayor',
    accent: 'Latinoamericano neutro',
    performanceNotes:
      'Habla despacio, con pausas largas; cada historia empieza con «En mis tiempos…».',
    imageFile: 'elia.png',
  },
];
