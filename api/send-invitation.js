import { Resend } from 'resend'

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character])

export function generateEmailHTML(invitation) {
  const inv = Object.fromEntries(Object.entries(invitation).map(([key, value]) => [key, escapeHtml(value)]))
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px"><tr><td style="background:#1B3A5C;padding:24px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:2px">SWIMTIMER</h1><p style="color:#8BAAC4;margin:4px 0 0;font-size:13px">Inscripciones by Scanleads</p></td></tr>
<tr><td style="background:#fff;padding:32px 24px;border-radius:0 0 8px 8px"><h2 style="color:#2C3E50;margin:0 0 8px;font-size:20px">Invitación para inscribir nadadores</h2><p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">Ha sido invitado a inscribir los nadadores de <strong style="color:#1B3A5C">${inv.clubName}</strong> en el siguiente evento:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;margin:0 0 24px"><tr><td style="padding:16px 20px"><p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#2C3E50">${inv.eventName}</p><p style="margin:0 0 2px;font-size:14px;color:#6B7280">Fecha: ${inv.eventDate}</p><p style="margin:0 0 2px;font-size:14px;color:#6B7280">Sede: ${inv.venue || 'Por confirmar'}</p>${inv.deadline ? `<p style="margin:0;font-size:14px;color:#D97706">Fecha límite: ${inv.deadline}</p>` : ''}</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding:8px 0 24px"><a href="${inv.magicLink}" style="display:inline-block;background:#047857;color:#fff;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:.5px">INSCRIBIR NADADORES</a></td></tr></table>
<p style="color:#6B7280;font-size:13px;line-height:1.5;margin:0 0 8px">Este enlace es exclusivo para <strong>${inv.email}</strong>. No lo comparta con otras personas.</p><p style="color:#6B7280;font-size:13px;line-height:1.5;margin:0">Si tiene problemas para acceder, contacte al organizador del evento.</p><hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0 16px"><p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0">SWIMTIMER · Inscripciones by Scanleads</p></td></tr></table></body></html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  const { password, invitations } = req.body || {}
  const adminPassword = process.env.VITE_ADMIN_PASSWORD || 'swimtimer2025'
  if (password !== adminPassword) return res.status(401).json({ error: 'No autorizado' })
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Resend no está configurado' })
  if (!Array.isArray(invitations) || !invitations.length) return res.status(400).json({ error: 'No hay invitaciones para enviar' })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results = []
  for (const invitation of invitations) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'SWIMTIMER Inscripciones <onboarding@resend.dev>',
        to: invitation.email,
        subject: `Inscripciones abiertas — ${invitation.eventName}`,
        html: generateEmailHTML(invitation)
      })
      results.push(error
        ? { email: invitation.email, club: invitation.clubName, clubCode: invitation.clubCode, success: false, error: error.message }
        : { email: invitation.email, club: invitation.clubName, clubCode: invitation.clubCode, success: true, id: data.id })
    } catch (error) {
      results.push({ email: invitation.email, club: invitation.clubName, clubCode: invitation.clubCode, success: false, error: error.message })
    }
  }
  return res.status(200).json({ results })
}
