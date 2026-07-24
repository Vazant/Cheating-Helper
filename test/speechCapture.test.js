const assert = require('node:assert/strict');
const { createSpeechCaptureGate } = require('../src/utils/speechCapture');

const always = createSpeechCaptureGate('always');
assert.equal(always.isRecording(), true);
assert.equal(always.toggle(), true);

const toggle = createSpeechCaptureGate('toggle');
assert.equal(toggle.isRecording(), false);
assert.equal(toggle.toggle(), true);
assert.equal(toggle.toggle(), false);
assert.equal(toggle.reset('always'), true);
assert.equal(toggle.reset('toggle'), false);

console.log('speech capture tests passed');
