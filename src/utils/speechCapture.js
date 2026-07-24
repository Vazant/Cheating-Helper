function createSpeechCaptureGate(mode = 'always') {
    let captureMode = mode === 'toggle' ? 'toggle' : 'always';
    let recording = captureMode === 'always';

    return {
        isRecording: () => recording,
        toggle() {
            if (captureMode !== 'toggle') return recording;
            recording = !recording;
            return recording;
        },
        reset(nextMode = captureMode) {
            captureMode = nextMode === 'toggle' ? 'toggle' : 'always';
            recording = captureMode === 'always';
            return recording;
        },
    };
}

module.exports = { createSpeechCaptureGate };
