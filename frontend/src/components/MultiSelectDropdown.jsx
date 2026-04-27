import { useState, useRef, useEffect } from 'react'

export default function MultiSelectDropdown({ options, selected, onChange, allLabel = 'All', minWidth = 120 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // selected = [] means "all selected"
  const allSelected = selected.length === 0

  const toggleAll = () => onChange([])

  const toggle = (val) => {
    if (selected.includes(val)) {
      const next = selected.filter(v => v !== val)
      onChange(next)
    } else {
      const next = [...selected, val]
      if (next.length === options.length) onChange([])
      else onChange(next)
    }
  }

  let displayLabel = allLabel
  if (!allSelected) {
    if (selected.length === 1) displayLabel = options.find(o => o.value === selected[0])?.label ?? '1'
    else displayLabel = `${selected.length} selected`
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="multiselect-trigger" onClick={() => setOpen(v => !v)} style={{ minWidth }}>
        <span>{displayLabel}</span>
        <span className={`multiselect-chevron${open ? ' open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="multiselect-menu" style={{ minWidth }}>
          <button className={`multiselect-item${allSelected ? ' active' : ''}`} onClick={toggleAll}>
            <span className="multiselect-check">{allSelected ? '✓' : ''}</span>
            {allLabel}
          </button>
          <div className="multiselect-divider" />
          {options.map(opt => {
            const checked = !allSelected && selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                className={`multiselect-item${checked ? ' active' : ''}`}
                onClick={() => toggle(opt.value)}
              >
                <span className="multiselect-check">{checked ? '✓' : ''}</span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
