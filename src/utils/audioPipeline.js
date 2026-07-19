function resamplePcm16(inputBuffer, fromRate = 24000, toRate = 16000, state = { remainder: Buffer.alloc(0) }) {
    const combined = Buffer.concat([state.remainder || Buffer.alloc(0), inputBuffer]);
    const inputSamples = Math.floor(combined.length / 2);
    if (inputSamples < 2) {
        state.remainder = combined;
        return Buffer.alloc(0);
    }

    const ratio = fromRate / toRate;
    const outputSamples = Math.floor((inputSamples - 1) / ratio);
    const output = Buffer.alloc(outputSamples * 2);
    for (let index = 0; index < outputSamples; index++) {
        const sourcePosition = index * ratio;
        const left = Math.floor(sourcePosition);
        const fraction = sourcePosition - left;
        const first = combined.readInt16LE(left * 2);
        const second = combined.readInt16LE(Math.min(left + 1, inputSamples - 1) * 2);
        output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(first + fraction * (second - first)))), index * 2);
    }

    const consumedSamples = Math.floor(outputSamples * ratio);
    state.remainder = combined.subarray(consumedSamples * 2);
    return output;
}

function calculateRms(pcm16Buffer) {
    const samples = Math.floor(pcm16Buffer.length / 2);
    if (!samples) return 0;
    let sum = 0;
    for (let index = 0; index < samples; index++) {
        const normalized = pcm16Buffer.readInt16LE(index * 2) / 32768;
        sum += normalized * normalized;
    }
    return Math.sqrt(sum / samples);
}

function createSpeechSegmenter(options = {}) {
    const config = {
        inputRate: 24000,
        outputRate: 16000,
        energyThreshold: 0.012,
        speechStartMs: 200,
        silenceEndMs: 800,
        preRollMs: 300,
        minSpeechMs: 400,
        maxUtteranceMs: 30000,
        ...options,
    };
    const resampleState = { remainder: Buffer.alloc(0) };
    let preRoll = [];
    let preRollDuration = 0;
    let buffers = [];
    let candidateSpeechMs = 0;
    let speechMs = 0;
    let silenceMs = 0;
    let utteranceMs = 0;
    let speaking = false;

    const resetUtterance = () => {
        buffers = [];
        candidateSpeechMs = 0;
        speechMs = 0;
        silenceMs = 0;
        utteranceMs = 0;
        speaking = false;
    };

    const finalize = () => {
        const audio = speechMs >= config.minSpeechMs && buffers.length ? Buffer.concat(buffers) : null;
        resetUtterance();
        preRoll = [];
        preRollDuration = 0;
        if (audio && typeof config.onUtterance === 'function') config.onUtterance(audio);
        return audio;
    };

    const pushPreRoll = (chunk, durationMs) => {
        preRoll.push({ chunk: Buffer.from(chunk), durationMs });
        preRollDuration += durationMs;
        while (preRollDuration > config.preRollMs && preRoll.length > 1) preRollDuration -= preRoll.shift().durationMs;
    };

    return {
        push(inputBuffer) {
            const chunk = resamplePcm16(inputBuffer, config.inputRate, config.outputRate, resampleState);
            if (!chunk.length) return null;
            const durationMs = (chunk.length / 2 / config.outputRate) * 1000;
            const voice = calculateRms(chunk) >= config.energyThreshold;

            if (!speaking) {
                pushPreRoll(chunk, durationMs);
                candidateSpeechMs = voice ? candidateSpeechMs + durationMs : 0;
                if (candidateSpeechMs >= config.speechStartMs) {
                    speaking = true;
                    buffers = preRoll.map(entry => entry.chunk);
                    utteranceMs = preRollDuration;
                    speechMs = candidateSpeechMs;
                    silenceMs = 0;
                    preRoll = [];
                    preRollDuration = 0;
                }
                return null;
            }

            buffers.push(Buffer.from(chunk));
            utteranceMs += durationMs;
            if (voice) {
                speechMs += durationMs;
                silenceMs = 0;
            } else {
                silenceMs += durationMs;
            }
            if (silenceMs >= config.silenceEndMs || utteranceMs >= config.maxUtteranceMs) return finalize();
            return null;
        },
        flush() {
            return speaking ? finalize() : null;
        },
        reset() {
            resetUtterance();
            preRoll = [];
            preRollDuration = 0;
            resampleState.remainder = Buffer.alloc(0);
        },
    };
}

function encodePcm16Wav(pcmBuffer, sampleRate = 16000, channels = 1) {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * channels * 2;
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(channels * 2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmBuffer.length, 40);
    return Buffer.concat([header, pcmBuffer]);
}

module.exports = { resamplePcm16, calculateRms, createSpeechSegmenter, encodePcm16Wav };
