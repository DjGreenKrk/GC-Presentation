/**
 * Strict NDJSON protocol for the opt-in Windows Raw Input helper.
 * Malformed output must never become a presentation command.
 */
export type RawInputHelperMessage =
  | { type: 'device'; id: string; label: string }
  | { type: 'ready' }
  | { type: 'event'; code: string; phase: 'down' | 'up' }
  | { type: 'disconnected' }

const KEY_CODE = /^kbd:(?:scan:0x[0-9A-F]{2,4}(?::e[01])?|vkey:0x[0-9A-F]{2,4})$/
const MAX_MESSAGE_LENGTH = 65_536

export function parseRawInputHelperMessage(line: string): RawInputHelperMessage | null {
  if (!line || line.length > MAX_MESSAGE_LENGTH) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const value = parsed as Record<string, unknown>
  switch (value.type) {
    case 'device':
      if (typeof value.id !== 'string' || !value.id || value.id.length > 32_768) return null
      if (typeof value.label !== 'string' || !value.label || value.label.length > 512) return null
      return { type: 'device', id: value.id, label: value.label }
    case 'ready':
      return { type: 'ready' }
    case 'event':
      if (typeof value.code !== 'string' || !KEY_CODE.test(value.code)) return null
      if (value.phase !== 'down' && value.phase !== 'up') return null
      return { type: 'event', code: value.code, phase: value.phase }
    case 'disconnected':
      return { type: 'disconnected' }
    default:
      return null
  }
}
