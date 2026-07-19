const { GoogleGenAI, Modality } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const {
    getAvailableModel,
    incrementLimitCount,
    getApiKey,
    getGroqApiKeySequence,
    activateGroqApiKey,
    getPreferences,
    getAiProfile,
} = require('../storage');
const { connectCloud, sendCloudAudio, sendCloudText, sendCloudImage, closeCloud, isCloudActive, setOnTurnComplete } = require('./cloud');
const { GROQ_VISION_MODEL, buildVisionPrompt } = require('./vision');
const { getLanguageConfig } = require('./aiProfiles');
const { createSpeechSegmenter, encodePcm16Wav } = require('./audioPipeline');
const {
    getGroqFallbackOrder,
    readGroqRateLimits,
    getUsedRatio,
    isNearRateLimit,
    getGroqFallbackDecision,
    getNextGroqKeyIndex,
    getGroqErrorStatus,
    buildGroqRequestPlan,
    readGroqSseEvent,
    createSseParser,
} = require('./groq');

// Lazy-loaded to avoid circular dependency (localai.js imports from gemini.js)
let _localai = null;
function getLocalAi() {
    if (!_localai) _localai = require('./localai');
    return _localai;
}

// Provider mode: 'groq', 'cloud', or 'local'. Gemini is temporarily disabled.
let currentProviderMode = 'groq';

// Groq conversation history for context
let groqConversationHistory = [];
let groqLimitWarnings = new Set();
let isVisionRequestActive = false;
let currentGroqSession = null;
let hostedAudioSegmenter = null;
let hostedAudioSource = 'system';
let hostedAudioQueue = Promise.resolve();
let groqTextQueue = Promise.resolve();
let hostedUtteranceId = 0;
const pendingUtteranceIds = new Set();

function getAiProfileSnapshot(id) {
    return JSON.parse(JSON.stringify(getAiProfile(id)));
}

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let screenAnalysisHistory = [];
let currentProfile = null;
let currentCustomPrompt = null;
let isInitializingSession = false;
let currentSystemPrompt = null;

function formatSpeakerResults(results) {
    let text = '';
    for (const result of results) {
        if (result.transcript && result.speakerId) {
            const speakerLabel = result.speakerId === 1 ? 'Interviewer' : 'Candidate';
            text += `[${speakerLabel}]: ${result.transcript}\n`;
        }
    }
    return text;
}

module.exports.formatSpeakerResults = formatSpeakerResults;

// Audio capture variables
let systemAudioProc = null;
let messageBuffer = '';

// Reconnection variables
let isUserClosing = false;
let sessionParams = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Build context message for session restoration
function buildContextMessage() {
    const lastTurns = conversationHistory.slice(-20);
    const validTurns = lastTurns.filter(turn => turn.transcription?.trim() && turn.ai_response?.trim());

    if (validTurns.length === 0) return null;

    const contextLines = validTurns.map(turn => `[Interviewer]: ${turn.transcription.trim()}\n[Your answer]: ${turn.ai_response.trim()}`);

    return `Session reconnected. Here's the conversation so far:\n\n${contextLines.join('\n\n')}\n\nContinue from here.`;
}

