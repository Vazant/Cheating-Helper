const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const windowSource = source('src/utils/window.js');
const indexSource = source('src/index.js');
const rendererSource = source('src/utils/renderer.js');
const mainSource = source('src/utils/gemini.js');
const storageSource = source('src/storage.js');

assert.match(windowSource, /toggleSystemAudio:\s*'F8'/);
assert.match(windowSource, /toggleMicrophone:\s*'F9'/);
assert.match(windowSource, /\['toggleSystemAudio', 'system'\]/);
assert.match(windowSource, /\['toggleMicrophone', 'microphone'\]/);

const updateKeybindListeners =
    (windowSource.match(/ipcMain\.on\('update-keybinds'/g) || []).length + (indexSource.match(/ipcMain\.on\('update-keybinds'/g) || []).length;
assert.equal(updateKeybindListeners, 1);

assert.ok(rendererSource.includes("'start-speech-capture'"));
assert.ok(rendererSource.includes("'finish-speech-capture'"));
assert.ok(rendererSource.includes("'retry-speech-capture'"));
assert.ok(rendererSource.includes("speechCaptureGate.accepts('system')"));
assert.ok(rendererSource.includes("speechCaptureGate.accepts('microphone')"));

const chunkQueueBody = mainSource.slice(
    mainSource.indexOf('function queueManualAudioChunk'),
    mainSource.indexOf('function startManualSpeechCapture')
);
assert.ok(!chunkQueueBody.includes('queueGroqText'));
const finalDispatchBody = mainSource.slice(
    mainSource.indexOf('function dispatchFinalTranscript'),
    mainSource.indexOf('async function finalizeManualSpeechCapture')
);
assert.equal((finalDispatchBody.match(/queueGroqText\(/g) || []).length, 1);
assert.ok(mainSource.includes('joinTranscriptParts(session.chunks.map'));
assert.match(storageSource, /speechCaptureMode:\s*'toggle'/);

console.log('Toggle-to-talk routing and single final LLM dispatch: OK');
