'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string }

type FilterDropdownProps = {
  label: string
  count?: number
  options: Option[]
  selected?: string[]
  onChange?: (selected: string[]) => void
  multi?: boolean
}

export function FilterDropdown({
  label,
  count,
  options,
  selected: selectedProp,
  onChange,
  multi = true,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [internal, setInternal] = useState<string[]>(selectedProp ?? [])
  const ref = useRef<HTMLDivElement>(null)

  const selected = selectedProp ?? internal
  const hasSelection = selected.length > 0

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const toggle = (value: string) => {
    let next: string[]
    if (multi) {
      next = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    } else {
      next = selected.includes(value) ? [] : [value]
      setOpen(false)
    }
    if (onChange) onChange(next)
    else setInternal(next)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
          'bg-bg-800 border hover:bg-bg-700/50',
          hasSelection
            ? 'border-violet-500/30 text-violet-300'
            : 'border-bg-700/40 text-ink-200'
        )}
      >
        <span>{label}</span>
        {typeof count === 'number' && (
          <span className="text-[10px] num text-ink-400">{count}</span>
        )}
        {hasSelection && (
          <span className="text-[10px] num bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-0 bg-bg-900 border border-bg-700/40 rounded-lg p-1 min-w-48 shadow-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-500">Sem opções</div>
          ) : (
            options.map((opt) => {
              const isSelected = selected.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm transition-colors',
                    'text-ink-200 hover:bg-bg-800 text-left'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border grid place-items-center shrink-0',
                      isSelected
                        ? 'bg-violet-500 border-violet-500'
                        : 'border-bg-700'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="flex-1">{opt.label}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
