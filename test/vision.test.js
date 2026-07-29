const assert = require('assert');
const fs = require('fs');
const {
    GROQ_VISION_MODEL,
    DEFAULT_OLLAMA_VISION_MODEL,
    DEFAULT_SCREEN_ANALYSIS_PROMPT,
    VISION_EXTRACTION_SYSTEM_PROMPT,
    VISION_GROUNDING_POLICY,
    VISION_ANSWER_POLICY,
    normalizeVisionProvider,
    buildVisionPrompt,
    buildVisionExtractionPrompt,
    parseVisionExtraction,
    buildVisionSystemPrompt,
    buildVisionAnswerSystemPrompt,
    buildVisionAnswerTurn,
    hasVisionCapability,
} = require('../src/utils/vision');

assert.strictEqual(GROQ_VISION_MODEL, 'qwen/qwen3.6-27b');
assert.strictEqual(DEFAULT_OLLAMA_VISION_MODEL, 'qwen3-vl:4b');
assert.strictEqual(normalizeVisionProvider('ollama'), 'ollama');
assert.strictEqual(normalizeVisionProvider('disabled'), 'disabled');
assert.strictEqual(normalizeVisionProvider('unknown'), 'groq');
assert.strictEqual(hasVisionCapability({ capabilities: ['completion', 'vision'] }), true);
assert.strictEqual(hasVisionCapability({ capabilities: ['completion'] }), false);
assert.strictEqual(hasVisionCapability({}), false);
assert.ok(DEFAULT_SCREEN_ANALYSIS_PROMPT.includes('single main visible question'));
assert.ok(!DEFAULT_SCREEN_ANALYSIS_PROMPT.includes('controls, and layout'));
assert.ok(VISION_EXTRACTION_SYSTEM_PROMPT.includes('Do not answer, solve'));
assert.ok(VISION_EXTRACTION_SYSTEM_PROMPT.includes('requestedMechanisms'));
assert.ok(VISION_GROUNDING_POLICY.includes('compiler error'));
assert.ok(VISION_GROUNDING_POLICY.includes('only code is visible'));
assert.ok(VISION_GROUNDING_POLICY.includes('Never invent'));
assert.ok(VISION_ANSWER_POLICY.includes('mentally trace the initial state'));
assert.ok(VISION_ANSWER_POLICY.includes('does not prove that the screenshot is an interview'));

const history = [
    { transcription: 'old', ai_response: 'old answer' },
    { transcription: 'recent one', ai_response: 'answer one' },
    { transcription: 'recent two', ai_response: 'answer two' },
];
const prompt = buildVisionPrompt('SCREEN', 'MANUAL', history, true);
assert.ok(prompt.startsWith('SCREEN'));
assert.ok(prompt.includes('MANUAL'));
assert.ok(!prompt.includes('old answer'));
assert.ok(prompt.includes('recent one'));
assert.ok(prompt.includes('recent two'));
assert.ok(!buildVisionPrompt('SCREEN', '', history, false).includes('Recent conversation'));
const extractionPrompt = buildVisionExtractionPrompt('SCREEN', 'MANUAL');
assert.ok(extractionPrompt.includes('SCREEN'));
assert.ok(extractionPrompt.includes('MANUAL'));
assert.ok(!extractionPrompt.includes('Recent conversation'));
const extraction = parseVisionExtraction(
    JSON.stringify({
        status: 'grounded',
        primaryKind: 'coding_task',
        primaryText: 'Print Ping before Pong.',
        visibleRequirements: ['Ping must be first'],
        requestedMechanisms: ['wait/notify'],
        visibleCode: null,
        visibleErrors: [],
        visibleExamples: ['Ping Pong'],
        missingOrUnreadable: [],
    })
);
assert.strictEqual(extraction.requestedMechanisms[0], 'wait/notify');
assert.throws(() => parseVisionExtraction('not json'), /valid JSON/);
assert.throws(
    () =>
        parseVisionExtraction(
            JSON.stringify({
                ...extraction,
                status: 'invented',
            })
        ),
    /invalid status/
);
const systemPrompt = buildVisionSystemPrompt('PROFILE');
assert.ok(systemPrompt.startsWith('PROFILE'));
assert.ok(systemPrompt.indexOf('PROFILE') < systemPrompt.indexOf('Screenshot grounding rules'));
assert.ok(systemPrompt.includes('Profile rules must not add facts or requirements absent from the screenshot'));
const answerSystemPrompt = buildVisionAnswerSystemPrompt('PROFILE');
assert.ok(answerSystemPrompt.startsWith('PROFILE'));
assert.ok(answerSystemPrompt.includes('Screenshot evidence rules'));
const answerTurn = buildVisionAnswerTurn(extraction, '');
assert.ok(answerTurn.includes('Print Ping before Pong.'));
assert.ok(answerTurn.includes('wait/notify'));
assert.ok(!answerTurn.includes('data:image'));

