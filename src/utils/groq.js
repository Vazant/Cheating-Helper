const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_MODELS = [DEFAULT_GROQ_MODEL, 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];

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
    if (status === 429) {
        const details = formatGroqRateLimits(rateLimits);
        return `Groq rate limit reached for ${model}${details ? `; ${details}` : ''}`;
    }
    if (status >= 500) return `Groq service error (${status}); please try again later`;
    return `Groq error (${status}): ${errorMessage}`;
}

function readGroqSseEvent(data) {
    if (data === '[DONE]') return { done: true, content: '', finishReason: null };
    try {
        const choice = JSON.parse(data).choices?.[0];
        return { done: false, content: choice?.delta?.content || '', finishReason: choice?.finish_reason || null };
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

module.exports = {
    DEFAULT_GROQ_MODEL,
    GROQ_MODELS,
    getGroqFallbackOrder,
    readGroqRateLimits,
    getUsedRatio,
    isNearRateLimit,
    getGroqFallbackDecision,
    getNextGroqKeyIndex,
    formatGroqRateLimits,
    getGroqErrorStatus,
    readGroqSseEvent,
    createSseParser,
};
