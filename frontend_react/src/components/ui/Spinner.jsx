import { Loader2 } from 'lucide-react'
import cn from './cn'

export function Spinner({ className, label = 'Cargando' }) {
  return <Loader2 role="status" aria-label={label} className={cn('size-5 animate-spin text-muted', className)} />
}

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('bg-raised/60 animate-pulse rounded-control', className)} />
}
