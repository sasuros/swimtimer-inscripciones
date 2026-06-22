# SWIMTIMER · Inscripciones — Demo

Demo estática para gestionar inscripciones de clubes y nadadores en competencias de piscina. Incluye wizard protegido por token, panel del organizador y exportación compatible con Meet Manager 2.0. Todos los datos se guardan en `localStorage`; no usa backend, Functions ni base de datos.

La Fase 2 añade gestión completa de múltiples eventos, clonación, archivo, clubes y catálogo editable de 76 pruebas, junto con la identidad visual navy/dorado de SWIMTIMER.

## Desarrollo

```bash
npm install
npm run dev
```

La app queda disponible normalmente en `http://localhost:5173`. El panel está en `/admin/eventos`; desde allí se crean eventos y se generan los enlaces `/inscribir?t=TOKEN`.

## Rutas

- `/admin` y `/admin/eventos`: lista de eventos.
- `/admin/eventos/nuevo`: crear evento.
- `/admin/eventos/clonar/:id`: clonar configuración sin inscripciones.
- `/admin/eventos/:id`: dashboard de un evento.
- `/admin/eventos/:id/editar`: editar evento.
- `/inscribir?t=TOKEN`: wizard del entrenador.

## Acceso demo

La contraseña está definida en `src/config.js`: `swimtimer2025`. Al ser una demo client-side, no ofrece seguridad real y no debe usarse con información sensible.

Opcionalmente, `VITE_ALBERTO_WHATSAPP` define el WhatsApp predeterminado. Cada evento puede sobrescribirlo desde su editor.

Los tokens e inscripciones solo existen en el navegador donde fueron creados. Para la presentación, genera y abre los enlaces desde el mismo perfil del navegador.

## Comandos

- `npm run dev`: servidor Vite.
- `npm test`: pruebas de reglas de negocio.
- `npm run build`: build de producción.
- `npx netlify deploy --prod`: despliegue estático en Netlify.
- `npx vercel --prod`: despliegue estático en Vercel.

## Activar backend después

`src/config.js` exporta `DEMO_MODE = true`. Al cambiarlo a `false`, `src/services/api.js` usa los endpoints `/api` en lugar del adaptador local, sin modificar los hooks ni las pantallas.