const geminiSource = fs.readFileSync(require.resolve('../src/utils/gemini'), 'utf8');
assert.ok(geminiSource.includes("prefs.visionProvider === 'groq'"));
assert.ok(geminiSource.includes("prefs.visionProvider === 'ollama'"));
assert.ok(geminiSource.includes('Screenshot exceeds the 4 MB Vision limit'));
assert.ok(geminiSource.includes('data:image/jpeg;base64'));
assert.ok(!geminiSource.includes('getGroqFallbackOrder(prefs.groqVisionModel'));
assert.ok(geminiSource.includes('getGroqVisionRequestOptions()'));
assert.ok(!geminiSource.includes('max_tokens: 2048'));
assert.strictEqual((geminiSource.match(/buildVisionSystemPrompt\(currentSystemPrompt\)/g) || []).length, 1);
assert.ok(geminiSource.includes("response_format: { type: 'json_object' }"));
assert.ok(geminiSource.includes('buildVisionAnswerSystemPrompt(currentGroqSession?.systemPrompt || currentSystemPrompt)'));
assert.ok(geminiSource.includes("pipeline: 'extract-then-response'"));
assert.ok(geminiSource.includes("reasoningEffort: 'medium'"));
const groqImageBody = geminiSource.slice(geminiSource.indexOf('async function sendGroqImage'), geminiSource.indexOf('async function sendToGemma'));
assert.ok(groqImageBody.includes('VISION_EXTRACTION_SYSTEM_PROMPT'));
assert.ok(!groqImageBody.includes("sendToRenderer('new-response'"));

const assistantSource = fs.readFileSync(require.resolve('../src/components/views/AssistantView'), 'utf8');
assert.ok(assistantSource.includes('@click=${this.handleScreenAnswer}'));
const screenButtonHandler = assistantSource.slice(
    assistantSource.indexOf('async handleScreenAnswer()'),
    assistantSource.indexOf('_startWaveformAnimation()')
);
assert.ok(screenButtonHandler.includes('window.captureManualScreenshot()'));

const rendererSource = fs.readFileSync(require.resolve('../src/utils/renderer'), 'utf8');
const manualCapture = rendererSource.slice(
    rendererSource.indexOf('async function captureManualScreenshot'),
    rendererSource.indexOf('async function stopCapture')
);
assert.ok(manualCapture.includes("ipcRenderer.invoke('send-image-content'"));
const shortcutHandler = rendererSource.slice(
    rendererSource.indexOf('function handleShortcut'),
    rendererSource.indexOf('// Create reference to the main app element')
);
assert.ok(shortcutHandler.includes('captureManualScreenshot()'));

const localSource = fs.readFileSync(require.resolve('../src/utils/localai'), 'utf8');
assert.ok(localSource.includes('client.show({ model: visionModel })'));
assert.ok(localSource.includes('hasVisionCapability(info)'));

const settingsSource = fs.readFileSync(require.resolve('../src/components/views/CustomizeView'), 'utf8');
for (const text of ['Vision Provider', 'Groq — Hosted quality', 'Ollama — Local/private', 'Screenshot Instruction', 'Refresh Ollama models']) {
    assert.ok(settingsSource.includes(text));
}
assert.ok(settingsSource.includes(DEFAULT_SCREEN_ANALYSIS_PROMPT));
assert.ok(settingsSource.includes('Uses two Groq'));
assert.ok(settingsSource.includes('stay local in one direct request'));
assert.ok(!settingsSource.includes('Used only to generate text answers'));

console.log('Vision settings and routing: OK');
