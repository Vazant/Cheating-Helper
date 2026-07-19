const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cheating-helper-storage-'));
process.env.USERPROFILE = tempHome;

const configDir = path.join(tempHome, 'AppData', 'Roaming', 'cheating-daddy-config');
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ configVersion: 1 }), 'utf8');
fs.writeFileSync(path.join(configDir, 'credentials.json'), JSON.stringify({ groqApiKey: 'legacy-key', unrelated: 'preserved' }), 'utf8');

try {
    const storage = require('../src/storage');
    storage.initializeStorage();
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
    assert.strictEqual(defaults.visionProvider, 'groq');
    assert.strictEqual(defaults.groqVisionModel, 'qwen/qwen3.6-27b');
    assert.strictEqual(defaults.ollamaVisionModel, 'qwen3-vl:4b');
    assert.ok(defaults.screenAnalysisPrompt.length > 20);
    assert.strictEqual(defaults.visionIncludeConversation, true);
    assert.ok(defaults.availableProfiles.some(profile => profile.id === 'profile_senior_java_interview'));
    assert.ok(defaults.availableProfiles.some(profile => profile.id === 'interview' && profile.isBuiltin));
    storage.updatePreference('visionProvider', 'invalid');
    assert.strictEqual(storage.getPreferences().visionProvider, 'groq');
    storage.updatePreference('visionProvider', 'ollama');
    storage.updatePreference('ollamaVisionModel', 'custom-vl:latest');
    assert.strictEqual(storage.getPreferences().visionProvider, 'ollama');
    assert.strictEqual(storage.getPreferences().ollamaVisionModel, 'custom-vl:latest');

    const copy = storage.createAiProfile('interview');
    const updated = storage.updateAiProfile(copy.id, { prompt: { userContext: 'Profile A facts' } });
    assert.strictEqual(updated.profile.prompt.userContext, 'Profile A facts');
    assert.strictEqual(storage.getAiProfile('interview').prompt.userContext, '');
    const imported = storage.importAiProfile(JSON.stringify({ name: 'Imported', prompt: { userContext: 'B', length: 'detailed' }, models: { text: 'ignored' } }));
    assert.strictEqual(imported.prompt.userContext, 'B');
    assert.strictEqual(imported.models, undefined);
    assert.strictEqual(storage.deleteAiProfile(copy.id), storage.getPreferences().selectedProfile);
} finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
}

console.log('Storage migration and Groq key rotation: OK');
