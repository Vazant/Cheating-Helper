let sequence = 0;

function createResponseId() {
    return `response-${Date.now()}-${++sequence}`;
}

function createResponsePayload(answer, question = '', id = null) {
    return {
        id: id || createResponseId(),
        question: typeof question === 'string' ? question.trim() : '',
        answer: typeof answer === 'string' ? answer : '',
    };
}

function createResponseUpdate(answer, id) {
    return createResponsePayload(answer, '', id);
}

module.exports = { createResponseId, createResponsePayload, createResponseUpdate };
