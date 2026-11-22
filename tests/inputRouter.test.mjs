import test from 'node:test'
import assert from 'node:assert/strict'
import { DeviceInputRouter, INPUT_ACTIONS } from '../src/shared/inputRouter.ts'

const baseus = {
  deviceId: 'usb:baseus:red-dot:receiver-1',
  enabled: true,
  bindings: [
    { code: 'kbd:scan:0x51', action: 'next-slide' },
    { code: 'kbd:scan:0x49', action: 'previous-slide' }
  ]
}

function key(deviceId, code, phase = 'down', repeat = false) {
  return { deviceId, code, phase, repeat }
}

test('all advertised input actions are distinct', () => {
  assert.equal(new Set(INPUT_ACTIONS).size, INPUT_ACTIONS.length)
})

test('no device can control the show without an explicit mapping', () => {
  const router = new DeviceInputRouter()
  assert.equal(router.handle(key('laptop-keyboard', 'kbd:scan:0x51')), null)
  assert.equal(router.handle(key('usb:untrusted', 'kbd:scan:0x51')), null)
})

test('a Baseus key triggers once per actual press, not per auto-repeat', () => {
  const router = new DeviceInputRouter([baseus])
  const next = key(baseus.deviceId, 'kbd:scan:0x51')
  assert.equal(router.handle(next), 'next-slide')
  assert.equal(router.handle(next), null)
  assert.equal(router.handle({ ...next, repeat: true }), null)
  assert.equal(router.handle({ ...next, phase: 'up' }), null)
  assert.equal(router.handle(next), 'next-slide')
})

test('a normal keyboard never masquerades as the mapped receiver', () => {
  const router = new DeviceInputRouter([baseus])
  const scanCode = 'kbd:scan:0x51'
  assert.equal(router.handle(key('built-in-keyboard', scanCode)), null)
  assert.equal(router.handle(key(baseus.deviceId, scanCode)), 'next-slide')
})

test('two separately mapped devices with the same key act independently', () => {
  const gcCue = {
    deviceId: 'gc-cue:prototype',
    enabled: true,
    bindings: [{ code: 'kbd:scan:0x51', action: 'blackout-toggle' }]
  }
  const router = new DeviceInputRouter([baseus, gcCue])
  assert.equal(router.handle(key(baseus.deviceId, 'kbd:scan:0x51')), 'next-slide')
  assert.equal(router.handle(key(gcCue.deviceId, 'kbd:scan:0x51')), 'blackout-toggle')
  assert.equal(router.handle(key(gcCue.deviceId, 'kbd:scan:0x51')), null)
})

test('disabled devices are ignored even if they have bindings', () => {
  const router = new DeviceInputRouter([{ ...baseus, enabled: false }])
  assert.equal(router.handle(key(baseus.deviceId, 'kbd:scan:0x51')), null)
})

test('unmapped key never triggers a fallback action', () => {
  const router = new DeviceInputRouter([baseus])
  assert.equal(router.handle(key(baseus.deviceId, 'kbd:scan:0x24')), null)
  assert.equal(router.handle(key(baseus.deviceId, 'kbd:scan:0x49')), 'previous-slide')
})

test('USB disconnect clears held keys for reconnection', () => {
  const router = new DeviceInputRouter([baseus])
  const event = key(baseus.deviceId, 'kbd:scan:0x51')
  assert.equal(router.handle(event), 'next-slide')
  assert.equal(router.handle(event), null)
  router.disconnect(baseus.deviceId)
  assert.equal(router.handle(event), 'next-slide')
})

test('reconfiguring mappings is atomic, and old keys lose authority', () => {
  const router = new DeviceInputRouter([baseus])
  const next = key(baseus.deviceId, 'kbd:scan:0x51')
  assert.equal(router.handle(next), 'next-slide')
  router.setProfiles([{
    ...baseus,
    bindings: [{ code: 'kbd:scan:0x51', action: 'first-slide' }]
  }])
  assert.equal(router.handle(next), 'first-slide')
  assert.throws(() => router.setProfiles([{ ...baseus, bindings: [
    { code: 'kbd:scan:0x51', action: 'next-slide' },
    { code: 'kbd:scan:0x51', action: 'last-slide' }
  ] }]), /Duplicate input binding/)
  router.handle({ ...next, phase: 'up' })
  assert.equal(router.handle(next), 'first-slide')
})

test('rejects invalid or ambiguous profile configuration', () => {
  assert.throws(() => new DeviceInputRouter([baseus, baseus]), /Duplicate input device/)
  assert.throws(() => new DeviceInputRouter([{ ...baseus, deviceId: '' }]), /cannot be empty/)
  assert.throws(() => new DeviceInputRouter([{ ...baseus, bindings: [
    { code: '', action: 'next-slide' }
  ] }]), /cannot be empty/)
  assert.throws(() => new DeviceInputRouter([{ ...baseus, bindings: [
    { code: 'kbd:scan:0x51', action: 'reboot-computer' }
  ] }]), /Unsupported input action/)
})

test('release, disconnection and reset never emit an action', () => {
  const router = new DeviceInputRouter([baseus])
  const next = key(baseus.deviceId, 'kbd:scan:0x51')
  assert.equal(router.handle({ ...next, phase: 'up' }), null)
  assert.equal(router.handle(next), 'next-slide')
  router.reset()
  assert.equal(router.handle(next), 'next-slide')
  assert.equal(router.handle({ ...next, phase: 'up' }), null)
})
