/**
 * Device-aware action routing for GC-Presentation. This module deliberately
 * contains no Electron, Win32, React, USB or global keyboard hooks.
 *
 * The native adapter owns physical identification and key normalization. The
 * router accepts only explicitly configured devices: plugging in a second
 * keyboard must NOT grant it control of a running event by default.
 */

/** Internal actions, independent of the transport that delivered a press. */
export type InputAction =
  | 'next-slide'
  | 'previous-slide'
  | 'first-slide'
  | 'last-slide'
  | 'blackout-toggle'
  | 'whiteout-toggle'

export const INPUT_ACTIONS: readonly InputAction[] = [
  'next-slide',
  'previous-slide',
  'first-slide',
  'last-slide',
  'blackout-toggle',
  'whiteout-toggle'
]

/**
 * An opaque identity resolved by a platform adapter.
 *
 * On Windows the transient RAWINPUTHEADER.hDevice is NOT suitable as a stored
 * identity. Resolve a selected device to a stable, user-visible profile ID
 * before passing events here. Multiple identical receivers with no unique
 * serial may require manual disambiguation at each reconnect.
 */
export interface InputDeviceProfile {
  deviceId: string
  enabled: boolean
  bindings: readonly InputBinding[]
}

/** An adapter-normalized event code, not a locale-dependent text character. */
export interface InputBinding {
  code: string
  action: InputAction
}

export interface InputDeviceEvent {
  deviceId: string
  code: string
  phase: 'down' | 'up'
  /** OS auto-repeat should never advance the presentation again. */
  repeat?: boolean
}

interface ResolvedProfile {
  enabled: boolean
  actions: ReadonlyMap<string, InputAction>
}

function isInputAction(value: string): value is InputAction {
  return (INPUT_ACTIONS as readonly string[]).includes(value)
}

/**
 * One action per physical key press, with separate held-key state per device.
 * Not a global hotkey interceptor: Windows still delivers normal keyboard
 * events to the foreground app when a clicker emulates a keyboard.
 */
export class DeviceInputRouter {
  private profiles = new Map<string, ResolvedProfile>()
  private held = new Map<string, Set<string>>()

  constructor(profiles: readonly InputDeviceProfile[] = []) {
    this.setProfiles(profiles)
  }

  setProfiles(profiles: readonly InputDeviceProfile[]): void {
    const resolved = new Map<string, ResolvedProfile>()
    for (const profile of profiles) {
      if (!profile.deviceId.trim()) throw new Error('Input device ID cannot be empty')
      if (resolved.has(profile.deviceId)) {
        throw new Error(`Duplicate input device profile: ${profile.deviceId}`)
      }

      const actions = new Map<string, InputAction>()
      for (const binding of profile.bindings) {
        if (!binding.code.trim()) throw new Error('Input binding code cannot be empty')
        if (!isInputAction(binding.action)) {
          throw new Error(`Unsupported input action: ${binding.action}`)
        }
        if (actions.has(binding.code)) {
          throw new Error(`Duplicate input binding for device ${profile.deviceId}: ${binding.code}`)
        }
        actions.set(binding.code, binding.action)
      }
      resolved.set(profile.deviceId, { enabled: profile.enabled, actions })
    }

    // Swap atomically after validation. Preserve physical key-down state for
    // still-enabled devices: remapping an already-held button must never fire
    // another action until its real key-up arrives.
    const retained = new Map<string, Set<string>>()
    for (const [deviceId, keys] of this.held) {
      if (resolved.get(deviceId)?.enabled) retained.set(deviceId, keys)
    }
    this.profiles = resolved
    this.held = retained
  }

  handle(event: InputDeviceEvent): InputAction | null {
    if (!event.deviceId || !event.code) return null

    // Release events only change key state, never run an action.
    if (event.phase === 'up') {
      const held = this.held.get(event.deviceId)
      held?.delete(event.code)
      if (held?.size === 0) this.held.delete(event.deviceId)
      return null
    }

    if (event.phase !== 'down') return null
    const profile = this.profiles.get(event.deviceId)
    if (!profile || !profile.enabled) return null

    let held = this.held.get(event.deviceId)
    if (!held) {
      held = new Set()
      this.held.set(event.deviceId, held)
    }
    if (event.repeat || held.has(event.code)) return null

    held.add(event.code)
    return profile.actions.get(event.code) ?? null
  }

  /** Called on USB removal, lost transport or adapter restart. */
  disconnect(deviceId: string): void {
    this.held.delete(deviceId)
  }

  reset(): void {
    this.held.clear()
  }
}
