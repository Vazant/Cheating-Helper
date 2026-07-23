const DEFAULT_OMNIROUTE_BASE_URL = 'http://127.0.0.1:20128/v1';
const DEFAULT_OMNIROUTE_MODEL = 'auto';

function normalizeOmniRouteBaseUrl(value) {
    const candidate = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_OMNIROUTE_BASE_URL;
    try {
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        url.pathname = url.pathname.replace(/\/+$/, '') || '/v1';
        return url.toString().replace(/\/$/, '');
    } catch {
        return DEFAULT_OMNIROUTE_BASE_URL;
    }
}

function normalizeOmniRouteModel(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_OMNIROUTE_MODEL;
}

function getOmniRouteChatUrl(baseUrl) {
    return `${normalizeOmniRouteBaseUrl(baseUrl)}/chat/completions`;
}

function buildOmniRouteChatRequest(baseUrl, apiKey, model, messages, maxCompletionTokens) {
    return {
        url: getOmniRouteChatUrl(baseUrl),
        options: {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                model: normalizeOmniRouteModel(model),
                messages,
                stream: true,
                temperature: 0.7,
                max_completion_tokens: maxCompletionTokens,
            }),
        },
    };
}

module.exports = {
    DEFAULT_OMNIROUTE_BASE_URL,
    DEFAULT_OMNIROUTE_MODEL,
    normalizeOmniRouteBaseUrl,
    normalizeOmniRouteModel,
    getOmniRouteChatUrl,
    buildOmniRouteChatRequest,
};
