import { CircleAlert } from 'lucide-react'

export default function ErrorMessage({ children }) {
  if (!children) return null
  return <p className="mt-1.5 flex items-start gap-1.5 text-sm text-danger-700"><CircleAlert className="mt-0.5 size-4 shrink-0" />{children}</p>
}
