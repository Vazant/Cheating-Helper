const assert = require('assert');
const fs = require('fs');
const { createResponseId, createResponsePayload, createResponseUpdate } = require('../src/utils/responsePayload');

const id = createResponseId();
const first = createResponsePayload('First token', '  How are you?  ', id);
const update = createResponseUpdate('Complete answer', id);
assert.deepStrictEqual(first, { id, question: 'How are you?', answer: 'First token' });
assert.deepStrictEqual(update, { id, question: '', answer: 'Complete answer' });
assert.notStrictEqual(createResponseId(), id);

const appSource = fs.readFileSync(require.resolve('../src/components/app/CheatingDaddyApp'), 'utf8');
const viewSource = fs.readFileSync(require.resolve('../src/components/views/AssistantView'), 'utf8');
const geminiSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
const localSource = fs.readFileSync(require.resolve('../src/utils/localai'), 'utf8');
assert.ok(appSource.includes("this.responses.findIndex(item => item.id === update.id)"));
assert.ok(appSource.includes("question: update.question || current.question"));
assert.ok(viewSource.includes('class="question-container"'));
assert.ok(viewSource.includes('getCurrentQuestion()'));
assert.ok(geminiSource.includes('createResponsePayload(displayText, transcription, responseId)'));
assert.ok(localSource.includes('createResponsePayload(fullText, transcription, responseId)'));
assert.ok(geminiSource.includes("sendToRenderer('new-response', createResponsePayload(text))"));
assert.ok(localSource.includes("createResponsePayload(fullText, '', responseId)"));

console.log('Question and answer presentation contract: OK');
