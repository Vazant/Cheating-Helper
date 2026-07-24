const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { GROQ_MODEL_CAPABILITIES, getGroqFallbackOrder, getGroqTextRequestOptions, getGroqVisionRequestOptions } = require('../src/utils/groq');

test('automatic text fallback stays inside the selected model family', () => {
    assert.deepEqual(getGroqFallbackOrder('openai/gpt-oss-120b'), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    assert.deepEqual(getGroqFallbackOrder('openai/gpt-oss-20b'), ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);
    assert.deepEqual(getGroqFallbackOrder('qwen/qwen3.6-27b'), ['qwen/qwen3.6-27b']);
    assert.equal(GROQ_MODEL_CAPABILITIES['qwen/qwen3.6-27b'].preview, true);
});

test('model-specific builders cannot mix GPT-OSS and Qwen reasoning parameters', () => {
    const gptOss = getGroqTextRequestOptions('openai/gpt-oss-120b', 1200);
    assert.equal(gptOss.reasoning_effort, 'low');
    assert.equal(gptOss.include_reasoning, false);
    assert.equal(gptOss.reasoning_format, undefined);
    assert.equal(gptOss.max_completion_tokens, 1200);

    const qwen = getGroqTextRequestOptions('qwen/qwen3.6-27b', 1200);
    assert.equal(qwen.reasoning_effort, 'none');
    assert.equal(qwen.reasoning_format, 'hidden');
    assert.equal(qwen.include_reasoning, undefined);
    assert.equal(qwen.temperature, 0.7);
    assert.equal(qwen.top_p, 0.8);

    assert.throws(() => getGroqTextRequestOptions('unknown', 1200), /Unsupported/);
});

test('vision uses the current completion parameter and remains separate from text fallback', () => {
    const vision = getGroqVisionRequestOptions();
    assert.equal(vision.max_completion_tokens, 2048);
    assert.equal(vision.reasoning_effort, 'none');
    assert.equal(vision.reasoning_format, 'hidden');

    const runtime = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const settings = fs.readFileSync(require.resolve('../src/components/views/CustomizeView'), 'utf8');
    assert.ok(runtime.includes('getGroqVisionRequestOptions()'));
    assert.ok(!runtime.includes('max_tokens: 2048'));
    assert.ok(settings.includes('Qwen 3.6 27B — Preview (explicit only)'));
});
