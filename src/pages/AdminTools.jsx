import { Download, Waves, Wrench } from 'lucide-react'
import AdminHeader from '../components/AdminHeader'

const tools = [
  {
    name: 'SWIMTIMER Herramientas',
    version: 'v1.0',
    description: 'Conecta Meet Manager con la web de inscripciones.',
    features: [
      'Exporta eventos desde tu .mdb',
      'Importa inscripciones al Meet Manager',
      'Backup automático de tus archivos',
    ],
    requirement: 'Windows 10/11 + driver Microsoft Access',
    size: '~25 MB',
    button: 'Descargar herramientas',
    url: 'https://github.com/sasuros/swimtimer-herramientas/releases/download/v1.0/SWIMTIMER.Herramientas.exe',
    Icon: Wrench,
  },
  {
    name: 'SWIMTIMER Aguas Abiertas',
    version: 'v2.8.3',
    description: 'Sistema de cronometraje para eventos de aguas abiertas. Incluye centro de control, generador de brazaletes QR, cronometraje en vivo y exportación de resultados.',
    requirement: 'Windows 10/11 + Python 3.10+',
    size: '~15 MB (ZIP)',
    button: 'Descargar Aguas Abiertas',
    url: 'https://github.com/sasuros/swimtimer-aguas-abiertas/releases/download/v2.8.3/SWIMTIMER_AGUAS_ABIERTAS_PRE_V300.zip',
    Icon: Waves,
  },
]

export default function AdminTools() {
  return <>
    <AdminHeader />
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-brand-800">Panel del organizador</p>
        <h1 className="mt-1 text-3xl font-extrabold">Herramientas SWIMTIMER</h1>
        <p className="mt-2 text-slate-500">Descarga las herramientas de escritorio para tu PC.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Herramientas disponibles">
        {tools.map(({ Icon, ...tool }) => <article key={tool.name} className="card flex flex-col p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden="true"><Icon className="size-6" /></span>
            <div>
              <h2 className="text-xl font-extrabold normal-case">{tool.name} <span className="whitespace-nowrap text-brand-700">{tool.version}</span></h2>
              <p className="mt-3 leading-relaxed text-slate-600">{tool.description}</p>
            </div>
          </div>

          {tool.features && <ul className="mt-5 space-y-2 pl-4 text-slate-700">
            {tool.features.map(feature => <li key={feature} className="flex gap-2"><span className="font-bold text-brand-700" aria-hidden="true">•</span><span>{feature}</span></li>)}
          </ul>}

          <dl className="mt-auto space-y-2 border-t pt-5 text-sm">
            <div className="flex flex-wrap gap-x-2"><dt className="font-bold text-slate-700">Requisito:</dt><dd className="text-slate-600">{tool.requirement}</dd></div>
            <div className="flex gap-2"><dt className="font-bold text-slate-700">Tamaño:</dt><dd className="text-slate-600">{tool.size}</dd></div>
          </dl>

          <a className="btn-primary mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 text-center" href={tool.url} download>
            <Download className="size-5" />{tool.button}
          </a>
        </article>)}
      </section>
    </main>
  </>
}
