# SWIMTIMER · Inscripciones

Aplicación web para gestionar inscripciones de clubes y nadadores en competencias de piscina. Incluye un wizard público protegido por token, panel del organizador, exportación compatible con Meet Manager 2.0 y persistencia en Netlify Blobs.

## Desarrollo

```bash
npm install
npm run dev
```

`npm run dev` levanta la interfaz con Vite. Para probar también las Netlify Functions y Blobs localmente:

```bash
npx netlify dev
```

La app queda disponible normalmente en `http://localhost:8888`. El panel está en `/admin`; desde allí se generan los enlaces `/inscribir?t=TOKEN`.

## Variables de entorno

Copia `.env.example` como `.env` para desarrollo local o configura estas variables en **Netlify → Site configuration → Environment variables**:

- `ADMIN_PASSWORD`: contraseña del panel del organizador.
- `ADMIN_SECRET`: secreto largo y aleatorio usado para firmar sesiones de administración.
- `ALBERTO_WHATSAPP`: número en formato internacional, solo dígitos, por ejemplo `584121234567`.
- `URL`: URL pública del sitio. Netlify también proporciona esta variable automáticamente.

## Comandos

- `npm run dev`: servidor Vite.
- `npm test`: pruebas de reglas de negocio.
- `npm run build`: build de producción.
- `npx netlify deploy --prod`: despliegue manual después de vincular el sitio.

## Almacenamiento

Netlify Blobs usa el store `swimtimer` con claves `tokens:{token}`, `inscriptions:{clubCode}` e índices explícitos para las vistas administrativas. En desarrollo, `netlify dev` mantiene un sandbox local dentro de `.netlify/`.
