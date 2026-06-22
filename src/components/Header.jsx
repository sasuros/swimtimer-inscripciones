import Logo from './Logo'

export default function Header({ event, club }) {
  return <header className="border-b bg-white">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
      <Logo className="size-14" showByline />
      <div className="mr-auto"><p className="text-lg font-extrabold tracking-wider text-brand-800">SWIMTIMER · Inscripciones</p><p className="text-sm text-slate-500">Cada décima. Oficial.</p></div>
      <div className="text-right"><span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">{event.name}</span><p className="mt-1 text-sm font-medium">{club.name}</p></div>
    </div>
  </header>
}
