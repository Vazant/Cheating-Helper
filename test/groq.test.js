const assert = require('assert');
const fs = require('fs');
const {
    DEFAULT_GROQ_MODEL,
    getGroqFallbackOrder,
    readGroqRateLimits,
    getUsedRatio,
    isNearRateLimit,
    getGroqFallbackDecision,
    getNextGroqKeyIndex,
    getGroqErrorStatus,
    estimateTextTokens,
    buildGroqRequestPlan,
    readGroqSseEvent,
    createSseParser,
} = require('../src/utils/groq');

assert.deepStrictEqual(getGroqFallbackOrder('openai/gpt-oss-20b'), ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b']);
assert.strictEqual(getGroqFallbackOrder('retired/model')[0], DEFAULT_GROQ_MODEL);

const values = new Map([
    ['x-ratelimit-limit-requests', '1000'],
    ['x-ratelimit-remaining-requests', '50'],
    ['x-ratelimit-limit-tokens', '8000'],
    ['x-ratelimit-remaining-tokens', '399'],
    ['x-ratelimit-reset-requests', '2h'],
    ['retry-after', '3'],
]);
const limits = readGroqRateLimits({ get: name => values.get(name) ?? null });
assert.strictEqual(getUsedRatio(limits.requests), 0.95);
assert.strictEqual(getUsedRatio(limits.tokens), 0.950125);
assert.strictEqual(getUsedRatio({ limit: 100, remaining: 101 }), 0);
assert.strictEqual(getUsedRatio({ limit: 0, remaining: 0 }), null);
assert.strictEqual(isNearRateLimit({ limit: 10000, remaining: 501 }), false);
assert.strictEqual(isNearRateLimit({ limit: 10000, remaining: 500 }), true);
assert.strictEqual(readGroqRateLimits({ get: () => 'bad' }).requests.limit, null);
assert.strictEqual(readGroqRateLimits({ get: () => null }).requests.limit, null);

assert.strictEqual(getGroqFallbackDecision(404, true), 'not-found');
assert.strictEqual(getGroqFallbackDecision(404, false), null);
for (const status of [401, 403, 429, 500, 503]) assert.strictEqual(getGroqFallbackDecision(status, true), null);
assert.strictEqual(getNextGroqKeyIndex(429, 0, 3), 1);
assert.strictEqual(getNextGroqKeyIndex(429, 2, 3), null);
for (const status of [200, 401, 403, 404, 413, 500, 503]) assert.strictEqual(getNextGroqKeyIndex(status, 0, 3), null);

const status429 = getGroqErrorStatus(429, DEFAULT_GROQ_MODEL, limits, 'limited');
for (const detail of ['RPD 50/1000 remaining', 'RPD reset 2h', 'TPM 399/8000 remaining', 'retry-after 3']) assert.ok(status429.includes(detail));
assert.ok(getGroqErrorStatus(401, DEFAULT_GROQ_MODEL, limits, 'bad key').includes('key or permission error (401)'));
assert.ok(getGroqErrorStatus(403, DEFAULT_GROQ_MODEL, limits, 'blocked').includes('key or permission error (403)'));
assert.ok(getGroqErrorStatus(404, DEFAULT_GROQ_MODEL, limits, 'missing').includes(DEFAULT_GROQ_MODEL));
assert.ok(getGroqErrorStatus(413, DEFAULT_GROQ_MODEL, limits, 'large').includes('too large'));
assert.ok(getGroqErrorStatus(500, DEFAULT_GROQ_MODEL, limits, 'down').includes('service error (500)'));

assert.ok(estimateTextTokens('Ж'.repeat(300)) > estimateTextTokens('a'.repeat(300)));
const history = [
    { role: 'user', content: 'old question' },
    { role: 'assistant', content: 'old answer' },
    { role: 'user', content: 'recent question' },
    { role: 'assistant', content: 'recent answer' },
    { role: 'user', content: 'current question' },
];
const planned = buildGroqRequestPlan('system', history, { conversationContextEnabled: true, conversationContextCount: 1 });
assert.deepStrictEqual(planned.messages.map(message => message.content), ['system', 'recent question', 'recent answer', 'current question']);
assert.ok(planned.maxCompletionTokens <= 2048 && planned.maxCompletionTokens >= 1024);
const noHistory = buildGroqRequestPlan('system', history, { conversationContextEnabled: false, conversationContextCount: 20 });
assert.deepStrictEqual(noHistory.messages.map(message => message.content), ['system', 'current question']);
assert.ok(buildGroqRequestPlan('Ж'.repeat(20000), [{ role: 'user', content: 'question' }]).error);

const events = [];
const parser = createSseParser(data => events.push(data));
parser.push('data: {"choices":[{"delta":{"cont');
parser.push('ent":"hello"}}]}\r\n\r\ndata: [DO');
parser.push('NE]\n');
parser.end();
assert.deepStrictEqual(events, ['{"choices":[{"delta":{"content":"hello"}}]}', '[DONE]']);
assert.deepStrictEqual(readGroqSseEvent(events[0]), { done: false, content: 'hello', finishReason: null });
assert.deepStrictEqual(readGroqSseEvent('[DONE]'), { done: true, content: '', finishReason: null });
assert.deepStrictEqual(readGroqSseEvent('{"choices":[{"delta":{}}]}'), { done: false, content: '', finishReason: null });
assert.deepStrictEqual(readGroqSseEvent('{"choices":[{"delta":{},"finish_reason":"length"}]}'), {
    done: false,
    content: '',
    finishReason: 'length',
});
assert.strictEqual(readGroqSseEvent('not-json'), null);

const geminiSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
assert.strictEqual((geminiSource.match(/sendToGemma\(/g) || []).length, 1);
assert.strictEqual((geminiSource.match(/sendToGroq\(/g) || []).length, 3);
assert.ok(geminiSource.includes('Groq API key required for text responses'));
assert.ok(geminiSource.includes("ipcMain.handle('initialize-gemini', async () =>"));
assert.ok(geminiSource.includes('Gemini initialization is temporarily disabled'));
assert.ok(geminiSource.includes("reasoning_effort: 'low'"));
assert.ok(geminiSource.includes('include_reasoning: false'));
assert.ok(geminiSource.includes('max_completion_tokens: requestPlan.maxCompletionTokens'));
assert.ok(geminiSource.includes('activateGroqApiKey(groqApiKey)'));
assert.ok(geminiSource.includes("finishReason === 'length'"));

const { getSystemPrompt } = require('../src/utils/prompts');
const systemPrompt = getSystemPrompt('interview', '', false);
assert.ok(systemPrompt.includes('Use plain readable text'));
assert.ok(systemPrompt.includes('Do not bold ordinary words'));
assert.ok(systemPrompt.endsWith('Always finish the final sentence.'));
assert.ok(systemPrompt.includes('Always reply in English'));

const mainViewSource = fs.readFileSync(require.resolve('../src/components/views/MainView'), 'utf8');
assert.ok(!mainViewSource.includes('Gemini API Key'));
assert.ok(mainViewSource.includes('Add another key'));
assert.ok(mainViewSource.includes('Choose Groq or Ollama screenshot analysis in Settings'));

const appSource = fs.readFileSync(require.resolve('../src/components/app/CheatingDaddyApp'), 'utf8');
assert.ok(appSource.includes('initializeGroq'));
assert.ok(!appSource.includes('initializeGemini('));

const { normalizeGroqApiKeys, normalizeGroqApiKeyIndex, orderGroqApiKeys } = require('../src/storage');
assert.deepStrictEqual(normalizeGroqApiKeys(undefined, ' legacy-key '), ['legacy-key']);
assert.deepStrictEqual(normalizeGroqApiKeys([], ' legacy-key '), ['legacy-key']);
assert.deepStrictEqual(normalizeGroqApiKeys([' first ', '', 'first', null, 'second']), ['first', 'second']);
assert.strictEqual(normalizeGroqApiKeyIndex(-1, 3), 0);
assert.strictEqual(normalizeGroqApiKeyIndex(9, 3), 2);
assert.deepStrictEqual(orderGroqApiKeys(['a', 'b', 'c'], 1), ['b', 'c', 'a']);

console.log('Groq helpers: OK');
