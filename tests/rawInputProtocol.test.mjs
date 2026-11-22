import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRawInputHelperMessage as parse } from '../src/shared/rawInputProtocol.ts'

test('accepts listing, ready, scan codes, virtual key fallback and disconnect', () => {
  const device = { type: 'device', id: 'HID#VID_1234&PID_5678', label: 'Klawiatura HID' }
  assert.deepEqual(parse(JSON.stringify(device)), device)
  assert.deepEqual(parse('{"type":"ready"}'), { type: 'ready' })
  assert.deepEqual(parse('{"type":"event","code":"kbd:scan:0x51","phase":"down"}'),
    { type: 'event', code: 'kbd:scan:0x51', phase: 'down' })
  assert.deepEqual(parse('{"type":"event","code":"kbd:scan:0x4D:e0","phase":"up"}'),
    { type: 'event', code: 'kbd:scan:0x4D:e0', phase: 'up' })
  assert.deepEqual(parse('{"type":"event","code":"kbd:vkey:0xAB","phase":"down"}'),
    { type: 'event', code: 'kbd:vkey:0xAB', phase: 'down' })
  assert.deepEqual(parse('{"type":"disconnected"}'), { type: 'disconnected' })
})

test('rejects malformed and unexpected helper output', () => {
  for (const message of [
    '', 'not JSON', '[]', '{}', '{"type":"unknown"}',
    '{"type":"device","id":"","label":"test"}',
    '{"type":"device","id":"abc","label":null}',
    '{"type":"event","code":"next-slide","phase":"down"}',
    '{"type":"event","code":"kbd:scan:0x51","phase":"hold"}',
    '{"type":"event","code":"kbd:scan:0x51","phase":null}',
    'x'.repeat(65_537)
  ]) {
    assert.equal(parse(message), null, message.slice(0, 100))
  }
})
