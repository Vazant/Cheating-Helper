const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createGroqKeyActivationCoordinator, getNextGroqKeyIndex } = require('../src/utils/groq');

test('newer successful requests cannot be overwritten by older completions', () => {
    const activated = [];
    const coordinator = createGroqKeyActivationCoordinator(key => {
        activated.push(key);
        return true;
    });
    const older = coordinator.begin(() => true);
    const newer = coordinator.begin(() => true);

    assert.equal(coordinator.activate('key-2', newer), true);
    assert.equal(coordinator.activate('key-1', older), false);
    assert.deepEqual(activated, ['key-2']);
});

test('each request activates at most once and stopped sessions never activate', () => {
    const activated = [];
    const coordinator = createGroqKeyActivationCoordinator(key => {
        activated.push(key);
        return true;
    });
    const first = coordinator.begin(() => true);
    const stopped = coordinator.begin(() => false);

    assert.equal(coordinator.activate('key-1', first), true);
    assert.equal(coordinator.activate('key-1', first), false);
    assert.equal(coordinator.activate('key-2', stopped), false);
    assert.deepEqual(activated, ['key-1']);
});

test('key attempts remain bounded to 429 and all roles use the same coordinator', () => {
    assert.equal(getNextGroqKeyIndex(429, 0, 2), 1);
    assert.equal(getNextGroqKeyIndex(429, 1, 2), null);
    for (const status of [401, 403, 404, 413, 500, 503]) assert.equal(getNextGroqKeyIndex(status, 0, 2), null);

    const runtime = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const mainView = fs.readFileSync(require.resolve('../src/components/views/MainView'), 'utf8');
    assert.equal((runtime.match(/groqKeyActivation\.begin/g) || []).length, 3);
    assert.equal((runtime.match(/groqKeyActivation\.activate/g) || []).length, 3);
    assert.ok(runtime.includes('groqKeyActivation.reset()'));
    assert.ok(mainView.includes('adding keys does not multiply it'));
});
