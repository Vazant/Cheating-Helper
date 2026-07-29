const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    LEGACY_DEFAULT_SCREEN_ANALYSIS_PROMPT,
    PREVIOUS_DEFAULT_SCREEN_ANALYSIS_PROMPT,
    DEFAULT_SCREEN_ANALYSIS_PROMPT,
} = require('../src/utils/vision');

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cheating-helper-storage-'));
process.env.USERPROFILE = tempHome;

const configDir = path.join(tempHome, 'AppData', 'Roaming', 'cheating-daddy-config');
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ configVersion: 0, preserved: true }), 'utf8');
fs.writeFileSync(path.join(configDir, 'credentials.json'), JSON.stringify({ groqApiKey: 'legacy-key', unrelated: 'preserved' }), 'utf8');
fs.writeFileSync(
    path.join(configDir, 'preferences.json'),
    JSON.stringify({
        selectedLanguage: 'ru-RU',
        selectedProfile: 'profile_senior_java_interview',
        speechCaptureMode: 'always',
        screenAnalysisPrompt: LEGACY_DEFAULT_SCREEN_ANALYSIS_PROMPT,
    }),
    'utf8'
);
fs.writeFileSync(path.join(configDir, 'keybinds.json'), JSON.stringify({ toggleSpeechCapture: 'F7' }), 'utf8');
fs.writeFileSync(
    path.join(configDir, 'profiles.json'),
    JSON.stringify({
        schemaVersion: 2,
        userProfiles: [
            {
                id: 'profile_senior_java_interview',
                name: 'Senior Java Interview',
                prompt: {
                    userContext: 'java facts',
                    persona: 'java persona',
                    answerRules: 'java rules',
                    responseStyle: 'java style',
                    length: 'detailed',
                    format: 'teleprompter',
                },
                behavior: { conversationContextEnabled: false, conversationContextCount: 4 },
            },
            {
                id: 'profile_epam_hr_call',
                name: 'EPAM HR Call',
                prompt: {
                    userContext: 'old facts',
                    persona: 'old persona',
                    answerRules: 'old rules',
                    responseStyle: 'old style',
                    length: 'concise',
                    format: 'teleprompter',
                },
            },
            {
                id: 'profile_epam_hr_call-2',
                name: 'EPAM HR Call',
                prompt: {
                    userContext: 'refined facts',
                    persona: 'refined persona',
                    answerRules: 'refined rules',
                    responseStyle: 'refined style',
                    length: 'concise',
                    format: 'teleprompter',
                },
            },
        ],
        migrations: {
            seniorJavaInterviewV2: { done: true, updated: true },
            seniorJavaInterviewV3: { done: true, updated: true },
            seniorJavaInterviewV4: { done: true, updated: true },
            seniorJavaInterviewV5: { done: true, updated: true },
        },
    }),
    'utf8'
);

