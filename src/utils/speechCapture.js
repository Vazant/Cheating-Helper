function createSpeechCaptureGate(mode = 'always', defaultSource = 'system') {
    let captureMode = mode === 'always' ? 'always' : 'toggle';
    let state = captureMode === 'always' ? 'recording' : 'idle';
    let source = captureMode === 'always' ? defaultSource : null;
    let sequence = 0;

    return {
        isRecording: requestedSource => state === 'recording' && (!requestedSource || requestedSource === source),
        accepts: requestedSource => state === 'recording' && requestedSource === source,
        getState: () => ({ mode: captureMode, state, source, sequence }),
        toggle(requestedSource = defaultSource) {
            if (captureMode !== 'toggle') return { action: 'ignored', state, source, sequence };
            if (state === 'idle') {
                state = 'recording';
                source = requestedSource;
                sequence++;
                return { action: 'start', state, source, sequence };
            }
            if (state === 'recording' && source === requestedSource) {
                state = 'finalizing';
                return { action: 'stop', state, source, sequence };
            }
            if (state === 'failed' && source === requestedSource) {
                state = 'finalizing';
                return { action: 'retry', state, source, sequence };
            }
            return { action: 'blocked', state, source, sequence };
        },
        complete(completedSequence = sequence) {
            if (completedSequence !== sequence) return false;
            state = 'idle';
            source = null;
            return true;
        },
        fail(failedSequence = sequence, retryable = false) {
            if (failedSequence !== sequence) return false;
            state = retryable ? 'failed' : 'idle';
            if (!retryable) source = null;
            return true;
        },
        reset(nextMode = captureMode, nextDefaultSource = defaultSource) {
            captureMode = nextMode === 'always' ? 'always' : 'toggle';
            defaultSource = nextDefaultSource;
            sequence++;
            state = captureMode === 'always' ? 'recording' : 'idle';
            source = captureMode === 'always' ? defaultSource : null;
            return state === 'recording';
        },
    };
}

module.exports = { createSpeechCaptureGate };
