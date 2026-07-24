const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_MODELS = [DEFAULT_GROQ_MODEL, 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];
const DEFAULT_TPM_LIMIT = 8000;
const MAX_COMPLETION_TOKENS = 2048;
const MIN_COMPLETION_TOKENS = 1024;

function getGroqFallbackOrder(selectedModel) {
    const primary = GROQ_MODELS.includes(selectedModel) ? selectedModel : DEFAULT_GROQ_MODEL;
    return [primary, ...GROQ_MODELS.filter(model => model !== primary)];
}

function readGroqRateLimits(headers) {
    const readNumber = name => {
        const raw = headers?.get?.(name);
        if (raw === null || raw === undefined || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) && value >= 0 ? value : null;
    };

    return {
        requests: {
            limit: readNumber('x-ratelimit-limit-requests'),
            remaining: readNumber('x-ratelimit-remaining-requests'),
            reset: headers?.get?.('x-ratelimit-reset-requests') || null,
        },
        tokens: {
            limit: readNumber('x-ratelimit-limit-tokens'),
            remaining: readNumber('x-ratelimit-remaining-tokens'),
            reset: headers?.get?.('x-ratelimit-reset-tokens') || null,
        },
        retryAfter: headers?.get?.('retry-after') || null,
    };
}

function getUsedRatio(metric) {
    if (!metric || metric.limit === null || metric.remaining === null || metric.limit <= 0) return null;
    return (metric.limit - Math.min(metric.limit, metric.remaining)) / metric.limit;
}

function isNearRateLimit(metric) {
    const usedRatio = getUsedRatio(metric);
    return usedRatio !== null && usedRatio >= 0.95;
}

function getGroqFallbackDecision(status, hasNext) {
    if (!hasNext) return null;
    if (status === 404) return 'not-found';
    return null;
}

function getNextGroqKeyIndex(status, currentIndex, keyCount) {
    return status === 429 && currentIndex + 1 < keyCount ? currentIndex + 1 : null;
}

function formatGroqRateLimits(rateLimits) {
    const parts = [];
    for (const [label, metric] of [
        ['RPD', rateLimits?.requests],
        ['TPM', rateLimits?.tokens],
    ]) {
        if (metric?.remaining !== null && metric?.limit !== null) parts.push(`${label} ${metric.remaining}/${metric.limit} remaining`);
        if (metric?.reset) parts.push(`${label} reset ${metric.reset}`);
    }
    if (rateLimits?.retryAfter) parts.push(`retry-after ${rateLimits.retryAfter}`);
    return parts.join('; ');
}

function getGroqErrorStatus(status, model, rateLimits, errorMessage) {
    if (status === 401 || status === 403) return `Groq key or permission error (${status}): ${errorMessage}`;
    if (status === 404) return `Groq model unavailable: ${model}`;
    if (status === 413) return `Groq request is too large for ${model}; reduce the AI Profile or conversation context`;
    if (status === 429) {
        const details = formatGroqRateLimits(rateLimits);
        return `Groq rate limit reached for ${model}${details ? `; ${details}` : ''}`;
    }
    if (status >= 500) return `Groq service error (${status}); please try again later`;
    return `Groq error (${status}): ${errorMessage}`;
}

function estimateTextTokens(value) {
    let ascii = 0;
    let cyrillic = 0;
    let other = 0;
    for (const character of String(value || '')) {
        const codePoint = character.codePointAt(0);
        if (codePoint <= 0x7f) ascii++;
        else if ((codePoint >= 0x0400 && codePoint <= 0x052f) || (codePoint >= 0x2de0 && codePoint <= 0x2dff)) cyrillic++;
        else other++;
    }
    return Math.ceil(ascii / 3 + cyrillic / 2 + other);
}

function estimateMessagesTokens(messages) {
    return (messages || []).reduce((total, message) => total + estimateTextTokens(message?.content), 32 + (messages || []).length * 12);
}

