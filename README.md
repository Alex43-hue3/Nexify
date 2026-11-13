# NEXIFY

NEXIFY es una plataforma de catálogo y reproducción multimedia estática, diseñada para publicarse en **GitHub Pages**. El repositorio GitHub funciona como almacenamiento central del catálogo mediante un archivo JSON versionado. No necesita MySQL, PostgreSQL, Firebase, Supabase ni otro servicio de base de datos.

## Funciones incluidas

### Plataforma pública
- Catálogo independiente de películas, series y canales en vivo.
- Búsqueda por título, categoría y descripción.
- Filtros por categoría y orden alfabético / fecha.
- Favoritos por perfil y sección «Continue Watching».
- Perfiles locales (adulto e infantil), con selector y administración.
- Reproductor HTML5 para MP4 y HLS/M3U8, con HLS.js y soporte HLS nativo cuando está disponible.
- Inserciones de YouTube, Google Drive, Facebook e iframe autorizado.
- Reanudación local del punto de reproducción para videos HTML5.
- Diseño responsive conservando la interfaz visual de referencia.

### Panel administrativo
- Conexión con GitHub mediante token Fine-grained.
- Alta, edición y eliminación de contenido.
- Series con temporadas y episodios agrupados por temporada.
- Importación y exportación JSON.
- Búsqueda de la biblioteca y actualización desde GitHub.
- Estadísticas de películas, series, canales y total de elementos.
- Cada cambio se publica como un commit en el repositorio.

## Configuración inicial

### 1. Configurar el repositorio
1. Crea un repositorio en GitHub. Para un catálogo público en GitHub Pages, el repositorio debe ser público.
2. Sube el contenido de esta carpeta a la raíz del repositorio.
3. Abre `assets/config.js` y reemplaza:
   - `TU_USUARIO` por tu usuario u organización de GitHub.
   - `TU_REPOSITORIO` por el nombre exacto del repositorio.
   - `main` por la rama que usarás, si es diferente.
4. Conserva `catalogPath: "data/catalog.json"` salvo que decidas mover el archivo de catálogo.

Ejemplo:
```js
window.NEXIFY_CONFIG = {
  githubOwner: "miusuario",
  githubRepo: "nexify",
  githubBranch: "main",
  catalogPath: "data/catalog.json",
  rawBase: ""
};
```

### 2. Activar GitHub Pages
1. En GitHub abre **Settings → Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Selecciona `main` y la carpeta `/ (root)`.
4. Guarda y espera a que GitHub publique el sitio.
5. Abre la URL que GitHub Pages muestra en esa pantalla.

No es necesario compilar ni instalar dependencias. La aplicación utiliza JavaScript nativo y carga HLS.js desde CDN.

### 3. Crear el token para administrar el catálogo
1. En GitHub abre **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Crea un token limitado al repositorio NEXIFY.
3. En **Repository permissions**, asigna **Contents: Read and write**.
4. Copia el token y abre `/admin.html` en el sitio publicado.
5. Pega el token y pulsa **Conectar con GitHub**.

El token se guarda únicamente en `sessionStorage` durante la sesión actual del navegador. No se escribe en `assets/config.js`, en `catalog.json`, ni en ningún commit. Al cerrar la sesión o el navegador se elimina la sesión de administración.

**Importante:** un token con permiso de escritura equivale a una credencial sensible. No lo compartas, no lo incluyas en capturas ni lo pegues en archivos del proyecto. Para una operación administrativa de mayor seguridad, usa un equipo de confianza y revoca el token si sospechas que se expuso. El token puede ser leído por cualquier script que consiga ejecutarse en el mismo origen, por lo que conviene mantener el repositorio y el sitio libres de scripts de terceros innecesarios.

## Cómo administrar contenido

### Películas y canales
Selecciona el tipo, completa el título, categoría, URL de portada y fuente de reproducción. El enlace debe ser público y estar autorizado para reproducción externa. Pulsa **Publicar en GitHub**.

### Series
Selecciona «Serie», completa los datos generales y agrega un episodio indicando temporada, número, título y URL. Repite el proceso para incorporar más episodios. Los episodios con el mismo nombre de temporada se agrupan automáticamente.

### Fuentes compatibles
- **MP4 / video directo:** URL HTTPS a un archivo de video compatible con el navegador.
- **HLS / M3U8:** manifiesto HLS; se reproduce con HLS.js o soporte HLS nativo.
- **YouTube:** URL pública de video o enlace corto; se transforma a la inserción oficial.
- **Google Drive:** enlace compartido de archivo con permisos adecuados.
- **Facebook:** URL de inserción admitida por Facebook.
- **Iframe:** URL de inserción de un proveedor que permita mostrar su reproductor dentro de otros sitios.

La compatibilidad final depende del proveedor, CORS, permisos, cookies, políticas de inserción, códecs y restricciones del navegador. NEXIFY no elimina DRM ni restricciones de acceso.

## Estructura de datos

`data/catalog.json` es un arreglo JSON. Ejemplo de película:

```json
[
  {
    "id": "movie-001",
    "type": "movie",
    "title": "Ejemplo",
    "category": "Ciencia ficción",
    "description": "Descripción del contenido.",
    "image": "https://servidor.example/portada.jpg",
    "rating": 8.5,
    "year": 2026,
    "source": "hls",
    "url": "https://servidor.example/master.m3u8",
    "featured": true,
    "createdAt": "2026-11-13T12:00:00.000Z",
    "updatedAt": "2026-11-13T12:00:00.000Z"
  }
]
```

Una serie usa `type: "series"` y agrega `seasons`, cada una con `number`, `title` y una lista `episodes`. Cada episodio incluye `number`, `title`, `url` y `source`. Los canales usan `type: "channel"`.

## Almacenamiento y sincronización

- **Catálogo:** `data/catalog.json` en GitHub. Es la fuente compartida por todos los visitantes.
- **Cambios administrativos:** GitHub Contents API, con un commit por operación de publicación.
- **Favoritos, perfiles e historial de reproducción:** almacenamiento local del navegador. Son preferencias por dispositivo y no se sincronizan entre dispositivos.
- **Imágenes y videos:** deben alojarse en un CDN o proveedor de medios. No subas videos grandes al repositorio GitHub.

La página pública lee el archivo de catálogo desde `raw.githubusercontent.com`. Si GitHub no está configurado o no hay conexión, puede mostrar una copia local previamente guardada en ese navegador.

## Solución de problemas

- **No conecta el panel:** verifica `githubOwner`, `githubRepo`, rama, token y permiso `Contents: Read and write`.
- **404 al leer el catálogo:** comprueba que exista `data/catalog.json` en la rama configurada. El panel puede crear el archivo si todavía no existe.
- **El catálogo no se actualiza al instante:** GitHub Pages y la caché del navegador pueden tardar unos minutos; recarga la página después de publicar.
- **El video no reproduce:** abre el enlace directamente, comprueba que sea HTTPS, público y compatible; algunos servidores bloquean CORS o reproducción externa.
- **El iframe aparece vacío:** el proveedor puede prohibir la inserción mediante sus cabeceras de seguridad.

## Desarrollo local

Sirve la carpeta mediante un servidor estático (por ejemplo, VS Code Live Server). Para probar administración y sincronización necesitas configurar `assets/config.js` y un token de GitHub con permisos adecuados. Abrir el HTML mediante `file://` puede limitar solicitudes de red del navegador.

## Derechos y uso

Añade únicamente contenidos, portadas y enlaces que tengas derecho a distribuir o insertar. NEXIFY es una plataforma de catálogo y reproductor; no incluye películas, series ni señales de televisión licenciadas.
