const assert = require('assert');
const fs = require('fs');
const {
    GROQ_VISION_MODEL,
    DEFAULT_OLLAMA_VISION_MODEL,
    normalizeVisionProvider,
    buildVisionPrompt,
    hasVisionCapability,
} = require('../src/utils/vision');

assert.strictEqual(GROQ_VISION_MODEL, 'qwen/qwen3.6-27b');
assert.strictEqual(DEFAULT_OLLAMA_VISION_MODEL, 'qwen3-vl:4b');
assert.strictEqual(normalizeVisionProvider('ollama'), 'ollama');
assert.strictEqual(normalizeVisionProvider('disabled'), 'disabled');
assert.strictEqual(normalizeVisionProvider('unknown'), 'groq');
assert.strictEqual(hasVisionCapability({ capabilities: ['completion', 'vision'] }), true);
assert.strictEqual(hasVisionCapability({ capabilities: ['completion'] }), false);
assert.strictEqual(hasVisionCapability({}), false);

const history = [
    { transcription: 'old', ai_response: 'old answer' },
    { transcription: 'recent one', ai_response: 'answer one' },
    { transcription: 'recent two', ai_response: 'answer two' },
];
const prompt = buildVisionPrompt('SCREEN', 'MANUAL', history, true);
assert.ok(prompt.startsWith('SCREEN'));
assert.ok(prompt.includes('MANUAL'));
assert.ok(!prompt.includes('old answer'));
assert.ok(prompt.includes('recent one'));
assert.ok(prompt.includes('recent two'));
assert.ok(!buildVisionPrompt('SCREEN', '', history, false).includes('Recent conversation'));

const geminiSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
assert.ok(geminiSource.includes("prefs.visionProvider === 'groq'"));
assert.ok(geminiSource.includes("prefs.visionProvider === 'ollama'"));
assert.ok(geminiSource.includes('Screenshot exceeds the 4 MB Vision limit'));
assert.ok(geminiSource.includes('data:image/jpeg;base64'));
assert.ok(!geminiSource.includes('getGroqFallbackOrder(prefs.groqVisionModel'));
assert.ok(geminiSource.includes('getGroqVisionRequestOptions()'));
assert.ok(!geminiSource.includes('max_tokens: 2048'));

const localSource = fs.readFileSync(require.resolve('../src/utils/localai'), 'utf8');
assert.ok(localSource.includes('client.show({ model: visionModel })'));
assert.ok(localSource.includes('hasVisionCapability(info)'));

const settingsSource = fs.readFileSync(require.resolve('../src/components/views/CustomizeView'), 'utf8');
for (const text of ['Vision Provider', 'Groq — Hosted quality', 'Ollama — Local/private', 'Screenshot Instruction', 'Refresh Ollama models']) {
    assert.ok(settingsSource.includes(text));
}

console.log('Vision settings and routing: OK');
