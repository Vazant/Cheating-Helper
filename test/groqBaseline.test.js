const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildGroqRequestPlan, createSseParser, getGroqFallbackDecision, getNextGroqKeyIndex, readGroqSseEvent } = require('../src/utils/groq');
const { SENIOR_JAVA_PROFILE, compileProfile, createBuiltInProfiles, normalizeProfile } = require('../src/utils/aiProfiles');
const { profilePrompts } = require('../src/utils/prompts');

function conversation(pairCount, content = index => `message-${index}`) {
    const messages = [];
    for (let index = 1; index <= pairCount; index++) {
        messages.push({ role: 'user', content: `question-${index}-${content(index)}` });
        messages.push({ role: 'assistant', content: `answer-${index}-${content(index)}` });
    }
    messages.push({ role: 'user', content: 'current-question' });
    return messages;
}

function mockedFetch(chunks) {
    return async () => {
        let index = 0;
        return {
            ok: true,
            body: {
                getReader: () => ({
                    read: async () => (index < chunks.length ? { done: false, value: Buffer.from(chunks[index++]) } : { done: true }),
                }),
            },
        };
    };
}

async function readMockedStream(fetch) {
    const response = await fetch();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events = [];
    const parser = createSseParser(data => events.push(readGroqSseEvent(data)));

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.end();
    return events;
}

test('active-session follow-ups keep exact completed pairs in order', () => {
    const history = conversation(2);
    const plan = buildGroqRequestPlan('stable-system', history, {
        conversationContextEnabled: true,
        conversationContextCount: 6,
    });

    assert.deepEqual(plan.messages, [{ role: 'system', content: 'stable-system' }, ...history]);
    assert.equal(plan.trimmedMessages, 0);
});

test('context controls retain only the newest complete pairs', () => {
    const history = conversation(8);
    const plan = buildGroqRequestPlan('system', history, {
        conversationContextEnabled: true,
        conversationContextCount: 6,
    });

    assert.deepEqual(
        plan.messages.map(message => message.content),
        [
            'system',
            'question-3-message-3',
            'answer-3-message-3',
            'question-4-message-4',
            'answer-4-message-4',
            'question-5-message-5',
            'answer-5-message-5',
            'question-6-message-6',
            'answer-6-message-6',
            'question-7-message-7',
            'answer-7-message-7',
            'question-8-message-8',
            'answer-8-message-8',
            'current-question',
        ]
    );
    assert.equal(plan.trimmedMessages, 4);

    const disabled = buildGroqRequestPlan('system', history, {
        conversationContextEnabled: false,
        conversationContextCount: 20,
    });
    assert.deepEqual(disabled.messages, [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'current-question' },
    ]);
});

test('TPM trimming removes oldest messages in complete pairs and keeps the current question', () => {
    const history = conversation(8, () => 'Ж'.repeat(600));
    const plan = buildGroqRequestPlan(
        'system',
        history,
        {
            conversationContextEnabled: true,
            conversationContextCount: 8,
        },
        4000
    );

    assert.equal(plan.error, undefined);
    assert.ok(plan.trimmedMessages > 0);
    assert.equal(plan.trimmedMessages % 2, 0);
    assert.equal(plan.messages.at(-1).content, 'current-question');
    assert.equal(plan.messages[1].role, 'user');
    for (let index = 1; index < plan.messages.length - 1; index += 2) {
        assert.equal(plan.messages[index].role, 'user');
        assert.equal(plan.messages[index + 1].role, 'assistant');
    }
});

test('the planner rejects malformed and oversized current requests before fetch', () => {
    assert.match(buildGroqRequestPlan('system', []).error, /Current user message/);
    assert.match(buildGroqRequestPlan('Ж'.repeat(20000), [{ role: 'user', content: 'current' }]).error, /TPM budget/);
});

test('mocked SSE response preserves split chunks, finish reason and final marker', async () => {
    const events = await readMockedStream(
        mockedFetch([
            'data: {"choices":[{"delta":{"cont',
            'ent":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\r\n',
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n',
        ])
    );

    assert.equal(events.map(event => event?.content || '').join(''), 'Hello');
    assert.equal(events.find(event => event?.finishReason)?.finishReason, 'stop');
    assert.equal(events.at(-1).done, true);
});

test('model and key retry rules stay bounded by status', () => {
    assert.equal(getGroqFallbackDecision(404, true), 'not-found');
    assert.equal(getNextGroqKeyIndex(429, 0, 2), 1);
    assert.equal(getNextGroqKeyIndex(429, 1, 2), null);
    for (const status of [401, 403, 413, 500, 503]) {
        assert.equal(getGroqFallbackDecision(status, true), null);
        assert.equal(getNextGroqKeyIndex(status, 0, 2), null);
    }
});

test('compiled Groq profile baseline remains deterministic', () => {
    const profiles = [...createBuiltInProfiles(profilePrompts), SENIOR_JAVA_PROFILE];
    const sizes = Object.fromEntries(profiles.map(profile => [profile.id, compileProfile(profile, { language: 'en-US' }).length]));

    assert.deepEqual(sizes, {
        interview: 3207,
        sales: 2398,
        meeting: 2257,
        presentation: 2463,
        negotiation: 2504,
        exam: 2544,
        profile_senior_java_interview: 3514,
    });

    // Baseline defect for Block 6: an explicit zero currently normalizes back to six.
    assert.equal(
        normalizeProfile({ name: 'Zero context', behavior: { conversationContextCount: 0 }, prompt: {} }).behavior.conversationContextCount,
        6
    );
});

test('remaining runtime consistency gaps are explicit baseline contracts', () => {
    const source = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const sendToGroq = source.slice(source.indexOf('async function sendToGroq'), source.indexOf('async function sendGroqImage'));

    assert.ok(!sendToGroq.includes('prompt_tokens'));
    assert.ok(!sendToGroq.includes('cached_tokens'));
});