// Conversation management functions
function initializeNewSession(profile = null, customPrompt = null, metadata = {}) {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    screenAnalysisHistory = [];
    groqConversationHistory = [];
    groqLimitWarnings.clear();
    currentProfile = profile;
    currentCustomPrompt = customPrompt;
    console.log('New conversation session started:', currentSessionId, 'profile:', profile);

    // Save initial session with profile context
    if (profile) {
        sendToRenderer('save-session-context', {
            sessionId: currentSessionId,
            profile: profile,
            profileName: metadata.profileName || null,
            language: metadata.language || null,
            customPrompt: customPrompt || '',
        });
    }
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function saveScreenAnalysis(prompt, response, model, provider = 'unknown') {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const analysisEntry = {
        timestamp: Date.now(),
        prompt: prompt,
        response: response.trim(),
        model,
        provider,
        pipeline: 'direct',
    };

    screenAnalysisHistory.push(analysisEntry);
    console.log('[Vision history]', { provider, model, pipeline: 'direct' });

    // Send to renderer to save
    sendToRenderer('save-screen-analysis', {
        sessionId: currentSessionId,
        analysis: analysisEntry,
        fullHistory: screenAnalysisHistory,
        profile: currentProfile,
        customPrompt: currentCustomPrompt,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

async function getEnabledTools() {
    const tools = [];

    // Check if Google Search is enabled (default: true)
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
    console.log('Google Search enabled:', googleSearchEnabled);

    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
        console.log('Added Google Search tool');
    } else {
        console.log('Google Search tool disabled');
    }

    return tools;
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

function trimConversationHistoryForGemma(history, maxChars = 42000) {
    if (!history || history.length === 0) return [];
    let totalChars = 0;
    const trimmed = [];

    for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        const turnChars = (turn.content || '').length;

        if (totalChars + turnChars > maxChars) break;
        totalChars += turnChars;
        trimmed.unshift(turn);
    }
    return trimmed;
}

function stripThinkingTags(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function recordGroqRateLimits(rateLimits, model, keySlot = 1) {
    for (const [name, metric] of Object.entries({ requests: rateLimits.requests, tokens: rateLimits.tokens })) {
        const usedRatio = getUsedRatio(metric);
        if (usedRatio === null) continue;
        const warningKey = `${keySlot}:${model}:${name}`;

        if (!isNearRateLimit(metric)) {
            groqLimitWarnings.delete(warningKey);
        } else if (!groqLimitWarnings.has(warningKey)) {
            groqLimitWarnings.add(warningKey);
            console.warn(
                `[Groq ${name === 'requests' ? 'RPD' : 'TPM'} warning] key ${keySlot}, ${model}: ${(usedRatio * 100).toFixed(1)}% used` +
                    (metric.reset ? `; resets in ${metric.reset}` : '')
            );
        }
    }
}

function readGroqError(errorText) {
    try {
        const parsed = JSON.parse(errorText);
        return {
            code: parsed.error?.code || null,
            message: parsed.error?.message || errorText,
        };
    } catch {
        return { code: null, message: errorText || 'Unknown Groq error' };
    }
}

function queueGroqText(text) {
    const queued = groqTextQueue.then(() => sendToGroq(text));
    groqTextQueue = queued.catch(error => {
        console.error('[Groq text queue]', error.message);
        sendToRenderer('update-status', `Groq request failed: ${error.message}`);
        return false;
    });
    return queued;
}

async function transcribeGroqAudio(wavBuffer, language) {
    const groqApiKeys = getGroqApiKeySequence();
    if (!groqApiKeys.length) return { success: false, error: 'Groq API key required for speech recognition' };

    for (let keyIndex = 0; keyIndex < groqApiKeys.length; keyIndex++) {
        const form = new FormData();
        form.append('model', 'whisper-large-v3-turbo');
        form.append('response_format', 'json');
        if (language?.code) form.append('language', language.code);
        form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'utterance.wav');

        let response;
        try {
            response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${groqApiKeys[keyIndex]}` },
                body: form,
            });
        } catch (error) {
            return { success: false, error: `Groq STT network error: ${error.message}` };
        }

        const rateLimits = readGroqRateLimits(response.headers);
        recordGroqRateLimits(rateLimits, 'whisper-large-v3-turbo', keyIndex + 1);
        if (response.ok) {
            const body = await response.json();
            const text = typeof body.text === 'string' ? body.text.trim() : '';
            if (!text) return { success: false, error: 'Groq STT returned an empty transcript' };
            activateGroqApiKey(groqApiKeys[keyIndex]);
            return { success: true, text };
        }

        const error = readGroqError(await response.text().catch(() => ''));
        if (response.status === 429 && keyIndex + 1 < groqApiKeys.length) continue;
        return { success: false, error: `Groq STT ${getGroqErrorStatus(response.status, 'whisper-large-v3-turbo', rateLimits, error.message)}` };
    }
    return { success: false, error: 'All configured Groq keys reached their speech recognition rate limit' };
}

async function processHostedUtterance(utteranceId, pcm16kBuffer) {
    if (!currentGroqSession) return false;
    if (pendingUtteranceIds.has(utteranceId)) return false;
    pendingUtteranceIds.add(utteranceId);
    try {
        sendToRenderer('update-status', 'Transcribing...');
        const result = await transcribeGroqAudio(encodePcm16Wav(pcm16kBuffer), currentGroqSession.language);
        if (!result.success) {
            console.error('[Groq STT error]', result.error);
            sendToRenderer('update-status', result.error);
            return false;
        }
        sendToRenderer('update-status', 'Answering...');
        return queueGroqText(result.text);
    } finally {
        pendingUtteranceIds.delete(utteranceId);
    }
}

function configureHostedAudio(audioMode) {
    hostedAudioSegmenter?.reset();
    hostedAudioSource = audioMode === 'mic_only' ? 'microphone' : 'system';
    hostedAudioQueue = Promise.resolve();
    hostedAudioSegmenter = createSpeechSegmenter({
        onUtterance(audio) {
            const utteranceId = ++hostedUtteranceId;
            hostedAudioQueue = hostedAudioQueue
                .then(() => processHostedUtterance(utteranceId, audio))
                .catch(error => {
                    console.error('[Hosted audio queue]', error.message);
                    sendToRenderer('update-status', `Audio processing failed: ${error.message}`);
                    return false;
                });
        },
    });
}

function processHostedAudioChunk(source, data, mimeType) {
    if (!hostedAudioSegmenter || source !== hostedAudioSource) return { success: true, ignored: true };
    if (mimeType !== 'audio/pcm;rate=24000' || typeof data !== 'string') return { success: false, error: 'Unsupported audio format' };
    const pcmBuffer = Buffer.from(data, 'base64');
    return processHostedPcmBuffer(source, pcmBuffer);
}

function processHostedPcmBuffer(source, pcmBuffer) {
    if (!hostedAudioSegmenter || source !== hostedAudioSource) return { success: true, ignored: true };
    if (!pcmBuffer.length || pcmBuffer.length % 2 || pcmBuffer.length > 24000 * 2) return { success: false, error: 'Invalid audio chunk' };
    hostedAudioSegmenter.push(pcmBuffer);
    return { success: true };
}

async function sendToGroq(transcription) {
    const requestReceivedAt = Date.now();
    const groqApiKeys = getGroqApiKeySequence();
    if (!groqApiKeys.length) {
        console.warn('A Groq API key is required for the selected hosted text model');
        sendToRenderer('update-status', 'Groq API key required for text responses');
        return false;
    }

    if (!transcription || transcription.trim() === '') {
        console.log('Empty transcription, skipping Groq');
        return false;
    }

    const models = getGroqFallbackOrder(currentGroqSession?.model);

    const userTurn = {
        role: 'user',
        content: transcription.trim(),
    };
    groqConversationHistory.push(userTurn);

    const removeUserTurn = () => {
        const index = groqConversationHistory.lastIndexOf(userTurn);
        if (index !== -1) groqConversationHistory.splice(index, 1);
    };

    const requestPlan = buildGroqRequestPlan(
        currentGroqSession?.systemPrompt || currentSystemPrompt,
        groqConversationHistory,
        currentGroqSession?.behavior,
        currentGroqSession?.tpmLimit
    );
    if (requestPlan.error) {
        removeUserTurn();
        console.warn('[Groq request budget]', requestPlan.error);
        sendToRenderer('update-status', requestPlan.error);
        return false;
    }
    if (requestPlan.trimmedMessages > 0) console.log(`[Groq request budget] trimmed ${requestPlan.trimmedMessages} old history messages`);

    let keyIndex = 0;

    for (let index = 0; index < models.length; index++) {
        const model = models[index];
        const groqApiKey = groqApiKeys[keyIndex];
        console.log(`Sending to Groq (${model}, key ${keyIndex + 1}/${groqApiKeys.length})`);

        let response;
        const fetchStartedAt = Date.now();
        try {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: requestPlan.messages,
                    stream: true,
                    temperature: 0.7,
                    ...(model.startsWith('openai/gpt-oss-')
                        ? { reasoning_effort: 'low', include_reasoning: false, max_completion_tokens: requestPlan.maxCompletionTokens }
                        : { max_completion_tokens: requestPlan.maxCompletionTokens }),
                }),
            });
        } catch (error) {
            removeUserTurn();
            console.error('Groq network error:', error);
            sendToRenderer('update-status', `Groq network error: ${error.message}`);
            return false;
        }

        const rateLimits = readGroqRateLimits(response.headers);
        const headersReceivedAt = Date.now();
        recordGroqRateLimits(rateLimits, model, keyIndex + 1);
        if (currentGroqSession && rateLimits.tokens.limit) currentGroqSession.tpmLimit = rateLimits.tokens.limit;

        if (!response.ok) {
            const error = readGroqError(await response.text().catch(() => ''));
            const nextModel = models[index + 1];
            const fallbackReason = getGroqFallbackDecision(response.status, Boolean(nextModel));

            console.error(
                '[Groq API error]',
                JSON.stringify({
                    event: 'groq_error',
                    provider: 'groq',
                    model,
                    status: response.status,
                    code: error.code,
                    keySlot: keyIndex + 1,
                    retryAfter: rateLimits.retryAfter,
                    requests: rateLimits.requests,
                    tokens: rateLimits.tokens,
                })
            );

            const nextKeyIndex = getNextGroqKeyIndex(response.status, keyIndex, groqApiKeys.length);
            if (nextKeyIndex !== null) {
                const previousKeySlot = keyIndex + 1;
                keyIndex = nextKeyIndex;
                console.warn(
                    '[Groq key rotation]',
                    JSON.stringify({
                        event: 'key_rotation',
                        provider: 'groq',
                        model,
                        fromKeySlot: previousKeySlot,
                        toKeySlot: keyIndex + 1,
                        status: response.status,
                        retryAfter: rateLimits.retryAfter,
                    })
                );
                sendToRenderer('update-status', `Groq quota reached for key ${previousKeySlot}; switching to key ${keyIndex + 1}`);
                index--;
                continue;
            }

            if (response.status === 429) {
                removeUserTurn();
                sendToRenderer('update-status', getGroqErrorStatus(response.status, model, rateLimits, error.message));
                return false;
            }

            if (fallbackReason) {
                console.warn(
                    '[Groq model fallback]',
                    JSON.stringify({
                        event: 'model_fallback',
                        provider: 'groq',
                        fromModel: model,
                        toModel: nextModel,
                        status: response.status,
                        code: error.code,
                        retryAfter: rateLimits.retryAfter,
                        requests: rateLimits.requests,
                        tokens: rateLimits.tokens,
                    })
                );
                sendToRenderer('update-status', `Groq ${model} failed (${response.status}); switching to ${nextModel}`);
                continue;
            }

            removeUserTurn();
            sendToRenderer('update-status', getGroqErrorStatus(response.status, model, rateLimits, error.message));
            return false;
        }

        activateGroqApiKey(groqApiKey);

        const reader = response.body?.getReader();
        if (!reader) {
            removeUserTurn();
            console.error('Groq response did not include a readable stream');
            sendToRenderer('update-status', 'Groq returned an unreadable response');
            return false;
        }

        const decoder = new TextDecoder();
        let fullText = '';
        let isFirst = true;
        let finishReason = null;
        let lastRenderAt = 0;
        let lastRenderedText = '';
        let firstContentAt = null;
        const parser = createSseParser(data => {
            const event = readGroqSseEvent(data);
            if (!event) {
                console.warn('Ignoring malformed Groq SSE event');
                return;
            }
            if (event.finishReason) finishReason = event.finishReason;
            if (event.done || !event.content) return;
            fullText += event.content;
            if (!firstContentAt) firstContentAt = Date.now();
            const displayText = stripThinkingTags(fullText);
            const now = Date.now();
            if (displayText && (isFirst || now - lastRenderAt >= 40)) {
                sendToRenderer(isFirst ? 'new-response' : 'update-response', displayText);
                isFirst = false;
                lastRenderAt = now;
                lastRenderedText = displayText;
            }
        });

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                parser.push(decoder.decode(value, { stream: true }));
            }
            parser.push(decoder.decode());
            parser.end();
        } catch (error) {
            removeUserTurn();
            console.error('Groq streaming error:', error);
            sendToRenderer('update-status', `Groq streaming error: ${error.message}`);
            return false;
        }

        const cleanedResponse = stripThinkingTags(fullText);
        if (!cleanedResponse) {
            removeUserTurn();
            console.error('[Groq protocol error]', JSON.stringify({ event: 'empty_response', provider: 'groq', model, status: response.status }));
            sendToRenderer('update-status', `Groq returned no response content (${model})`);
            return false;
        }
        if (cleanedResponse !== lastRenderedText) sendToRenderer(isFirst ? 'new-response' : 'update-response', cleanedResponse);
        const streamDoneAt = Date.now();
        console.log(
            '[Groq latency]',
            JSON.stringify({
                model,
                keySlot: keyIndex + 1,
                queueMs: fetchStartedAt - requestReceivedAt,
                headersMs: headersReceivedAt - fetchStartedAt,
                firstContentMs: firstContentAt ? firstContentAt - fetchStartedAt : null,
                streamMs: streamDoneAt - (firstContentAt || headersReceivedAt),
                totalMs: streamDoneAt - requestReceivedAt,
            })
        );

        groqConversationHistory.push({ role: 'assistant', content: cleanedResponse });
        saveConversationTurn(transcription, cleanedResponse);

        if (finishReason === 'length') {
            sendToRenderer('update-response', `${cleanedResponse}\n\n_Response stopped because the token limit was reached._`);
            sendToRenderer('update-status', 'Groq response stopped at the token limit');
            return true;
        }

        console.log(`Groq response completed (${model})`);
        sendToRenderer('update-status', 'Listening...');
        return true;
    }

    removeUserTurn();
    return false;
}

async function sendGroqImage(base64Data, prompt) {
    const groqApiKeys = getGroqApiKeySequence();
    if (!groqApiKeys.length) return { success: false, error: 'Groq API key required for screenshot analysis' };

    for (let keyIndex = 0; keyIndex < groqApiKeys.length; keyIndex++) {
        let response;
        try {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${groqApiKeys[keyIndex]}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: GROQ_VISION_MODEL,
                    messages: [
                        { role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
                            ],
                        },
                    ],
                    temperature: 0.2,
                    max_tokens: 2048,
                }),
            });
        } catch (error) {
            return { success: false, error: `Groq Vision network error: ${error.message}` };
        }

        const rateLimits = readGroqRateLimits(response.headers);
        recordGroqRateLimits(rateLimits, GROQ_VISION_MODEL, keyIndex + 1);

        if (response.ok) {
            const body = await response.json();
            const text = body.choices?.[0]?.message?.content?.trim();
            if (!text) return { success: false, error: 'Groq Vision returned an empty response' };
            activateGroqApiKey(groqApiKeys[keyIndex]);
            sendToRenderer('new-response', text);
            return { success: true, text, model: GROQ_VISION_MODEL };
        }

        const error = readGroqError(await response.text().catch(() => ''));
        console.error('[Groq Vision error]', {
            provider: 'groq',
            model: GROQ_VISION_MODEL,
            status: response.status,
            keySlot: keyIndex + 1,
        });
        if (response.status === 429 && keyIndex + 1 < groqApiKeys.length) {
            continue;
        }
        return { success: false, error: getGroqErrorStatus(response.status, GROQ_VISION_MODEL, rateLimits, error.message) };
    }

    return { success: false, error: 'All configured Groq keys reached their Vision rate limit' };
}

async function sendToGemma(transcription) {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.log('No Gemini API key configured');
        return;
    }

    if (!transcription || transcription.trim() === '') {
        console.log('Empty transcription, skipping Gemma');
        return;
    }

    console.log('Sending to Gemma:', transcription.substring(0, 100) + '...');

    groqConversationHistory.push({
        role: 'user',
        content: transcription.trim(),
    });

    const trimmedHistory = trimConversationHistoryForGemma(groqConversationHistory, 42000);

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const messages = trimmedHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const systemPrompt = currentSystemPrompt || 'You are a helpful assistant.';
        const messagesWithSystem = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
            ...messages,
        ];

        const response = await ai.models.generateContentStream({
            model: 'gemma-4-26b-a4b-it',
            contents: messagesWithSystem,
        });

        let fullText = '';
        let isFirst = true;

        for await (const chunk of response) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        if (fullText.trim()) {
            groqConversationHistory.push({
                role: 'assistant',
                content: fullText.trim(),
            });

            if (groqConversationHistory.length > 40) {
                groqConversationHistory = groqConversationHistory.slice(-40);
            }

            saveConversationTurn(transcription, fullText);
        }

        console.log('Gemma response completed');
        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('Error calling Gemma API:', error);
        sendToRenderer('update-status', 'Gemma error: ' + error.message);
    }
}

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnect = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    if (!isReconnect) {
        sendToRenderer('session-initializing', true);
    }

    // Store params for reconnection
    if (!isReconnect) {
        sessionParams = { apiKey, customPrompt, profile, language };
        reconnectAttempts = 0;
    }

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
    });

    // Get enabled tools first to determine Google Search status
    const enabledTools = await getEnabledTools();
    const googleSearchEnabled = enabledTools.some(tool => tool.googleSearch);

    const systemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled);
    currentSystemPrompt = systemPrompt; // Store for Groq

    // Initialize new conversation session only on first connect
    if (!isReconnect) {
        initializeNewSession(profile, customPrompt);
    }

    try {
        const session = await client.live.connect({
            model: 'gemini-3.1-flash-live-preview',
            callbacks: {
                onopen: function () {
                    sendToRenderer('update-status', 'Live session connected');
                },
                onmessage: function (message) {
                    console.log('----------------', message);

                    // Handle input transcription (what was spoken)
                    if (message.serverContent?.inputTranscription?.results) {
                        currentTranscription += formatSpeakerResults(message.serverContent.inputTranscription.results);
                    } else if (message.serverContent?.inputTranscription?.text) {
                        const text = message.serverContent.inputTranscription.text;
                        if (text.trim() !== '') {
                            currentTranscription += text;
                        }
                    }

                    // DISABLED: Gemini's outputTranscription - using Groq for faster responses instead
                    // if (message.serverContent?.outputTranscription?.text) { ... }

                    if (message.serverContent?.generationComplete) {
                        if (currentTranscription.trim() !== '') {
                            sendToGroq(currentTranscription);
                            currentTranscription = '';
                        }
                        messageBuffer = '';
                    }

                    if (message.serverContent?.turnComplete) {
                        sendToRenderer('update-status', 'Listening...');
                    }
                },
                onerror: function (e) {
                    console.log('Session error:', e.message);
                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.log('Session closed:', e.reason);

                    // Don't reconnect if user intentionally closed
                    if (isUserClosing) {
                        isUserClosing = false;
                        sendToRenderer('update-status', 'Session closed');
                        return;
                    }

                    // Attempt reconnection
                    if (sessionParams && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        attemptReconnect();
                    } else {
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                proactivity: { proactiveAudio: true },
                outputAudioTranscription: {},
                tools: enabledTools,
                // Enable speaker diarization
                inputAudioTranscription: {
                    enableSpeakerDiarization: true,
                    minSpeakerCount: 2,
                    maxSpeakerCount: 2,
                },
                contextWindowCompression: { slidingWindow: {} },
                speechConfig: { languageCode: language },
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
            },
        });

        isInitializingSession = false;
        if (!isReconnect) {
            sendToRenderer('session-initializing', false);
        }
        return session;
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        isInitializingSession = false;
        if (!isReconnect) {
            sendToRenderer('session-initializing', false);
        }
        return null;
    }
}

async function attemptReconnect() {
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    // Clear stale buffers
    messageBuffer = '';
    currentTranscription = '';
    // Don't reset groqConversationHistory to preserve context across reconnects

    sendToRenderer('update-status', `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    // Wait before attempting
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

    try {
        const session = await initializeGeminiSession(
            sessionParams.apiKey,
            sessionParams.customPrompt,
            sessionParams.profile,
            sessionParams.language,
            true // isReconnect
        );

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;

            // Restore context from conversation history via text message
            const contextMessage = buildContextMessage();
            if (contextMessage) {
                try {
                    console.log('Restoring conversation context...');
                    await session.sendRealtimeInput({ text: contextMessage });
                } catch (contextError) {
                    console.error('Failed to restore context:', contextError);
                    // Continue without context - better than failing
                }
            }

            // Don't reset reconnectAttempts here - let it reset on next fresh session
            sendToRenderer('update-status', 'Reconnected! Listening...');
            console.log('Session reconnected successfully');
            return true;
        }
    } catch (error) {
        console.error(`Reconnection attempt ${reconnectAttempts} failed:`, error);
    }

    // If we still have attempts left, try again
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        return attemptReconnect();
    }

    // Max attempts reached - notify frontend
    console.log('Max reconnection attempts reached');
    sendToRenderer('reconnect-failed', {
        message: 'Tried 3 times to reconnect. Must be upstream/network issues. Try restarting or download updated app from site.',
    });
    sessionParams = null;
    return false;
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes');
            } else {
                console.log('No existing SystemAudioDump processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
        },
    };

    systemAudioProc = spawn(systemAudioPath, [], spawnOptions);

    if (!systemAudioProc.pid) {
        console.error('Failed to start SystemAudioDump');
        return false;
    }

    console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;

            if (currentProviderMode === 'cloud') {
                sendCloudAudio(monoChunk);
            } else if (currentProviderMode === 'local') {
                getLocalAi().processLocalAudio(monoChunk);
            } else {
                processHostedPcmBuffer('system', monoChunk);
            }

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

async function sendImageToGeminiHttp(base64Data, prompt) {
    // Get available model based on rate limits
    const model = getAvailableModel();

    const apiKey = getApiKey();
    if (!apiKey) {
        return { success: false, error: 'No API key configured' };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const contents = [
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data,
                },
            },
            { text: prompt },
        ];

        console.log(`Sending image to ${model} (streaming)...`);
        const response = await ai.models.generateContentStream({
            model: model,
            contents: contents,
        });

        // Increment count after successful call
        incrementLimitCount(model);

        // Stream the response
        let fullText = '';
        let isFirst = true;
        for await (const chunk of response) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                // Send to renderer - new response for first chunk, update for subsequent
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        console.log(`Image response completed from ${model}`);

        // Save screen analysis to history
        saveScreenAnalysis(prompt, fullText, model);

        return { success: true, text: fullText, model: model };
    } catch (error) {
        console.error('Error sending image to Gemini HTTP:', error);
        return { success: false, error: error.message };
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('initialize-cloud', async (event, token, profile, userContext) => {
        try {
            currentProviderMode = 'cloud';
            initializeNewSession(profile);
            setOnTurnComplete((transcription, response) => {
                saveConversationTurn(transcription, response);
            });
            sendToRenderer('session-initializing', true);
            await connectCloud(token, profile, userContext);
            sendToRenderer('session-initializing', false);
            return true;
        } catch (err) {
            console.error('[Cloud] Init error:', err);
            currentProviderMode = 'groq';
            sendToRenderer('session-initializing', false);
            return false;
        }
    });

    ipcMain.handle('initialize-gemini', async () => {
        console.warn('Gemini initialization is temporarily disabled');
        sendToRenderer('update-status', 'Gemini is temporarily disabled');
        return false;
    });

    ipcMain.handle('initialize-groq', async (event, profile = 'interview', selectedLanguage = 'en-US') => {
        if (!getGroqApiKeySequence().length) return false;
        currentProviderMode = 'groq';
        const prefs = getPreferences();
        const selectedProfile = getAiProfileSnapshot(profile);
        const language = getLanguageConfig(selectedLanguage);
        currentSystemPrompt = getSystemPrompt(selectedProfile, '', false, [], language.locale);
        currentGroqSession = {
            profileId: selectedProfile.id,
            profileName: selectedProfile.name,
            systemPrompt: currentSystemPrompt,
            model: prefs.hostedTextModel,
            behavior: { ...selectedProfile.behavior },
            language,
            tpmLimit: null,
        };
        configureHostedAudio(prefs.audioMode);
        initializeNewSession(selectedProfile.id, currentSystemPrompt, { profileName: selectedProfile.name, language: language.locale });
        sessionParams = null;
        geminiSessionRef.current = null;
        return {
            success: true,
            profile: { id: selectedProfile.id, name: selectedProfile.name },
            language: { locale: language.locale, name: language.name },
            promptCharacters: currentSystemPrompt.length,
        };
    });

    ipcMain.handle('initialize-local', async (event, ollamaHost, ollamaModel, whisperModel, profile, customPrompt, language = 'en-US') => {
        currentProviderMode = 'local';
        currentGroqSession = null;
        const selectedProfile = getAiProfileSnapshot(profile);
        const languageConfig = getLanguageConfig(language);
        currentSystemPrompt = getSystemPrompt(selectedProfile, '', false, [], languageConfig.locale);
        const success = await getLocalAi().initializeLocalSession(ollamaHost, ollamaModel, whisperModel, selectedProfile, '', languageConfig.locale);
        if (!success) {
            currentProviderMode = 'groq';
        }
        return success
            ? {
                  success: true,
                  profile: { id: selectedProfile.id, name: selectedProfile.name },
                  language: { locale: languageConfig.locale, name: languageConfig.name },
                  promptCharacters: currentSystemPrompt.length,
              }
            : false;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (currentProviderMode === 'cloud') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                sendCloudAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending cloud audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (currentProviderMode === 'local') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getLocalAi().processLocalAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending local audio:', error);
                return { success: false, error: error.message };
            }
        }
        return processHostedAudioChunk('system', data, mimeType);
    });

    // Handle microphone audio on a separate channel
    ipcMain.handle('send-mic-audio-content', async (event, { data, mimeType }) => {
        if (currentProviderMode === 'cloud') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                sendCloudAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending cloud mic audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (currentProviderMode === 'local') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getLocalAi().processLocalAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending local mic audio:', error);
                return { success: false, error: error.message };
            }
        }
        return processHostedAudioChunk('microphone', data, mimeType);
    });

    ipcMain.handle('list-local-vision-models', async () => {
        try {
            const prefs = getPreferences();
            return { success: true, models: await getLocalAi().listLocalVisionModels(prefs.ollamaHost) };
        } catch (error) {
            return { success: false, models: [], error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, prompt }) => {
        let ownsVisionLock = false;
        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            if (buffer.length > 4 * 1024 * 1024) return { success: false, error: 'Screenshot exceeds the 4 MB Vision limit' };
            if (isVisionRequestActive) return { success: false, error: 'A screenshot is already being analyzed' };

            const prefs = getPreferences();
            if (prefs.visionProvider === 'disabled') return { success: false, error: 'Screenshot analysis is disabled in Settings' };

            const visionPrompt = buildVisionPrompt(prefs.screenAnalysisPrompt, prompt, conversationHistory, prefs.visionIncludeConversation);

            process.stdout.write('!');
            isVisionRequestActive = true;
            ownsVisionLock = true;
            let result;
            if (prefs.visionProvider === 'groq') {
                result = await sendGroqImage(data, visionPrompt);
            } else if (prefs.visionProvider === 'ollama') {
                result = await getLocalAi().sendLocalImage(data, visionPrompt, {
                    host: prefs.ollamaHost,
                    model: prefs.ollamaVisionModel,
                    systemPrompt: currentSystemPrompt,
                });
            } else {
                return { success: false, error: `Unsupported Vision provider: ${prefs.visionProvider}` };
            }

            if (result.success) saveScreenAnalysis(visionPrompt, result.text, result.model, prefs.visionProvider);
            return result;
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        } finally {
            if (ownsVisionLock) isVisionRequestActive = false;
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return { success: false, error: 'Invalid text message' };
        }

        if (currentProviderMode === 'cloud') {
            try {
                console.log('Sending text to cloud:', text);
                sendCloudText(text.trim());
                return { success: true };
            } catch (error) {
                console.error('Error sending cloud text:', error);
                return { success: false, error: error.message };
            }
        }

        if (currentProviderMode === 'local') {
            try {
                console.log('Sending text to local Ollama:', text);
                return await getLocalAi().sendLocalText(text.trim());
            } catch (error) {
                console.error('Error sending local text:', error);
                return { success: false, error: error.message };
            }
        }

        try {
            console.log('Sending text message to Groq');
            queueGroqText(text.trim());
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();
            hostedAudioSegmenter?.reset();
            hostedAudioSegmenter = null;
            currentGroqSession = null;
            pendingUtteranceIds.clear();
            hostedAudioQueue = Promise.resolve();
            groqTextQueue = Promise.resolve();

            if (currentProviderMode === 'cloud') {
                closeCloud();
                currentProviderMode = 'groq';
                return { success: true };
            }

            if (currentProviderMode === 'local') {
                getLocalAi().closeLocalSession();
                currentProviderMode = 'groq';
                return { success: true };
            }

            // Set flag to prevent reconnection attempts
            isUserClosing = true;
            sessionParams = null;

            // Cleanup session
            if (geminiSessionRef.current) {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    getStoredSetting,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    sendImageToGeminiHttp,
    setupGeminiIpcHandlers,
    formatSpeakerResults,
};