try {
    const storage = require('../src/storage');
    assert.strictEqual(storage.normalizeAudioMode('both'), 'speaker_only');
    assert.strictEqual(storage.normalizeAudioMode('mic_only'), 'mic_only');
    storage.initializeStorage();
    assert.strictEqual(storage.getConfig().preserved, true);
    assert.strictEqual(storage.getConfig().configVersion, 1);
    assert.strictEqual(storage.listAiProfiles().some(profile => profile.id === 'profile_epam_hr_call'), false);
    assert.strictEqual(storage.getAiProfile('profile_epam_hr_call-2').prompt.userContext, 'refined facts');
    assert.deepStrictEqual(storage.getProfileStore().migrations.epamHrDuplicateCleanupV1, { done: true, removed: true });
    const seniorJavaInterview = storage.getAiProfile('profile_senior_java_interview');
    assert.strictEqual(seniorJavaInterview.prompt.userContext, 'java facts');
    assert.strictEqual(seniorJavaInterview.prompt.length, 'concise');
    assert.ok(seniorJavaInterview.prompt.responseStyle.includes('B1-B2'));
    assert.ok(seniorJavaInterview.prompt.answerRules.includes('clean, complete Java code'));
    assert.ok(seniorJavaInterview.prompt.answerRules.includes('Explain this at Senior Java interview level'));
    assert.ok(seniorJavaInterview.prompt.answerRules.includes('Never invent speculative consequences'));
    assert.ok(seniorJavaInterview.prompt.answerRules.includes('do not stop at a definition'));
    assert.ok(seniorJavaInterview.prompt.answerRules.includes('do not silently ignore failures'));
    assert.ok(seniorJavaInterview.prompt.answerRules.includes('Do not add handling unrelated to the visible task'));
    assert.doesNotMatch(seniorJavaInterview.prompt.answerRules, /InterruptedException|wait\/notify|Ping|Pong/);
    assert.deepStrictEqual(seniorJavaInterview.behavior, { conversationContextEnabled: false, conversationContextCount: 4 });
    assert.deepStrictEqual(storage.getProfileStore().migrations.seniorJavaInterviewV2, { done: true, updated: true });
    assert.deepStrictEqual(storage.getProfileStore().migrations.seniorJavaInterviewV3, { done: true, updated: true });
    assert.deepStrictEqual(storage.getProfileStore().migrations.seniorJavaInterviewV4, { done: true, updated: true });
    assert.deepStrictEqual(storage.getProfileStore().migrations.seniorJavaInterviewV5, { done: true, updated: true });
    assert.deepStrictEqual(storage.getProfileStore().migrations.seniorJavaInterviewV6, { done: true, updated: true });
    assert.deepStrictEqual(storage.getGroqApiKeys(), ['legacy-key']);
    assert.strictEqual(storage.getCredentials().unrelated, 'preserved');

    storage.setGroqApiKeys(['first', 'second', 'third']);
    assert.deepStrictEqual(storage.getGroqApiKeySequence(), ['first', 'second', 'third']);
    assert.strictEqual(storage.activateGroqApiKey('second'), true);
    assert.deepStrictEqual(storage.getGroqApiKeySequence(), ['second', 'third', 'first']);
    storage.setGroqApiKeys(['second', 'third']);
    assert.deepStrictEqual(storage.getGroqApiKeySequence(), ['second', 'third']);
    assert.strictEqual(storage.activateGroqApiKey('missing'), false);

    const defaults = storage.getPreferences();
    assert.strictEqual(defaults.speechCaptureMode, 'toggle');
    assert.strictEqual(defaults.selectedLanguage, 'ru-RU');
    assert.strictEqual(defaults.selectedProfile, 'profile_senior_java_interview');
    assert.strictEqual(storage.getKeybinds().toggleSystemAudio, 'F7');
    assert.strictEqual(storage.getKeybinds().toggleMicrophone, 'F9');
    assert.strictEqual(storage.getKeybinds().toggleSpeechCapture, undefined);
    assert.throws(() => storage.setKeybinds({ toggleSystemAudio: 'F8', toggleMicrophone: 'F8' }), /unique/);
    assert.throws(() => storage.updatePreference('unknownPreference', true), /Unknown preference/);
    assert.strictEqual(defaults.visionProvider, 'groq');
    assert.strictEqual(defaults.groqVisionModel, 'qwen/qwen3.6-27b');
    assert.strictEqual(defaults.ollamaVisionModel, 'qwen3-vl:4b');
    assert.strictEqual(defaults.screenAnalysisPrompt, DEFAULT_SCREEN_ANALYSIS_PROMPT);
    assert.strictEqual(
        JSON.parse(fs.readFileSync(path.join(configDir, 'preferences.json'), 'utf8')).screenAnalysisPrompt,
        DEFAULT_SCREEN_ANALYSIS_PROMPT
    );
    assert.strictEqual(defaults.visionIncludeConversation, true);
    assert.strictEqual(defaults.saveScreenshotsInHistory, false);
    assert.ok(defaults.availableProfiles.some(profile => profile.id === 'profile_senior_java_interview'));
    assert.ok(defaults.availableProfiles.some(profile => profile.id === 'interview' && profile.isBuiltin));
    storage.updatePreference('visionProvider', 'invalid');
    assert.strictEqual(storage.getPreferences().visionProvider, 'groq');
    storage.updatePreference('visionProvider', 'ollama');
    storage.updatePreference('ollamaVisionModel', 'custom-vl:latest');
    assert.strictEqual(storage.getPreferences().visionProvider, 'ollama');
    assert.strictEqual(storage.getPreferences().ollamaVisionModel, 'custom-vl:latest');
    storage.updatePreference('screenAnalysisPrompt', PREVIOUS_DEFAULT_SCREEN_ANALYSIS_PROMPT);
    storage.initializeStorage();
    assert.strictEqual(storage.getPreferences().screenAnalysisPrompt, DEFAULT_SCREEN_ANALYSIS_PROMPT);
    storage.updatePreference('screenAnalysisPrompt', 'Keep this custom screenshot instruction exactly.');
    storage.initializeStorage();
    assert.strictEqual(storage.getPreferences().screenAnalysisPrompt, 'Keep this custom screenshot instruction exactly.');
    storage.updatePreference('speechCaptureMode', 'toggle');
    assert.strictEqual(storage.getPreferences().speechCaptureMode, 'toggle');
    storage.updatePreference('speechCaptureMode', 'invalid');
    assert.strictEqual(storage.getPreferences().speechCaptureMode, 'toggle');
    storage.updatePreference('fontSize', 'medium');
    assert.strictEqual(storage.getPreferences().fontSize, 20);
    storage.updatePreference('backgroundTransparency', 5);
    assert.strictEqual(storage.getPreferences().backgroundTransparency, 1);
    storage.updatePreference('selectedLanguage', 'pl-PL');
    fs.writeFileSync(path.join(configDir, 'preferences.json'), '{broken', 'utf8');
    assert.strictEqual(storage.getPreferences().selectedLanguage, 'pl-PL');
    storage.updatePreference('selectedLanguage', 'ru-RU');

    const copy = storage.createAiProfile('interview');
    const updated = storage.updateAiProfile(copy.id, { prompt: { userContext: 'Profile A facts' } });
    assert.strictEqual(updated.profile.prompt.userContext, 'Profile A facts');
    assert.strictEqual(storage.getAiProfile('interview').prompt.userContext, '');
    const imported = storage.importAiProfile(
        JSON.stringify({ name: 'Imported', prompt: { userContext: 'B', length: 'detailed' }, models: { text: 'ignored' } })
    );
    assert.strictEqual(imported.prompt.userContext, 'B');
    assert.strictEqual(imported.models, undefined);
    assert.strictEqual(storage.deleteAiProfile(copy.id), storage.getPreferences().selectedProfile);

    storage.saveSession('1234567890', {
        profile: 'profile_senior_java_interview',
        profileName: 'Senior Java Interview',
        language: 'en-US',
        conversationHistory: [
            {
                timestamp: 1234567891,
                transcription: 'Long question',
                ai_response: 'Partial answer',
                status: 'incomplete',
                reason: 'length',
            },
        ],
    });
    const savedSession = storage.getSession('1234567890');
    assert.strictEqual(savedSession.profileName, 'Senior Java Interview');
    assert.strictEqual(savedSession.language, 'en-US');
    assert.strictEqual(savedSession.conversationHistory[0].status, 'incomplete');
    assert.strictEqual(savedSession.conversationHistory[0].reason, 'length');
    const sessionSummary = storage.getAllSessions().find(session => session.sessionId === '1234567890');
    assert.strictEqual(sessionSummary.profileName, 'Senior Java Interview');
    assert.strictEqual(sessionSummary.language, 'en-US');

    const imageRef = storage.saveScreenshotAsset('1234567890', 1234567892, Buffer.from('jpeg-data'));
    storage.saveSession('1234567890', {
        screenAnalysisHistory: [{ timestamp: 1234567892, response: 'Screen answer', imageRef }],
    });
    const sessionWithImage = storage.getSession('1234567890');
    assert.strictEqual(sessionWithImage.screenAnalysisHistory[0].imageData, `data:image/jpeg;base64,${Buffer.from('jpeg-data').toString('base64')}`);
    assert.throws(() => storage.saveScreenshotAsset('../escape', 1, Buffer.from('x')), /Invalid session ID/);
    storage.deleteSession('1234567890');
    assert.strictEqual(fs.existsSync(path.join(configDir, 'history', 'assets', '1234567890')), false);
} finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
}

console.log('Storage migration and Groq key rotation: OK');
