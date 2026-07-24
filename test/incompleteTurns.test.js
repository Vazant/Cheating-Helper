const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildGroqRequestPlan, markIncompleteResponse } = require('../src/utils/groq');

test('incomplete responses carry an explicit model-context marker', () => {
    assert.equal(markIncompleteResponse('Partial answer', 'length'), 'Partial answer\n\n[INCOMPLETE RESPONSE: token limit reached]');
    assert.equal(markIncompleteResponse('Partial answer', 'stream-error'), 'Partial answer\n\n[INCOMPLETE RESPONSE: stream interrupted]');
});

test('the next request retains the marked incomplete pair as context', () => {
    const marked = markIncompleteResponse('Partial answer', 'length');
    const plan = buildGroqRequestPlan(
        'system',
        [
            { role: 'user', content: 'Long question' },
            { role: 'assistant', content: marked },
            { role: 'user', content: 'Continue from the missing part' },
        ],
        { conversationContextEnabled: true, conversationContextCount: 6 }
    );

    assert.deepEqual(plan.messages, [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'Long question' },
        { role: 'assistant', content: marked },
        { role: 'user', content: 'Continue from the missing part' },
    ]);
});

test('runtime and History distinguish complete and incomplete turns', () => {
    const mainSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
    const historySource = fs.readFileSync(require.resolve('../src/components/views/HistoryView'), 'utf8');

    assert.ok(mainSource.includes("saveConversationTurn(transcription, partialResponse, { status: 'incomplete', reason: 'stream-error' })"));
    assert.ok(mainSource.includes("saveConversationTurn(transcription, cleanedResponse, { status: 'incomplete', reason: 'length' })"));
    assert.ok(mainSource.includes('_Response interrupted before completion._'));
    assert.ok(historySource.includes("status: turn.status || 'complete'"));
    assert.ok(historySource.includes("msg.status !== 'complete'"));
});