function buildGroqRequestPlan(systemPrompt, history, behavior = {}, tokenLimit = DEFAULT_TPM_LIMIT) {
    const source = Array.isArray(history) ? history : [];
    const currentTurn = source[source.length - 1];
    if (!currentTurn || currentTurn.role !== 'user') return { error: 'Current user message is missing' };

    const completed = source.slice(0, -1);
    const pairCount = behavior.conversationContextEnabled === false ? 0 : Math.max(0, Math.min(Number(behavior.conversationContextCount) || 0, 20));
    let retained = pairCount ? completed.slice(-pairCount * 2) : [];
    const usableTokens = Math.floor(Math.max(Number(tokenLimit) || DEFAULT_TPM_LIMIT, MIN_COMPLETION_TOKENS) * 0.95) - 128;

    let messages;
    let inputTokens;
    while (true) {
        messages = [{ role: 'system', content: systemPrompt || 'You are a helpful assistant.' }, ...retained, currentTurn];
        inputTokens = estimateMessagesTokens(messages);
        if (inputTokens + MIN_COMPLETION_TOKENS <= usableTokens || retained.length < 2) break;
        retained = retained.slice(2);
    }

    const maxCompletionTokens = Math.min(MAX_COMPLETION_TOKENS, usableTokens - inputTokens);
    if (maxCompletionTokens < MIN_COMPLETION_TOKENS) {
        return {
            error: `Request exceeds the Groq TPM budget (${inputTokens} estimated input tokens; ${MIN_COMPLETION_TOKENS} required for the answer)`,
            inputTokens,
            usableTokens,
        };
    }

    return { messages, inputTokens, maxCompletionTokens, trimmedMessages: completed.length - retained.length };
}

function normalizeGroqUsage(usage) {
    if (!usage || typeof usage !== 'object') return null;
    const number = value => (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null);
    const normalized = {
        promptTokens: number(usage.prompt_tokens ?? usage.promptTokens),
        completionTokens: number(usage.completion_tokens ?? usage.completionTokens),
        totalTokens: number(usage.total_tokens ?? usage.totalTokens),
        cachedTokens: number(usage.prompt_tokens_details?.cached_tokens ?? usage.cachedTokens),
    };
    return Object.values(normalized).some(value => value !== null) ? normalized : null;
}

function readGroqSseEvent(data) {
    if (data === '[DONE]') return { done: true, content: '', finishReason: null };
    try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const usage = normalizeGroqUsage(parsed.usage);
        return {
            done: false,
            content: choice?.delta?.content || '',
            finishReason: choice?.finish_reason || null,
            ...(usage ? { usage } : {}),
        };
    } catch {
        return null;
    }
}

function createSseParser(onData) {
    let buffer = '';

    return {
        push(chunk) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                const normalized = line.replace(/\r$/, '');
                if (normalized.startsWith('data:')) onData(normalized.slice(5).trimStart());
            }
        },
        end() {
            const normalized = buffer.replace(/\r$/, '');
            if (normalized.startsWith('data:')) onData(normalized.slice(5).trimStart());
            buffer = '';
        },
    };
}

function createAbortScope() {
    let controller = null;
    return {
        start() {
            controller?.abort();
            controller = new AbortController();
        },
        stop() {
            controller?.abort();
            controller = null;
        },
        capture() {
            const captured = controller;
            if (!captured) return null;
            return {
                signal: captured.signal,
                isActive: () => controller === captured && !captured.signal.aborted,
            };
        },
    };
}

function markIncompleteResponse(text, reason) {
    const label = reason === 'length' ? 'token limit reached' : 'stream interrupted';
    return `${String(text || '').trim()}\n\n[INCOMPLETE RESPONSE: ${label}]`;
}

module.exports = {
    DEFAULT_GROQ_MODEL,
    GROQ_MODELS,
    DEFAULT_TPM_LIMIT,
    MAX_COMPLETION_TOKENS,
    MIN_COMPLETION_TOKENS,
    getGroqFallbackOrder,
    readGroqRateLimits,
    getUsedRatio,
    isNearRateLimit,
    getGroqFallbackDecision,
    getNextGroqKeyIndex,
    formatGroqRateLimits,
    getGroqErrorStatus,
    estimateTextTokens,
    estimateMessagesTokens,
    buildGroqRequestPlan,
    normalizeGroqUsage,
    readGroqSseEvent,
    createSseParser,
    createAbortScope,
    markIncompleteResponse,
};
