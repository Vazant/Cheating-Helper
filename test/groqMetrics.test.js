const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { normalizeGroqUsage } = require('../src/utils/groq');

test('usage normalization keeps only numeric token counters', () => {
    assert.deepEqual(
        normalizeGroqUsage({
            prompt_tokens: 400,
            completion_tokens: 80,
            total_tokens: 480,
            prompt_tokens_details: { cached_tokens: 320 },
            prompt: 'must not survive',
        }),
        {
            promptTokens: 400,
            completionTokens: 80,
            totalTokens: 480,
            cachedTokens: 320,
        }
    );
    assert.equal(normalizeGroqUsage(null), null);
    assert.equal(normalizeGroqUsage({ prompt_tokens: 'invalid' }), null);
    assert.deepEqual(normalizeGroqUsage({ prompt_tokens: 12, completion_tokens: null }), {
        promptTokens: 12,
        completionTokens: null,
        totalTokens: null,
        cachedTokens: null,
    });
});

test('session metrics are reset, bounded and exposed without conversation content', () => {
    const source = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const recorder = source.slice(source.indexOf('function recordGroqMetric'), source.indexOf('// Build context message'));

    assert.ok(source.includes('groqRequestMetrics = [];'));
    assert.ok(source.includes('groqMetrics: groqRequestMetrics'));
    assert.ok(source.includes('groqRequestMetrics.length > 100'));
    assert.ok(!recorder.includes('transcription'));
    assert.ok(!recorder.includes('aiResponse'));
    assert.ok(!recorder.includes('systemPrompt'));
    assert.ok(!recorder.includes('groqApiKey'));
});

test('Text, STT and Vision emit the same safe metric contract', () => {
    const source = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');

    for (const stage of ['text', 'stt', 'vision']) assert.ok(source.includes(`stage: '${stage}'`));
    for (const field of [
        'estimatedInputTokens',
        'includedPairs',
        'trimmedMessages',
        'plannedCompletionTokens',
        'finishReason',
        'rateLimits',
        'usage',
    ]) {
        assert.ok(source.includes(field), field);
    }
    assert.ok(!source.includes("console.log('Saved conversation turn:', conversationTurn)"));
});
