import { Clipboard, Mail, X } from 'lucide-react'
import { allLinksText } from '../utils/messageTemplates'

export default function LinkDistributionModal({ event, eventId, clubs, urlFor, onCopy, onSendEmail, emailing, onClose }) {
  const copyAll = () => onCopy(allLinksText(event, clubs, urlFor), 'Todos los enlaces copiados')
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-slate-950/80 p-3 sm:p-5">
      <section className="card mx-auto max-w-3xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold uppercase text-brand-800">Distribuir enlaces</h2>
            <p className="mt-1 text-sm text-slate-500">{event.name}</p>
          </div>
          <button className="rounded p-2 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <button className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto" onClick={copyAll}>
          <Clipboard className="size-4" />
          Copiar todos los enlaces
        </button>
        <div className="mt-5 space-y-3">
          {clubs.map((club) => (
            <article key={club.code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-brand-800">{club.name}</h3>
                  <p className="text-sm text-slate-500">{club.email || 'Sin correo'}</p>
                </div>
                <p className="rounded bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-brand-800">PIN: {club.pin || '—'}</p>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {club.token ? (
                  <button className="btn-secondary inline-flex items-center justify-center gap-2 text-sm" onClick={() => onCopy(urlFor(club.token), 'Enlace copiado')}>
                    <Clipboard className="size-4" />
                    Copiar enlace
                  </button>
                ) : (
                  <span className="text-sm text-warning-800">Genera los enlaces primero</span>
                )}
                {club.email ? (
                  <button className="btn-secondary inline-flex items-center justify-center gap-2 text-sm" disabled={emailing} onClick={() => onSendEmail(club)}>
                    <Mail className="size-4" />
                    Enviar invitación por correo
                  </button>
                ) : (
                  <a className="self-center text-sm font-bold text-brand-700 hover:underline" href={`/admin/eventos/${eventId}/editar`}>
                    Agregar correo
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
