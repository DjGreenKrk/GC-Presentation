import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TRANSITION,
  clampTransitionMs,
  directionVector,
  isDirectional,
  isTransitionDirection,
  isTransitionEffect,
  resolveDirection
} from '../src/shared/transitions.ts'

// Pure-domain tests intentionally run with Node's built-in test runner and
// type-stripping, without Electron, NDI SDK or a display server.
test('default transition never animates program unexpectedly', () => {
  assert.equal(DEFAULT_TRANSITION.effect, 'cut')
})

test('transition durations are clamped to the safe range', () => {
  assert.equal(clampTransitionMs(-1), 50)
  assert.equal(clampTransitionMs(25), 50)
  assert.equal(clampTransitionMs(150.6), 151)
  assert.equal(clampTransitionMs(10000), 5000)
  assert.equal(clampTransitionMs(Number.NaN), DEFAULT_TRANSITION.durationMs)
  assert.equal(clampTransitionMs(Infinity), DEFAULT_TRANSITION.durationMs)
})

test('recognizes supported effects and rejects unsupported input', () => {
  assert.equal(isTransitionEffect('wipe'), true)
  assert.equal(isTransitionEffect('cut'), true)
  assert.equal(isTransitionEffect('flash-everything'), false)
  assert.equal(isTransitionDirection('dynamic'), true)
  assert.equal(isTransitionDirection('northwest'), false)
})

test('only directional effects need an edge', () => {
  assert.equal(isDirectional('push'), true)
  assert.equal(isDirectional('wipe'), true)
  assert.equal(isDirectional('fade'), false)
  assert.equal(isDirectional('cut'), false)
})

test('dynamic transitions invert direction when navigating backward', () => {
  assert.equal(resolveDirection('dynamic', 'forward'), 'left')
  assert.equal(resolveDirection('dynamic', 'backward'), 'right')
  assert.equal(resolveDirection('bottom', 'backward'), 'bottom')
})

test('slide motion vectors consistently move away from the chosen edge', () => {
  assert.deepEqual(directionVector('left'), { x: 1, y: 0 })
  assert.deepEqual(directionVector('right'), { x: -1, y: 0 })
  assert.deepEqual(directionVector('top-left'), { x: 1, y: 1 })
  assert.deepEqual(directionVector('bottom-right'), { x: -1, y: -1 })
})
