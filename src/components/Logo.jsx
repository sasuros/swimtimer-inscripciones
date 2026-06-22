export default function Logo({ className = 'h-14 w-14', showByline = false, variant = 'light' }) {
  const source = variant === 'color' ? '/swimtimer-logo.png' : '/swimtimer-logo-white.svg'
  return <div className="inline-flex flex-col items-center"><img src={source} alt="SWIMTIMER" className={`object-contain ${className}`} />{showByline && <span className="mt-1 text-[10px] tracking-widest text-slate-500">by Scanleads</span>}</div>
}
