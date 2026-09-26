import Logo from './Logo'

export default function Header({ event, club }) {
  return <header className="app-header border-b border-[#1B3A5C] bg-[#1B3A5C] text-white">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
      <Logo className="size-14" showByline />
      <div className="mr-auto"><p className="text-lg font-extrabold tracking-wider text-white">SWIMTIMER · Inscripciones</p><p className="text-sm text-slate-300">Cada décima. Oficial.</p></div>
      {/* v1.19.1: en el móvil este bloque baja a su propia línea; columna alineada a la izquierda para que el club no quede suelto a la derecha. Desde sm, bloque a la derecha como antes (sm:block anula el flex). */}
      <div className="flex w-full flex-col items-start text-right sm:block sm:w-auto"><span className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">{event.name}</span><p className="mt-1 text-sm font-medium text-white">{club.name}</p></div>
    </div>
  </header>
}
