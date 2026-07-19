const assert = require('assert');
const fs = require('fs');
const { resamplePcm16, createSpeechSegmenter, encodePcm16Wav } = require('../src/utils/audioPipeline');

function pcmChunk(amplitude, samples = 2400) {
    const buffer = Buffer.alloc(samples * 2);
    for (let index = 0; index < samples; index++) buffer.writeInt16LE(index % 2 ? amplitude : -amplitude, index * 2);
    return buffer;
}

const state = { remainder: Buffer.alloc(0) };
let resampledBytes = 0;
for (let index = 0; index < 10; index++) resampledBytes += resamplePcm16(pcmChunk(1000), 24000, 16000, state).length;
assert.ok(Math.abs(resampledBytes / 2 - 16000) < 10);

const utterances = [];
const segmenter = createSpeechSegmenter({ onUtterance: audio => utterances.push(audio) });
for (let index = 0; index < 3; index++) segmenter.push(pcmChunk(0));
for (let index = 0; index < 6; index++) segmenter.push(pcmChunk(10000));
for (let index = 0; index < 9; index++) segmenter.push(pcmChunk(0));
assert.strictEqual(utterances.length, 1);
assert.ok(utterances[0].length > 16000);
segmenter.reset();

const wav = encodePcm16Wav(utterances[0]);
assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE');
assert.strictEqual(wav.readUInt16LE(22), 1);
assert.strictEqual(wav.readUInt32LE(24), 16000);
assert.strictEqual(wav.readUInt16LE(34), 16);
assert.strictEqual(wav.readUInt32LE(40), utterances[0].length);
assert.strictEqual(wav.length, utterances[0].length + 44);

const rendererSource = fs.readFileSync(require.resolve('../src/utils/renderer'), 'utf8');
assert.ok(rendererSource.includes("preferencesCache.audioMode === 'mic_only' ? 'mic_only' : 'speaker_only'"));
assert.ok(rendererSource.includes("audio: captureAudio && audioMode === 'speaker_only'"));
assert.ok(rendererSource.includes("captureAudio && audioMode === 'mic_only'"));
assert.ok(rendererSource.includes('micStream.getTracks().forEach(track => track.stop())'));

const mainSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
assert.ok(mainSource.includes('/openai/v1/audio/transcriptions'));
assert.ok(mainSource.includes("form.append('model', 'whisper-large-v3-turbo')"));
assert.ok(mainSource.includes("form.append('language', language.code)"));
assert.ok(mainSource.includes("processHostedAudioChunk('system'"));
assert.ok(mainSource.includes("processHostedAudioChunk('microphone'"));

console.log('Hosted audio segmentation and routing: OK');
