const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createAbortScope } = require('../src/utils/groq');

function delayedRequest(signal) {
    return new Promise((resolve, reject) => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        signal.addEventListener('abort', () => reject(error), { once: true });
    });
}

test('starting a new session aborts and invalidates the previous request scope', async () => {
    const scope = createAbortScope();
    scope.start();
    const previous = scope.capture();
    const pending = delayedRequest(previous.signal);

    scope.start();

    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(previous.signal.aborted, true);
    assert.equal(previous.isActive(), false);
    assert.equal(scope.capture().isActive(), true);
});

test('stopping a session aborts active work and leaves no capturable scope', async () => {
    const scope = createAbortScope();
    scope.start();
    const active = scope.capture();
    const pending = delayedRequest(active.signal);

    scope.stop();

    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(active.isActive(), false);
    assert.equal(scope.capture(), null);
});

test('hosted Text, STT and Vision share the session abort signal', () => {
    const mainSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const rendererSource = fs.readFileSync(require.resolve('../src/utils/renderer'), 'utf8');
    const closeSession = mainSource.slice(mainSource.indexOf("ipcMain.handle('close-session'"));
    const signalUses = mainSource.match(/signal: requestContext\.signal/g) || [];

    assert.equal(signalUses.length, 3);
    assert.ok(mainSource.includes('function queueGroqText(text, requestContext = getHostedRequestContext())'));
    assert.ok(closeSession.includes('hostedRequestScope.stop()'));
    assert.ok(closeSession.indexOf('hostedRequestScope.stop()') < closeSession.indexOf('currentGroqSession = null'));
    assert.equal((rendererSource.match(/else if \(!result\.aborted\)/g) || []).length, 2);
});
