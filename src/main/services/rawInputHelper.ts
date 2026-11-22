/**
 * Low-level Windows Raw Input transport. Nothing starts automatically and
 * this module NEVER dispatches presentation actions; pairing and routing are
 * a separate, explicit operator action.
 *
 * The helper executable is shipped outside app.asar in resources/hid on
 * Windows. A failure here must not affect Program/Next/Presenter rendering.
 */
import { execFile, spawn } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import type { InputDeviceEvent } from '../../shared/inputRouter'
import { parseRawInputHelperMessage } from '../../shared/rawInputProtocol'

const execFileAsync = promisify(execFile)

export interface RawInputDevice {
  id: string
  label: string
}

export interface RawInputWatchCallbacks {
  onReady: () => void
  onEvent: (event: InputDeviceEvent) => void
  onDisconnected: () => void
  onError: (error: Error) => void
}

export interface RawInputWatchHandle {
  stop: () => void
}

/** appRoot comes from app.getAppPath(), resourcesRoot from process.resourcesPath. */
export function rawInputExecutablePath(
  appRoot: string,
  resourcesRoot: string,
  isPackaged: boolean
): string {
  return isPackaged
    ? join(resourcesRoot, 'hid', 'gc-raw-input.exe')
    : join(appRoot, 'native', 'raw-input-helper', 'bin', 'gc-raw-input.exe')
}

export class RawInputHelperClient {
  constructor(private readonly executablePath: string) {}

  /** Read-only enumeration; no listener is installed and no keys are read. */
  async listDevices(): Promise<RawInputDevice[]> {
    const { stdout } = await execFileAsync(this.executablePath, ['--list'], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8'
    })
    const devices: RawInputDevice[] = []
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim()) continue
      const message = parseRawInputHelperMessage(line)
      if (!message || message.type !== 'device') {
        throw new Error('Raw Input helper returned an invalid device listing')
      }
      devices.push({ id: message.id, label: message.label })
    }
    return devices
  }

  /**
   * Watch one EXACT device path, selected explicitly after enumeration.
   * No implicit VID/PID matching or fallback to the default keyboard.
   */
  watch(devicePath: string, callbacks: RawInputWatchCallbacks): RawInputWatchHandle {
    if (!devicePath.trim() || devicePath.length > 32_768) {
      throw new Error('An explicitly selected Raw Input device path is required')
    }

    // Argument array, never a shell command; no automatic restart on USB reconnect.
    const child = spawn(this.executablePath, ['--watch', devicePath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let ready = false
    let stopped = false
    let disconnected = false
    let errorReported = false
    let stderr = ''

    const report = (error: Error): void => {
      if (errorReported) return
      errorReported = true
      try {
        callbacks.onError(error)
      } catch {
        // Diagnostics callback must not crash Electron's main process.
      }
    }
    const disconnect = (): void => {
      if (disconnected) return
      disconnected = true
      try {
        callbacks.onDisconnected()
      } catch (error) {
        report(error instanceof Error ? error : new Error(String(error)))
      }
    }
    const stop = (): void => {
      if (stopped) return
      stopped = true
      disconnect()
      child.kill()
    }

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr = (stderr + String(chunk)).slice(-2048)
    })
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
    lines.on('line', (line) => {
      if (stopped || disconnected) return
      const message = parseRawInputHelperMessage(line)
      if (!message || message.type === 'device') {
        report(new Error('Invalid Raw Input helper protocol message'))
        stop()
        return
      }
      try {
        if (message.type === 'ready') {
          if (ready) throw new Error('Duplicate Raw Input helper ready message')
          ready = true
          callbacks.onReady()
        } else if (message.type === 'event') {
          if (!ready) throw new Error('Raw Input event received before ready')
          callbacks.onEvent({ deviceId: devicePath, code: message.code, phase: message.phase })
        } else if (message.type === 'disconnected') {
          disconnect()
        }
      } catch (error) {
        report(error instanceof Error ? error : new Error(String(error)))
        stop()
      }
    })
    child.on('error', (error) => {
      report(error)
      stop()
    })
    child.on('close', (code) => {
      if (stopped) return
      disconnect()
      if (!ready || code !== 0) {
        report(new Error('Raw Input helper exited (code: ' + (code ?? 'unknown') +
          '): ' + stderr.trim().slice(0, 500)))
      }
    })
    return { stop }
  }
}
