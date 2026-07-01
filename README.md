# SWIMTIMER · Inscripciones

Aplicación React + Vite para administrar eventos de natación, distribuir enlaces por club y recibir inscripciones compatibles con Meet Manager. Usa Supabase en producción y conserva un modo demo completo con `localStorage` para desarrollo sin backend.

## Desarrollo

```bash
npm install
npm run dev
```

La app queda disponible normalmente en `http://localhost:5173`. Sin `VITE_SUPABASE_URL`, activa automáticamente el modo demo. El panel está en `/admin/eventos` y la contraseña predeterminada es `swimtimer2025`.

## Configurar Supabase (producción)

1. Crear un proyecto en [supabase.com](https://supabase.com) con el plan gratuito.
2. Abrir **SQL Editor → New query**.
3. Copiar y ejecutar todo el contenido de `supabase/schema.sql` una sola vez.
4. Copiar **Project URL** y **anon key** desde **Settings → API**.
5. Agregar en **Vercel → Project → Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`: URL del proyecto.
   - `VITE_SUPABASE_ANON_KEY`: clave pública anon.
   - `VITE_ADMIN_PASSWORD`: contraseña del panel.
   - `VITE_ALBERTO_WHATSAPP`: número con código de país, sin `+`.
   - `RESEND_API_KEY`: clave privada de Resend, sin prefijo `VITE_`.
6. Hacer redeploy en Vercel para que Vite compile con esas variables.

Sin las variables de Supabase, la app funciona en modo demo con `localStorage`. Con ellas, eventos, clubes, tokens e inscripciones se guardan en Supabase y aparecen en el dashboard al pulsar **Actualizar** o recargar la página.

### Seguridad de esta fase

El schema deshabilita RLS y usa la anon key para persistencia, tal como requiere la Fase 5. La contraseña del administrador es una barrera de interfaz, no autenticación de base de datos. No usar esta configuración para información sensible; una fase posterior debe incorporar Supabase Auth y políticas RLS.

## Tokens y contingencia

Los enlaces usan tokens v2 autocontenidos con evento, club y pruebas compactadas. También se registran en Supabase mediante un hash SHA-256, mientras el token completo se conserva fuera del índice.

El wizard puede abrir el token aunque Supabase no esté disponible. Si falla el envío, descarga automáticamente el JSON y muestra el botón para avisar al organizador por WhatsApp. El respaldo JSON también queda disponible después de un envío correcto.

## Invitaciones por correo

Para una instalación existente, ejecuta una vez `supabase/migration_email.sql` en **Supabase → SQL Editor** y vuelve a desplegar Vercel. El editor permite asignar un correo a cada club; el dashboard genera enlaces mágicos v3, envía mediante la función `api/send-invitation.js` y registra éxito o error por club.

Los enlaces de correo se pueden reenviar o revocar sin modificar los tokens v2 usados por Copiar y WhatsApp. En modo demo no se llama a Resend y la interfaz indica que deben usarse los enlaces v2.

## Rutas

- `/admin` y `/admin/eventos`: lista de eventos.
- `/admin/eventos/nuevo`: crear evento.
- `/admin/eventos/importar`: importar configuración desde Meet Manager.
- `/admin/eventos/clonar/:id`: clonar configuración sin inscripciones.
- `/admin/eventos/:id`: dashboard de un evento.
- `/admin/eventos/:id/editar`: editar evento.
- `/inscribir?t=TOKEN`: wizard del entrenador.

## Flujo Meet Manager

Desde **Mis eventos → Importar desde Meet Manager**, carga el JSON generado desde el MDB. El dashboard permite descargar el consolidado principal, el consolidado completo y el suplemento de tardías aprobadas.

## Comandos

- `npm run dev`: servidor Vite.
- `npm test`: pruebas de reglas de negocio y adaptadores.
- `npm run build`: build de producción.
- `npx vercel --prod`: despliegue en Vercel.
