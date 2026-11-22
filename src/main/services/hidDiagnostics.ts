/**
 * Windows HID discovery and key-learning diagnostics.
 *
 * Safe by construction: the only outputs are status and raw key codes for the
 * operator UI. Never feeds presentation actions, never starts automatically.
 */
import { RawInputHelperClient, type RawInputWatchHandle } from './rawInputHelper'
import type {
  HidDeviceInfo,
  HidDiagnosticKey,
  HidDiagnosticStatus
} from '../../shared/hidDiagnostics'

export class HidDiagnosticsService {
  private readonly helper: RawInputHelperClient
  private watchHandle: RawInputWatchHandle | null = null
  private generation = 0
  private status: HidDiagnosticStatus = { state: 'idle' }

  constructor(
    executablePath: string,
    private readonly notifyStatus: (status: HidDiagnosticStatus) => void,
    private readonly notifyKey: (key: HidDiagnosticKey) => void
  ) {
    this.helper = new RawInputHelperClient(executablePath)
  }

  currentStatus(): HidDiagnosticStatus {
    return { ...this.status }
  }

  private update(status: HidDiagnosticStatus): void {
    this.status = status
    this.notifyStatus(status)
  }

  /** Enumerates only; it does not start monitoring keyboards. */
  list(): Promise<HidDeviceInfo[]> {
    return this.helper.listDevices()
  }

  async start(deviceId: string): Promise<void> {
    if (this.status.state === 'starting' || this.status.state === 'watching') {
      throw new Error('Zatrzymaj obecny nasłuch przed wyborem innego urządzenia.')
    }
    if (!deviceId || typeof deviceId !== 'string') {
      throw new Error('Wybierz konkretny odbiornik HID.')
    }

    const token = ++this.generation
    this.update({ state: 'starting' })

    try {
      // Revalidate against a NEW device enumeration, never trust only the UI.
      const devices = await this.helper.listDevices()
      if (token !== this.generation) return // cancelled during enumeration
      if (!devices.some((device) => device.id === deviceId)) {
        throw new Error('Wybrany odbiornik nie jest już podłączony. Odśwież listę.')
      }

      const watcher = this.helper.watch(deviceId, {
        onReady: () => {
          if (token === this.generation) this.update({ state: 'watching' })
        },
        onEvent: (event) => {
          if (token === this.generation && this.status.state === 'watching') {
            // No device ID on the UI event: not needed for a single watcher.
            this.notifyKey({ code: event.code, phase: event.phase })
          }
        },
        onDisconnected: () => {
          if (token === this.generation) {
            this.watchHandle = null
            this.update({ state: 'disconnected', message: 'Odbiornik odłączony.' })
          }
        },
        onError: (error) => {
          if (token === this.generation) {
            this.watchHandle = null
            this.update({ state: 'error', message: error.message })
          }
        }
      })
      if (token !== this.generation) watcher.stop()
      else this.watchHandle = watcher
    } catch (error) {
      if (token === this.generation) {
        this.watchHandle = null
        this.update({
          state: 'error',
          message: error instanceof Error ? error.message : 'Nie udało się uruchomić HID.'
        })
      }
      throw error
    }
  }

  stop(): void {
    ++this.generation
    const watcher = this.watchHandle
    this.watchHandle = null
    watcher?.stop()
    this.update({ state: 'idle' })
  }
}
