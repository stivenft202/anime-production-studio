# Configurar Supabase (opcional, plan gratis)

Supabase es la nube opcional de Anime Production Studio: base de datos,
autenticación y almacenamiento de archivos. **Sin configurar, la app
funciona completa en local.** Esta guía solo hace falta si quieres
sincronizar en la nube (fases futuras).

## 1. Crear la cuenta y el proyecto

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta
   (puedes entrar con GitHub o con email).
2. Pulsa **New project**.
3. Elige un nombre (por ejemplo, `anime-production-studio`), una
   contraseña para la base de datos (guárdala) y la región más cercana.
4. El plan **Free** es suficiente para empezar. Espera a que el proyecto
   se cree (1-2 minutos).

## 2. Ejecutar la migración (crear las tablas)

1. En el panel de tu proyecto, abre **SQL Editor** (menú izquierdo).
2. Pulsa **New query**.
3. Copia TODO el contenido del archivo
   `supabase/migrations/0001_init.sql` de este proyecto y pégalo en el
   editor.
4. Pulsa **Run**. Si no hay errores, se crean:
   - Las 27 tablas (usuarios, organizaciones, proyectos, temporadas,
     episodios, escenas, planos, diálogos, personajes, vestimentas,
     relaciones, lore, cronología, lugares, objetos, prompts, assets,
     etiquetas, actores de voz, asignaciones, grabaciones, publicaciones
     y backups).
   - Índices, trigger de `updated_at` y seguridad a nivel de fila (RLS).
   - Los buckets privados `assets` y `backups` en Storage.

Puedes volver a ejecutar el archivo: está escrito para no duplicar
objetos si ya existen.

## 3. Confirmar los buckets

1. Abre **Storage** (menú izquierdo).
2. Deben aparecer los buckets **`assets`** y **`backups`**, ambos
   **privados** (sin el icono de «público»).
3. Si falta alguno, créalo a mano con ese mismo nombre y sin marcar
   «Public bucket».

## 4. Copiar la URL y la anon key

1. Abre **Settings** (abajo a la izquierda) → **API**.
2. Copia:
   - **Project URL** (algo como `https://xxxxxxxxxxxx.supabase.co`).
   - **anon public** (la clave `anon`, empieza por `eyJ…`).
3. **No copies la `service_role` key.** Es secreta y la app la rechaza:
   con esa clave cualquiera podría leer y borrar todos los datos.

## 5. Pegarlas en la app

1. Abre Anime Production Studio → **Configuración** → sección
   **Supabase**.
2. Pega la **URL del proyecto** y la **anon key**.
3. Pulsa **Guardar** y luego **Probar conexión**.
4. Si el test dice «Conexión correcta», verás el estado
   **«Conectado a Supabase»**. Si dice que falta la migración, repite
   el paso 2.

Para volver al modo local, pulsa **Desconectar**: la configuración se
borra y todo sigue funcionando en tu equipo.

## Notas sobre seguridad (RLS)

- Todas las tablas tienen **Row Level Security** activado.
- Un usuario solo ve los proyectos de las organizaciones a las que
  pertenece (tabla `organization_members`).
- La `service_role key` ignora el RLS por diseño de Supabase: por eso
  **nunca** se usa en la aplicación; solo viviría en un servidor, si
  hiciera falta en el futuro.
- Los buckets son privados; las políticas de Storage permiten el acceso
  solo a usuarios autenticados. En la Fase 7 se restringirán por
  organización y carpeta.

## Solución de problemas

| Mensaje | Qué hacer |
|---|---|
| «Supabase no está configurado» | Falta pegar la URL y la anon key en Configuración. |
| «No se pudo contactar con el servidor» | Revisa la URL (debe ser `https://…supabase.co`) y tu conexión. |
| «La anon key no es válida» | Cópiala de nuevo desde Settings → API (la `anon`, no la `service_role`). |
| «Falta ejecutar la migración» | Ejecuta `0001_init.sql` en el SQL Editor (paso 2). |
| «No se pudo guardar la configuración» | En Electron, revisa que la app tenga permisos de escritura; en web, revisa el almacenamiento del navegador. |
