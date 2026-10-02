import cn from './cn'

export default function Card({ className, ...props }) {
  return <div className={cn('bg-surface border border-line rounded-panel', className)} {...props} />
}
