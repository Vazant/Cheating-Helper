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

function createManualAudioChunker(options = {}) {
    const config = {
        inputRate: 24000,
        outputRate: 16000,
        energyThreshold: 0.012,
        minSpeechMs: 400,
        targetChunkMs: 20000,
        maxChunkMs: 28000,
        boundarySilenceMs: 200,
        overlapMs: 600,
        ...options,
    };
    const resampleState = { remainder: Buffer.alloc(0) };
    let entries = [];
    let durationMs = 0;
    let speechMs = 0;
    let trailingSilenceMs = 0;
    let newSpeechMs = 0;

    const resetBuffers = retained => {
        entries = retained || [];
        durationMs = entries.reduce((total, entry) => total + entry.durationMs, 0);
        speechMs = entries.reduce((total, entry) => total + (entry.voice ? entry.durationMs : 0), 0);
        newSpeechMs = 0;
        trailingSilenceMs = 0;
        for (let index = entries.length - 1; index >= 0 && !entries[index].voice; index--) trailingSilenceMs += entries[index].durationMs;
    };

    const emit = hardSplit => {
        if (!entries.length) return null;
        const audio = speechMs >= config.minSpeechMs && newSpeechMs > 0 ? Buffer.concat(entries.map(entry => entry.chunk)) : null;
        let retained = [];
        if (hardSplit && audio) {
            let retainedMs = 0;
            for (let index = entries.length - 1; index >= 0 && retainedMs < config.overlapMs; index--) {
                retained.unshift(entries[index]);
                retainedMs += entries[index].durationMs;
            }
        }
        resetBuffers(retained);
        if (audio && typeof config.onChunk === 'function') config.onChunk(audio, { hardSplit });
        return audio;
    };

    return {
        push(inputBuffer) {
            const chunk = resamplePcm16(inputBuffer, config.inputRate, config.outputRate, resampleState);
            if (!chunk.length) return null;
            const chunkDurationMs = (chunk.length / 2 / config.outputRate) * 1000;
            const voice = calculateRms(chunk) >= config.energyThreshold;
            entries.push({ chunk: Buffer.from(chunk), durationMs: chunkDurationMs, voice });
            durationMs += chunkDurationMs;
            speechMs += voice ? chunkDurationMs : 0;
            newSpeechMs += voice ? chunkDurationMs : 0;
            trailingSilenceMs = voice ? 0 : trailingSilenceMs + chunkDurationMs;

            if (durationMs >= config.targetChunkMs && trailingSilenceMs >= config.boundarySilenceMs) return emit(false);
            if (durationMs >= config.maxChunkMs) return emit(true);
            return null;
        },
        flush() {
            return emit(false);
        },
        reset() {
            resetBuffers([]);
            resampleState.remainder = Buffer.alloc(0);
        },
        getDurationMs: () => durationMs,
    };
}

function joinTranscriptParts(parts) {
    const normalized = parts.map(part => String(part || '').trim()).filter(Boolean);
    if (!normalized.length) return '';

    let merged = normalized[0];
    for (const part of normalized.slice(1)) {
        const previousWords = merged.split(/\s+/);
        const nextWords = part.split(/\s+/);
        const comparable = word => word.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        let overlap = 0;
        const maxOverlap = Math.min(12, previousWords.length, nextWords.length);
        for (let size = maxOverlap; size >= 2; size--) {
            const previous = previousWords.slice(-size).map(comparable);
            const next = nextWords.slice(0, size).map(comparable);
            if (previous.every((word, index) => word && word === next[index])) {
                overlap = size;
                break;
            }
        }
        merged = `${merged} ${nextWords.slice(overlap).join(' ')}`.trim();
    }
    return merged.replace(/\s+/g, ' ');
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

module.exports = { resamplePcm16, calculateRms, createSpeechSegmenter, createManualAudioChunker, joinTranscriptParts, encodePcm16Wav };
