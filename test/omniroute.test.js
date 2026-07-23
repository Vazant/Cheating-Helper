const assert = require('assert');
const fs = require('fs');
const {
    DEFAULT_OMNIROUTE_BASE_URL,
    DEFAULT_OMNIROUTE_MODEL,
    normalizeOmniRouteBaseUrl,
    normalizeOmniRouteModel,
    getOmniRouteChatUrl,
    buildOmniRouteChatRequest,
} = require('../src/utils/omniroute');

assert.strictEqual(normalizeOmniRouteBaseUrl(), DEFAULT_OMNIROUTE_BASE_URL);
assert.strictEqual(normalizeOmniRouteBaseUrl(' http://localhost:20128/v1/ '), 'http://localhost:20128/v1');
assert.strictEqual(normalizeOmniRouteBaseUrl('https://gateway.example/api/'), 'https://gateway.example/api');
assert.strictEqual(normalizeOmniRouteBaseUrl('file:///tmp/socket'), DEFAULT_OMNIROUTE_BASE_URL);
assert.strictEqual(normalizeOmniRouteBaseUrl('http://user:password@localhost:20128/v1'), DEFAULT_OMNIROUTE_BASE_URL);
assert.strictEqual(normalizeOmniRouteModel(' custom-combo '), 'custom-combo');
assert.strictEqual(normalizeOmniRouteModel(''), DEFAULT_OMNIROUTE_MODEL);
assert.strictEqual(getOmniRouteChatUrl('http://localhost:20128/v1/'), 'http://localhost:20128/v1/chat/completions');
const request = buildOmniRouteChatRequest('http://localhost:20128/v1', 'token', ' auto ', [{ role: 'user', content: 'hello' }], 1024);
assert.strictEqual(request.url, 'http://localhost:20128/v1/chat/completions');
assert.strictEqual(request.options.headers.Authorization, 'Bearer token');
assert.deepStrictEqual(JSON.parse(request.options.body), {
    model: 'auto',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    temperature: 0.7,
    max_completion_tokens: 1024,
});
assert.strictEqual(buildOmniRouteChatRequest(undefined, '', 'auto', [], 1).options.headers.Authorization, undefined);

const geminiSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
const omniSource = geminiSource.slice(geminiSource.indexOf('async function sendToOmniRoute'), geminiSource.indexOf('async function sendGroqImage'));
assert.ok(omniSource.includes('buildOmniRouteChatRequest'));
assert.ok(!omniSource.includes('getGroqFallbackOrder'));
assert.ok(!omniSource.includes('readGroqRateLimits'));
assert.ok(!omniSource.includes('activateGroqApiKey'));

console.log('OmniRoute text provider: OK');
