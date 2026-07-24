const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildGroqProfilePlan } = require('../src/utils/groq');
const { normalizeProfile } = require('../src/utils/aiProfiles');

test('context count keeps explicit zero and clamps the persisted range', () => {
    assert.equal(normalizeProfile({ name: 'Zero', behavior: { conversationContextCount: 0 }, prompt: {} }).behavior.conversationContextCount, 0);
    assert.equal(normalizeProfile({ name: 'High', behavior: { conversationContextCount: 99 }, prompt: {} }).behavior.conversationContextCount, 20);
    assert.equal(normalizeProfile({ name: 'Default', prompt: {} }).behavior.conversationContextCount, 6);
});

test('pre-start plan distinguishes estimates, limits and context policy', () => {
    assert.deepEqual(buildGroqProfilePlan('abcd', { conversationContextEnabled: true, conversationContextCount: 0 }, 'model-a', 8000), {
        model: 'model-a',
        contextEnabled: true,
        contextPairLimit: 0,
        promptCharacters: 4,
        estimatedPromptTokens: 2,
        provisionalTpmLimit: 8000,
        minimumAnswerTokens: 1024,
        maximumAnswerTokensBeforeQuestion: 2048,
    });
    assert.equal(buildGroqProfilePlan('prompt', { conversationContextEnabled: false, conversationContextCount: 20 }).contextPairLimit, 0);
});

test('profile editor and active session expose the context contract', () => {
    const editor = fs.readFileSync(require.resolve('../src/components/views/AICustomizeView'), 'utf8');
    const app = fs.readFileSync(require.resolve('../src/components/app/CheatingDaddyApp'), 'utf8');
    const runtime = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const renderer = fs.readFileSync(require.resolve('../src/utils/renderer'), 'utf8');

    for (const text of ['Conversation context', 'Remember earlier answers in this session', 'Maximum completed pairs', 'planAiProfile'])
        assert.ok(editor.includes(text), text);
    assert.ok(editor.includes('Editing this profile does not alter an active session'));
    assert.ok(runtime.includes('behavior: { ...selectedProfile.behavior }'));
    assert.ok(runtime.includes("sendToRenderer('groq-metric', safeMetric)"));
    assert.ok(renderer.includes("'storage:plan-ai-profile'"));
    for (const text of ['input est', 'output planned', 'cache', 'TTFT', 'TPM remaining']) assert.ok(app.includes(text), text);
});
