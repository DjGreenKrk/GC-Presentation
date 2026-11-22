import { useEffect, useState } from 'react'

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  internal: boolean
  primary: boolean
}

interface Props {
  disabled: boolean
  variant?: 'program' | 'next'
  hideCursor: boolean
  onHideCursorChange: (value: boolean) => void
}

function preferredDisplay(list: DisplayInfo[]): DisplayInfo | undefined {
  return list.find((d) => !d.primary) ?? list[0]
}

function ProgramOutControl({
  disabled,
  variant = 'program',
  hideCursor,
  onHideCursorChange
}: Props): React.JSX.Element {
  const output = variant === 'next' ? window.api.nextOut : window.api.programOut
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    output.listDisplays().then((list) => {
      setDisplays(list)
      setSelectedId(preferredDisplay(list)?.id ?? null)
    })
    return output.onDisplaysChanged((list) => {
      setDisplays(list)
      setSelectedId((current) =>
        current && list.some((d) => d.id === current)
          ? current
          : (preferredDisplay(list)?.id ?? null)
      )
    })
  }, [output])

  useEffect(() => {
    output.isOpen().then(setOpen)
    return output.onOpenChanged(setOpen)
  }, [output])

  const toggle = (): void => {
    if (open) output.close()
    else if (selectedId !== null) output.open(selectedId)
  }

  return (
    <div className="program-out-control">
      {displays.length > 1 && (
        <select
          className="program-out-display-select"
          value={selectedId ?? ''}
          disabled={open}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {displays.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({d.width}×{d.height}){d.primary ? ' · Primary' : ''}
            </option>
          ))}
        </select>
      )}
      <button
        className={`transport-btn ${open ? 'active' : ''}`}
        disabled={disabled || (!open && selectedId === null)}
        onClick={toggle}
      >
        {variant === 'next' ? (open ? 'Close Next Out' : 'Next Out') : (open ? 'Close Program Out' : 'Program Out')}
      </button>
      {variant === 'program' && <label className="program-out-hide-cursor">
        <input
          type="checkbox"
          checked={hideCursor}
          onChange={(e) => onHideCursorChange(e.target.checked)}
        />
        Hide cursor
      </label>}
    </div>
  )
}

export default ProgramOutControl
