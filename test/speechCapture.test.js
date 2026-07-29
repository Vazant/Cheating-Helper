const assert = require('node:assert/strict');
const { createSpeechCaptureGate } = require('../src/utils/speechCapture');

const always = createSpeechCaptureGate('always');
assert.equal(always.isRecording(), true);
assert.equal(always.accepts('system'), true);
assert.equal(always.toggle().action, 'ignored');

const toggle = createSpeechCaptureGate('toggle');
assert.equal(toggle.isRecording(), false);
const started = toggle.toggle('system');
assert.equal(started.action, 'start');
assert.equal(toggle.accepts('system'), true);
assert.equal(toggle.toggle('microphone').action, 'blocked');
const stopped = toggle.toggle('system');
assert.equal(stopped.action, 'stop');
assert.equal(toggle.toggle('system').action, 'blocked');
toggle.fail(stopped.sequence, true);
assert.equal(toggle.toggle('system').action, 'retry');
toggle.complete(stopped.sequence);
assert.equal(toggle.getState().state, 'idle');
assert.equal(toggle.reset('always'), true);
assert.equal(toggle.reset('toggle'), false);

console.log('speech capture tests passed');
