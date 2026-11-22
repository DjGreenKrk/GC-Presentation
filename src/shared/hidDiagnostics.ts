/** Operator-facing HID diagnostics are read-only. No presentation actions here. */
export interface HidDeviceInfo {
  id: string
  label: string
}

export type HidDiagnosticState = 'idle' | 'starting' | 'watching' | 'disconnected' | 'error'

export interface HidDiagnosticStatus {
  state: HidDiagnosticState
  message?: string
}

export interface HidDiagnosticKey {
  code: string
  phase: 'down' | 'up'
}
