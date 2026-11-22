import { useEffect, useRef, useState } from 'react'
import { INPUT_ACTIONS, type InputAction } from '../../../shared/inputRouter'
import type {
  HidDeviceInfo,
  HidDiagnosticStatus
} from '../../../shared/hidDiagnostics'
import './HidDiagnosticsControl.css'

interface Props {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

const ACTION_LABELS: Record<InputAction, string> = {
  'next-slide': 'Następny slajd',
  'previous-slide': 'Poprzedni slajd',
  'first-slide': 'Pierwszy slajd',
  'last-slide': 'Ostatni slajd',
  'blackout-toggle': 'Przełącz blackout',
  'whiteout-toggle': 'Przełącz whiteout'
}

const STATUS_LABELS: Record<HidDiagnosticStatus['state'], string> = {
  idle: 'Nasłuch wyłączony',
  starting: 'Uruchamianie odbiornika…',
  watching: 'Odczyt przycisków (diagnostyka)',
  disconnected: 'Odbiornik został odłączony',
  error: 'Błąd połączenia z odbiornikiem'
}

/**
 * A diagnostics and mapping PREVIEW only: no persisted profiles or navigation.
 * While the panel is open, App disables its own local keyboard shortcuts.
 * This does not stop the same clicker keys reaching an unrelated foreground app.
 */
function HidDiagnosticsControl({ expanded, onExpandedChange }: Props): React.JSX.Element {
  const [devices, setDevices] = useState<HidDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [status, setStatus] = useState<HidDiagnosticStatus>({ state: 'idle' })
  const [codes, setCodes] = useState<string[]>([])
  const [draft, setDraft] = useState<Record<string, InputAction | ''>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const held = useRef(new Set<string>())

  useEffect(() => {
    if (!expanded) return
    let mounted = true
    const removeStatus = window.api.hid.onStatus((next) => {
      if (!mounted) return
      setStatus(next)
      if (next.state !== 'watching') held.current.clear()
      if (next.state === 'error' && next.message) setError(next.message)
    })
    const removeKey = window.api.hid.onKey((key) => {
      if (!mounted) return
      if (key.phase === 'up') {
        held.current.delete(key.code)
        return
      }
      if (held.current.has(key.code)) return
      held.current.add(key.code)
      setCodes((prev) => prev.includes(key.code) ? prev : [...prev, key.code].slice(-24))
    })
    void window.api.hid.status().then((next) => {
      if (mounted) setStatus(next)
    }).catch((err: unknown) => {
      if (mounted) setError(err instanceof Error ? err.message : String(err))
    })
    void window.api.hid.listDevices().then((next) => {
      if (!mounted) return
      setDevices(next)
      setDeviceId((old) => next.some((device) => device.id === old) ? old : '')
    }).catch((err: unknown) => {
      if (mounted) setError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      mounted = false
      removeStatus()
      removeKey()
      held.current.clear()
    }
  }, [expanded])

  const listening = status.state === 'starting' || status.state === 'watching'

  const refresh = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = await window.api.hid.listDevices()
      setDevices(next)
      setDeviceId((old) => next.some((device) => device.id === old) ? old : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const start = async (): Promise<void> => {
    if (!deviceId) return
    setError(null)
    setBusy(true)
    setCodes([])
    setDraft({})
    held.current.clear()
    try {
      await window.api.hid.watch(deviceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const stop = async (): Promise<boolean> => {
    setBusy(true)
    try {
      await window.api.hid.stop()
      held.current.clear()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (): Promise<void> => {
    if (expanded) {
      // Keep local slide hotkeys suspended until Win32 monitoring is stopped.
      if (await stop()) onExpandedChange(false)
    } else {
      onExpandedChange(true)
    }
  }

  const mappedCount = Object.values(draft).filter(Boolean).length

  return (
    <div className="hid-control">
      <button
        type="button"
        className="transport-btn"
        onClick={() => { void toggle() }}
        aria-expanded={expanded}
      >
        HID — test
      </button>
      {expanded && (
        <section className="hid-panel" aria-label="Diagnostyka pilotów HID">
          <h3>Odbiorniki HID</h3>
          <p className="hid-hint">
            Tryb testowy: żaden przycisk z tej listy nie jest wysyłany do
            kontrolera prezentacji. Lokalne skróty GC-Presentation są zawieszone
            podczas otwarcia panelu.
          </p>
          <div className="hid-row">
            <label htmlFor="hid-device">Odbiornik USB</label>
            <button type="button" disabled={busy || listening} onClick={() => { void refresh() }}>
              Odśwież
            </button>
          </div>
          <select
            id="hid-device"
            value={deviceId}
            disabled={busy || listening}
            onChange={(event) => {
              setDeviceId(event.target.value)
              setCodes([])
              setDraft({})
            }}
          >
            <option value="">Wybierz urządzenie…</option>
            {devices.map((device, index) => (
              <option key={device.id} value={device.id}>
                {device.label} ({index + 1})
              </option>
            ))}
          </select>
          <div className="hid-row">
            <span>{STATUS_LABELS[status.state]}</span>
            {listening ? (
              <button type="button" disabled={busy} onClick={() => { void stop() }}>
                Zatrzymaj
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !deviceId}
                onClick={() => { void start() }}
              >
                Testuj przyciski
              </button>
            )}
          </div>
          {error && <p role="alert" className="hid-error">{error}</p>}
          <h4>Wykryte przyciski ({codes.length})</h4>
          {codes.length === 0 ? (
            <p className="hid-hint">Wybierz odbiornik, uruchom test i naciśnij jego przyciski.</p>
          ) : (
            <div className="hid-codes">
              {codes.map((code) => (
                <label key={code} className="hid-code-row">
                  <code>{code}</code>
                  <select
                    aria-label={'Akcja próbna dla ' + code}
                    value={draft[code] ?? ''}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [code]: event.target.value as InputAction | ''
                      }))
                    }
                  >
                    <option value="">Bez akcji</option>
                    {INPUT_ACTIONS.map((action) => (
                      <option key={action} value={action}>{ACTION_LABELS[action]}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <p className="hid-hint">
            Robocze mapowania: {mappedCount}. Nie są aktywne ani zapisywane.
            Zostaną wyczyszczone przy nowym teście.
          </p>
          <p className="hid-warning">
            Uwaga: pilot-klawiatura może równocześnie sterować inną aktywną
            aplikacją (np. OBS albo PowerPoint). Nie testuj podczas emisji.
          </p>
        </section>
      )}
    </div>
  )
}

export default HidDiagnosticsControl
