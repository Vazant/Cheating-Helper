const assert = require('assert');
const fs = require('fs');
const {
    DEFAULT_GROQ_MODEL,
    getGroqFallbackOrder,
    getGroqTextRequestOptions,
    getGroqVisionRequestOptions,
    readGroqRateLimits,
    getUsedRatio,
    isNearRateLimit,
    getGroqFallbackDecision,
    getNextGroqKeyIndex,
    getGroqErrorStatus,
    estimateTextTokens,
    buildGroqRequestPlan,
    normalizeGroqUsage,
    readGroqSseEvent,
    createSseParser,
} = require('../src/utils/groq');

assert.deepStrictEqual(getGroqFallbackOrder('openai/gpt-oss-20b'), ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);
assert.deepStrictEqual(getGroqFallbackOrder('qwen/qwen3.6-27b'), ['qwen/qwen3.6-27b']);
assert.strictEqual(getGroqFallbackOrder('retired/model')[0], DEFAULT_GROQ_MODEL);
assert.deepStrictEqual(getGroqTextRequestOptions(DEFAULT_GROQ_MODEL, 2048), {
    temperature: 0.7,
    reasoning_effort: 'low',
    include_reasoning: false,
    max_completion_tokens: 2048,
});
assert.deepStrictEqual(getGroqTextRequestOptions('qwen/qwen3.6-27b', 1024), {
    temperature: 0.7,
    top_p: 0.8,
    top_k: 20,
    min_p: 0,
    presence_penalty: 1.5,
    reasoning_effort: 'none',
    reasoning_format: 'hidden',
    max_completion_tokens: 1024,
});
assert.throws(() => getGroqTextRequestOptions('retired/model', 1024), /Unsupported/);
assert.deepStrictEqual(getGroqVisionRequestOptions(1024), {
    temperature: 1,
    top_p: 1,
    reasoning_effort: 'none',
    reasoning_format: 'hidden',
    max_completion_tokens: 1024,
});

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
assert.deepStrictEqual(
    planned.messages.map(message => message.content),
    ['system', 'recent question', 'recent answer', 'current question']
);
assert.deepStrictEqual(normalizeGroqUsage({ prompt_tokens: 10, completion_tokens: null }), {
    promptTokens: 10,
    completionTokens: null,
    totalTokens: null,
    cachedTokens: null,
});
assert.ok(planned.maxCompletionTokens <= 2048 && planned.maxCompletionTokens >= 1024);
const noHistory = buildGroqRequestPlan('system', history, { conversationContextEnabled: false, conversationContextCount: 20 });
assert.deepStrictEqual(
    noHistory.messages.map(message => message.content),
    ['system', 'current question']
);
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
assert.deepStrictEqual(
    normalizeGroqUsage({
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 96 },
        ignored: 'not retained',
    }),
    { promptTokens: 120, completionTokens: 30, totalTokens: 150, cachedTokens: 96 }
);
assert.strictEqual(normalizeGroqUsage({ ignored: true }), null);
assert.deepStrictEqual(readGroqSseEvent('{"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}'), {
    done: false,
    content: '',
    finishReason: null,
    usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15, cachedTokens: null },
});

const geminiSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
const sendToGroqSource = geminiSource.slice(geminiSource.indexOf('async function sendToGroq'), geminiSource.indexOf('async function sendGroqImage'));
assert.strictEqual((geminiSource.match(/sendToGemma\(/g) || []).length, 1);
assert.strictEqual((geminiSource.match(/sendToGroq\(/g) || []).length, 3);
assert.ok(geminiSource.includes('Groq API key required for text responses'));
assert.ok(geminiSource.includes("ipcMain.handle('initialize-gemini', async () =>"));
assert.ok(geminiSource.includes('Gemini initialization is temporarily disabled'));
assert.ok(geminiSource.includes('getGroqTextRequestOptions(model, requestPlan.maxCompletionTokens)'));
assert.ok(geminiSource.includes('getGroqVisionRequestOptions()'));
assert.ok(geminiSource.includes('activateGroqApiKey(groqApiKey)'));
assert.ok(geminiSource.includes("finishReason === 'length'"));
assert.ok(!sendToGroqSource.includes('selectedProfile'));
assert.ok(geminiSource.includes('profile: { id: selectedProfile.id, name: selectedProfile.name }'));
assert.ok(geminiSource.includes("profile = 'interview', selectedLanguage = 'en-US'"));
assert.ok(geminiSource.includes('const language = getLanguageConfig(selectedLanguage)'));

const rendererSource = fs.readFileSync(require.resolve('../src/utils/renderer'), 'utf8');
assert.ok(rendererSource.includes("initializeGroq(profile = 'interview', language = 'en-US')"));
assert.ok(rendererSource.includes("ipcRenderer.invoke('initialize-groq', profile, language)"));

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
assert.ok(appSource.includes('initializeGroq(this.selectedProfile, this.selectedLanguage)'));
assert.ok(appSource.includes('Active: ${this.activeProfileName'));

const { normalizeGroqApiKeys, normalizeGroqApiKeyIndex, orderGroqApiKeys } = require('../src/storage');
assert.deepStrictEqual(normalizeGroqApiKeys(undefined, ' legacy-key '), ['legacy-key']);
assert.deepStrictEqual(normalizeGroqApiKeys([], ' legacy-key '), ['legacy-key']);
assert.deepStrictEqual(normalizeGroqApiKeys([' first ', '', 'first', null, 'second']), ['first', 'second']);
assert.strictEqual(normalizeGroqApiKeyIndex(-1, 3), 0);
assert.strictEqual(normalizeGroqApiKeyIndex(9, 3), 2);
assert.deepStrictEqual(orderGroqApiKeys(['a', 'b', 'c'], 1), ['b', 'c', 'a']);

console.log('Groq helpers: OK');
