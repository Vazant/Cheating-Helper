const assert = require('assert');
const fs = require('fs');
const { resamplePcm16, createSpeechSegmenter, createManualAudioChunker, joinTranscriptParts, encodePcm16Wav } = require('../src/utils/audioPipeline');

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

const manualChunks = [];
const manual = createManualAudioChunker({
    targetChunkMs: 500,
    maxChunkMs: 800,
    boundarySilenceMs: 200,
    overlapMs: 200,
    minSpeechMs: 100,
    onChunk: (audio, metadata) => manualChunks.push({ audio, metadata }),
});
for (let index = 0; index < 5; index++) manual.push(pcmChunk(10000));
for (let index = 0; index < 2; index++) manual.push(pcmChunk(0));
assert.strictEqual(manualChunks.length, 1);
assert.strictEqual(manualChunks[0].metadata.hardSplit, false);

for (let index = 0; index < 8; index++) manual.push(pcmChunk(10000));
manual.flush();
assert.strictEqual(manualChunks.length, 2);
assert.ok(manualChunks.some(chunk => chunk.metadata.hardSplit));
assert.strictEqual(
    joinTranscriptParts(['What is a Java hash map', 'a Java hash map and how does it work?']),
    'What is a Java hash map and how does it work?'
);
assert.strictEqual(joinTranscriptParts(['first part', 'second part']), 'first part second part');

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
assert.ok(rendererSource.includes("const systemAudioNeeded = captureAudio && (toggleMode || audioMode === 'speaker_only')"));
assert.ok(rendererSource.includes("const microphoneNeeded = captureAudio && (toggleMode || audioMode === 'mic_only')"));
assert.ok(rendererSource.includes('micStream.getTracks().forEach(track => track.stop())'));

const mainSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
assert.ok(mainSource.includes('/openai/v1/audio/transcriptions'));
assert.ok(mainSource.includes("const model = 'whisper-large-v3-turbo'"));
assert.ok(mainSource.includes("form.append('model', model)"));
assert.ok(mainSource.includes("form.append('language', language.code)"));
assert.ok(mainSource.includes("processIncomingAudioContent('system'"));
assert.ok(mainSource.includes("processIncomingAudioContent('microphone'"));

console.log('Hosted audio segmentation and routing: OK');
