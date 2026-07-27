const fs = require('fs');
const path = require('path');
const os = require('os');
const { DEFAULT_GROQ_MODEL, GROQ_MODELS } = require('./utils/groq');
const {
    GROQ_VISION_MODEL,
    DEFAULT_OLLAMA_VISION_MODEL,
    LEGACY_DEFAULT_SCREEN_ANALYSIS_PROMPT,
    DEFAULT_SCREEN_ANALYSIS_PROMPT,
    normalizeVisionProvider,
} = require('./utils/vision');
const { PROFILE_SCHEMA_VERSION, SENIOR_JAVA_PROFILE, importProfile, normalizeProfile, normalizeUserProfiles } = require('./utils/aiProfiles');
const { getAvailableProfiles } = require('./utils/prompts');
const EPAM_HR_PROFILE_V2 = normalizeProfile(require('../profiles/epam-hr-call.json').profile);

const CONFIG_VERSION = 1;
const HOSTED_TEXT_MODELS = new Set(GROQ_MODELS);
const KEYBIND_ACTIONS = new Set([
    'moveUp',
    'moveDown',
    'moveLeft',
    'moveRight',
    'toggleVisibility',
    'toggleClickThrough',
    'nextStep',
    'previousResponse',
    'nextResponse',
    'scrollUp',
    'scrollDown',
    'emergencyErase',
    'toggleSystemAudio',
    'toggleMicrophone',
]);

function normalizeHostedTextModel(model) {
    if (HOSTED_TEXT_MODELS.has(model)) return model;
    if (model !== undefined) console.warn(`Unknown hosted text model "${model}"; using ${DEFAULT_GROQ_MODEL}`);
    return DEFAULT_GROQ_MODEL;
}

// Default values
const DEFAULT_CONFIG = {
    configVersion: CONFIG_VERSION,
    onboarded: false,
    layout: 'normal',
};

const DEFAULT_CREDENTIALS = {
    apiKey: '',
    groqApiKey: '',
    groqApiKeys: [],
    activeGroqApiKeyIndex: 0,
};

function normalizeGroqApiKeys(keys, legacyKey = '') {
    const normalized = [
        ...new Set(
            (Array.isArray(keys) ? keys : [])
                .filter(key => typeof key === 'string')
                .map(key => key.trim())
                .filter(Boolean)
        ),
    ];
    const legacy = typeof legacyKey === 'string' ? legacyKey.trim() : '';
    return normalized.length || !legacy ? normalized : [legacy];
}

function normalizeGroqApiKeyIndex(index, keyCount) {
    return Math.min(Math.max(Math.trunc(Number(index)) || 0, 0), Math.max(keyCount - 1, 0));
}

function orderGroqApiKeys(keys, activeIndex) {
    const index = normalizeGroqApiKeyIndex(activeIndex, keys.length);
    return [...keys.slice(index), ...keys.slice(0, index)];
}

function normalizeAudioMode(value) {
    return value === 'mic_only' ? 'mic_only' : 'speaker_only';
}

function normalizeSpeechCaptureMode(value) {
    return value === 'always' ? 'always' : 'toggle';
}

function normalizeFontSize(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(32, Math.max(12, Math.round(numeric))) : 20;
}

function normalizeBackgroundTransparency(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0.8;
}

const DEFAULT_PREFERENCES = {
    customPrompt: '',
    providerMode: 'byok',
    selectedProfile: 'interview',
    selectedLanguage: 'en-US',
    selectedScreenshotInterval: '5',
    selectedImageQuality: 'medium',
    advancedMode: false,
    audioMode: 'speaker_only',
    speechCaptureMode: 'toggle',
    speechCaptureModeVersion: 2,
    microphoneDeviceId: '',
    fontSize: 20,
    backgroundTransparency: 0.8,
    googleSearchEnabled: false,
    hostedTextModel: DEFAULT_GROQ_MODEL,
    visionProvider: 'groq',
    groqVisionModel: GROQ_VISION_MODEL,
    ollamaVisionModel: DEFAULT_OLLAMA_VISION_MODEL,
    screenAnalysisPrompt: DEFAULT_SCREEN_ANALYSIS_PROMPT,
    visionIncludeConversation: true,
    ollamaHost: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.1',
    whisperModel: 'Xenova/whisper-small',
};

const DEFAULT_PROFILE_STORE = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    userProfiles: [SENIOR_JAVA_PROFILE],
    migrations: {
        customPromptV1: { done: false, profileId: null },
        epamHrProfileV2: { done: false, updated: false },
        seniorJavaInterviewV2: { done: false, updated: false },
        seniorJavaInterviewV3: { done: false, updated: false },
        seniorJavaInterviewV4: { done: false, updated: false },
        seniorJavaInterviewV5: { done: false, updated: false },
    },
};

const DEFAULT_KEYBINDS = null; // null means use system defaults

const DEFAULT_LIMITS = {
    data: [], // Array of { date: 'YYYY-MM-DD', flash: { count }, flashLite: { count } }
};

// Get the config directory path based on OS
function getConfigDir() {
    const platform = os.platform();
    let configDir;

    if (platform === 'win32') {
        configDir = path.join(os.homedir(), 'AppData', 'Roaming', 'cheating-daddy-config');
    } else if (platform === 'darwin') {
        configDir = path.join(os.homedir(), 'Library', 'Application Support', 'cheating-daddy-config');
    } else {
        configDir = path.join(os.homedir(), '.config', 'cheating-daddy-config');
    }

    return configDir;
}

// File paths
function getConfigPath() {
    return path.join(getConfigDir(), 'config.json');
}

function getCredentialsPath() {
    return path.join(getConfigDir(), 'credentials.json');
}

function getPreferencesPath() {
    return path.join(getConfigDir(), 'preferences.json');
}

function getProfilesPath() {
    return path.join(getConfigDir(), 'profiles.json');
}

function getKeybindsPath() {
    return path.join(getConfigDir(), 'keybinds.json');
}

function getLimitsPath() {
    return path.join(getConfigDir(), 'limits.json');
}

function getHistoryDir() {
    return path.join(getConfigDir(), 'history');
}

// Helper to read JSON file safely
function readJsonFile(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn(`Error reading ${filePath}:`, error.message);
        const backupPath = `${filePath}.bak`;
        try {
            if (fs.existsSync(backupPath)) {
                console.warn(`Recovering ${filePath} from its last valid backup`);
                return JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            }
        } catch (backupError) {
            console.warn(`Error reading backup ${backupPath}:`, backupError.message);
        }
    }
    return defaultValue;
}

// Helper to write JSON file safely
function writeJsonFile(filePath, data) {
    const dir = path.dirname(filePath);
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const serialized = JSON.stringify(data, null, 2);
        fs.writeFileSync(temporaryPath, serialized, 'utf8');
        JSON.parse(fs.readFileSync(temporaryPath, 'utf8'));
        fs.renameSync(temporaryPath, filePath);
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
        fs.copyFileSync(filePath, `${filePath}.bak`);
        return true;
    } catch (error) {
        try {
            if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        } catch {
            // Preserve the original write error.
        }
        console.error(`Error writing ${filePath}:`, error.message);
        throw error;
    }
}

// Wipe and reinitialize only after the user explicitly chooses Clear All Data.
function resetConfigDir() {
    const configDir = getConfigDir();

    console.log('Resetting config directory...');

    // Remove existing directory if it exists
    if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
    }

    // Create fresh directory structure
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(getHistoryDir(), { recursive: true });

    // Initialize with defaults
    writeJsonFile(getConfigPath(), DEFAULT_CONFIG);
    writeJsonFile(getCredentialsPath(), DEFAULT_CREDENTIALS);
    writeJsonFile(getPreferencesPath(), DEFAULT_PREFERENCES);
    writeJsonFile(getProfilesPath(), DEFAULT_PROFILE_STORE);

    console.log('Config directory initialized with defaults');
}

// Initialize storage - call this on app startup
function initializeStorage() {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.mkdirSync(getHistoryDir(), { recursive: true });
    if (!fs.existsSync(getConfigPath())) writeJsonFile(getConfigPath(), DEFAULT_CONFIG);
    else setConfig({ configVersion: CONFIG_VERSION });
    if (!fs.existsSync(getCredentialsPath())) writeJsonFile(getCredentialsPath(), DEFAULT_CREDENTIALS);
    if (!fs.existsSync(getPreferencesPath())) writeJsonFile(getPreferencesPath(), DEFAULT_PREFERENCES);
    if (!fs.existsSync(getProfilesPath())) writeJsonFile(getProfilesPath(), DEFAULT_PROFILE_STORE);

    const savedPreferences = readJsonFile(getPreferencesPath(), {});
    if (savedPreferences.speechCaptureModeVersion !== 2) {
        setPreferences({ speechCaptureMode: 'toggle', speechCaptureModeVersion: 2 });
    }
    const savedKeybinds = getKeybinds();
    if (savedKeybinds?.toggleSpeechCapture) {
        const { toggleSpeechCapture, ...currentKeybinds } = savedKeybinds;
        setKeybinds({
            ...currentKeybinds,
            toggleSystemAudio: currentKeybinds.toggleSystemAudio || toggleSpeechCapture,
            toggleMicrophone: currentKeybinds.toggleMicrophone || 'F9',
        });
    }

    const credentials = getCredentials();
    const groqApiKeys = normalizeGroqApiKeys(credentials.groqApiKeys, credentials.groqApiKey);
    const activeGroqApiKeyIndex = normalizeGroqApiKeyIndex(credentials.activeGroqApiKeyIndex, groqApiKeys.length);
    if (JSON.stringify(credentials.groqApiKeys) !== JSON.stringify(groqApiKeys) || credentials.activeGroqApiKeyIndex !== activeGroqApiKeyIndex) {
        setCredentials({ groqApiKeys, activeGroqApiKeyIndex, groqApiKey: groqApiKeys[activeGroqApiKeyIndex] || '' });
    }
    // Drop accidental availableProfiles blob from older updatePreference writes
    persistPreferences(getPreferences());
    migrateLegacyCustomPrompt();
    migrateEpamHrProfileV2();
    migrateSeniorJavaInterviewV2();
    migrateSeniorJavaInterviewV3();
    migrateSeniorJavaInterviewV4();
    migrateSeniorJavaInterviewV5();
}

// ============ CONFIG ============

function getConfig() {
    return readJsonFile(getConfigPath(), DEFAULT_CONFIG);
}

function setConfig(config) {
    const current = getConfig();
    const updated = { ...current, ...config, configVersion: CONFIG_VERSION };
    return writeJsonFile(getConfigPath(), updated);
}

function updateConfig(key, value) {
    const config = getConfig();
    config[key] = value;
    return writeJsonFile(getConfigPath(), config);
}

// ============ CREDENTIALS ============

function getCredentials() {
    return readJsonFile(getCredentialsPath(), DEFAULT_CREDENTIALS);
}

function setCredentials(credentials) {
    const current = getCredentials();
    const updated = { ...current, ...credentials };
    return writeJsonFile(getCredentialsPath(), updated);
}

function getApiKey() {
    return getCredentials().apiKey || '';
}

function setApiKey(apiKey) {
    return setCredentials({ apiKey });
}

function getGroqApiKey() {
    return getGroqApiKeySequence()[0] || '';
}

function setGroqApiKey(groqApiKey) {
    return setGroqApiKeys([groqApiKey]);
}

function getGroqApiKeys() {
    const credentials = getCredentials();
    return normalizeGroqApiKeys(credentials.groqApiKeys, credentials.groqApiKey);
}

function setGroqApiKeys(keys) {
    const groqApiKeys = normalizeGroqApiKeys(keys);
    const credentials = getCredentials();
    const previousKeys = normalizeGroqApiKeys(credentials.groqApiKeys, credentials.groqApiKey);
    const previousActiveKey = previousKeys[normalizeGroqApiKeyIndex(credentials.activeGroqApiKeyIndex, previousKeys.length)];
    const activeGroqApiKeyIndex = Math.max(groqApiKeys.indexOf(previousActiveKey), 0);
    return setCredentials({ groqApiKeys, activeGroqApiKeyIndex, groqApiKey: groqApiKeys[activeGroqApiKeyIndex] || '' });
}

function getGroqApiKeySequence() {
    const credentials = getCredentials();
    const keys = normalizeGroqApiKeys(credentials.groqApiKeys, credentials.groqApiKey);
    return orderGroqApiKeys(keys, credentials.activeGroqApiKeyIndex);
}

function activateGroqApiKey(groqApiKey) {
    const keys = getGroqApiKeys();
    const activeGroqApiKeyIndex = keys.indexOf(groqApiKey);
    if (activeGroqApiKeyIndex < 0) return false;
    return setCredentials({ activeGroqApiKeyIndex, groqApiKey });
}

// ============ PREFERENCES ============

function getPreferences() {
    const saved = readJsonFile(getPreferencesPath(), {});
    return {
        ...DEFAULT_PREFERENCES,
        ...saved,
        audioMode: normalizeAudioMode(saved.audioMode),
        speechCaptureMode: normalizeSpeechCaptureMode(saved.speechCaptureMode),
        microphoneDeviceId: typeof saved.microphoneDeviceId === 'string' ? saved.microphoneDeviceId : '',
        fontSize: normalizeFontSize(saved.fontSize),
        backgroundTransparency: normalizeBackgroundTransparency(saved.backgroundTransparency),
        hostedTextModel: normalizeHostedTextModel(saved.hostedTextModel),
        visionProvider: normalizeVisionProvider(saved.visionProvider),
        groqVisionModel: GROQ_VISION_MODEL,
        ollamaVisionModel:
            typeof saved.ollamaVisionModel === 'string' && saved.ollamaVisionModel.trim()
                ? saved.ollamaVisionModel.trim()
                : DEFAULT_OLLAMA_VISION_MODEL,
        screenAnalysisPrompt:
            typeof saved.screenAnalysisPrompt === 'string' && saved.screenAnalysisPrompt.trim()
                ? saved.screenAnalysisPrompt === LEGACY_DEFAULT_SCREEN_ANALYSIS_PROMPT
                    ? DEFAULT_SCREEN_ANALYSIS_PROMPT
                    : saved.screenAnalysisPrompt
                : DEFAULT_SCREEN_ANALYSIS_PROMPT,
        visionIncludeConversation: saved.visionIncludeConversation !== false,
        availableProfiles: listAiProfiles(),
    };
}

function persistPreferences(preferences) {
    const { availableProfiles, ...persisted } = preferences;
    persisted.hostedTextModel = normalizeHostedTextModel(persisted.hostedTextModel);
    persisted.visionProvider = normalizeVisionProvider(persisted.visionProvider);
    persisted.audioMode = normalizeAudioMode(persisted.audioMode);
    persisted.speechCaptureMode = normalizeSpeechCaptureMode(persisted.speechCaptureMode);
    persisted.microphoneDeviceId = typeof persisted.microphoneDeviceId === 'string' ? persisted.microphoneDeviceId : '';
    persisted.fontSize = normalizeFontSize(persisted.fontSize);
    persisted.backgroundTransparency = normalizeBackgroundTransparency(persisted.backgroundTransparency);
    persisted.groqVisionModel = GROQ_VISION_MODEL;
    return writeJsonFile(getPreferencesPath(), persisted);
}

function setPreferences(preferences) {
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw new Error('Preferences must be an object');
    const unknownKey = Object.keys(preferences).find(key => !Object.hasOwn(DEFAULT_PREFERENCES, key));
    if (unknownKey) throw new Error(`Unknown preference "${unknownKey}"`);
    const current = getPreferences();
    const { availableProfiles, ...persistedCurrent } = current;
    return persistPreferences({ ...persistedCurrent, ...preferences });
}

function updatePreference(key, value) {
    if (!Object.hasOwn(DEFAULT_PREFERENCES, key)) throw new Error(`Unknown preference "${key}"`);
    const preferences = getPreferences();
    preferences[key] =
        key === 'hostedTextModel'
            ? normalizeHostedTextModel(value)
            : key === 'visionProvider'
              ? normalizeVisionProvider(value)
              : key === 'audioMode'
                ? normalizeAudioMode(value)
                : key === 'speechCaptureMode'
                  ? normalizeSpeechCaptureMode(value)
                  : key === 'microphoneDeviceId'
                    ? typeof value === 'string'
                        ? value
                        : ''
                    : key === 'fontSize'
                      ? normalizeFontSize(value)
                      : key === 'backgroundTransparency'
                        ? normalizeBackgroundTransparency(value)
                        : value;
    if (key === 'groqVisionModel') preferences[key] = GROQ_VISION_MODEL;
    return persistPreferences(preferences);
}

// ============ AI PROFILES ============

function getProfileStore() {
    const saved = readJsonFile(getProfilesPath(), DEFAULT_PROFILE_STORE);
    return {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        userProfiles: normalizeUserProfiles(saved.userProfiles),
        migrations: {
            customPromptV1: {
                done: saved.migrations?.customPromptV1?.done === true,
                profileId: typeof saved.migrations?.customPromptV1?.profileId === 'string' ? saved.migrations.customPromptV1.profileId : null,
            },
            epamHrProfileV2: {
                done: saved.migrations?.epamHrProfileV2?.done === true,
                updated: saved.migrations?.epamHrProfileV2?.updated === true,
            },
            seniorJavaInterviewV2: {
                done: saved.migrations?.seniorJavaInterviewV2?.done === true,
                updated: saved.migrations?.seniorJavaInterviewV2?.updated === true,
            },
            seniorJavaInterviewV3: {
                done: saved.migrations?.seniorJavaInterviewV3?.done === true,
                updated: saved.migrations?.seniorJavaInterviewV3?.updated === true,
            },
            seniorJavaInterviewV4: {
                done: saved.migrations?.seniorJavaInterviewV4?.done === true,
                updated: saved.migrations?.seniorJavaInterviewV4?.updated === true,
            },
            seniorJavaInterviewV5: {
                done: saved.migrations?.seniorJavaInterviewV5?.done === true,
                updated: saved.migrations?.seniorJavaInterviewV5?.updated === true,
            },
        },
    };
}

function setProfileStore(store) {
    return writeJsonFile(getProfilesPath(), {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        userProfiles: normalizeUserProfiles(store.userProfiles),
        migrations: store.migrations || DEFAULT_PROFILE_STORE.migrations,
    });
}

function listAiProfiles() {
    return getAvailableProfiles(getProfileStore().userProfiles);
}

function getAiProfile(id) {
    return listAiProfiles().find(profile => profile.id === id) || listAiProfiles()[0];
}

function uniqueProfileId(baseId, profiles) {
    const ids = new Set(profiles.map(profile => profile.id));
    let id = baseId;
    let suffix = 2;
    while (ids.has(id)) id = `${baseId}-${suffix++}`;
    return id;
}

function createAiProfile(sourceId = null, name = '') {
    const store = getProfileStore();
    const source = sourceId ? getAiProfile(sourceId) : normalizeProfile({ name: name || 'New Profile', prompt: {} });
    const base = normalizeProfile({ ...source, id: undefined, name: name || `${source.name} Copy` });
    const profile = { ...base, id: uniqueProfileId(base.id, listAiProfiles()) };
    store.userProfiles.push(profile);
    if (!setProfileStore(store)) throw new Error('Could not save profile');
    return profile;
}

function updateAiProfile(id, patch) {
    const store = getProfileStore();
    const builtIn = getAvailableProfiles([]).find(profile => profile.id === id);
    let index = store.userProfiles.findIndex(profile => profile.id === id);
    let profile = index >= 0 ? store.userProfiles[index] : builtIn;
    if (!profile) throw new Error('Profile not found');
    let createdCopy = false;
    if (builtIn) {
        profile = createAiProfile(id, `${profile.name} — My Profile`);
        return { ...updateAiProfile(profile.id, patch), createdCopy: true };
    }
    const merged = normalizeProfile(
        {
            ...profile,
            ...patch,
            id: profile.id,
            prompt: { ...profile.prompt, ...(patch.prompt || {}) },
            behavior: { ...profile.behavior, ...(patch.behavior || {}) },
        },
        { strict: true, id: profile.id }
    );
    index = store.userProfiles.findIndex(candidate => candidate.id === id);
    store.userProfiles[index] = merged;
    if (!setProfileStore(store)) throw new Error('Could not save profile');
    return { profile: merged, createdCopy };
}

function deleteAiProfile(id) {
    if (getAvailableProfiles([]).some(profile => profile.id === id)) throw new Error('Built-in profiles cannot be deleted');
    const store = getProfileStore();
    const next = store.userProfiles.filter(profile => profile.id !== id);
    if (next.length === store.userProfiles.length) throw new Error('Profile not found');
    store.userProfiles = next;
    if (!setProfileStore(store)) throw new Error('Could not delete profile');
    const prefs = getPreferences();
    const selectedProfileId = prefs.selectedProfile === id ? 'interview' : prefs.selectedProfile;
    if (selectedProfileId !== prefs.selectedProfile) updatePreference('selectedProfile', selectedProfileId);
    return selectedProfileId;
}

function importAiProfile(jsonText) {
    if (typeof jsonText !== 'string' || Buffer.byteLength(jsonText, 'utf8') > 256 * 1024)
        throw new Error('Profile JSON must be a UTF-8 file smaller than 256 KiB');
    const store = getProfileStore();
    const profile = importProfile(
        jsonText,
        listAiProfiles().map(item => item.id)
    );
    store.userProfiles.push(profile);
    if (!setProfileStore(store)) throw new Error('Could not save imported profile');
    return profile;
}

function migrateLegacyCustomPrompt() {
    const store = getProfileStore();
    if (store.migrations.customPromptV1.done) return;
    const saved = readJsonFile(getPreferencesPath(), {});
    const legacy = typeof saved.customPrompt === 'string' ? saved.customPrompt : '';
    let profileId = null;
    if (legacy.trim()) {
        const source = getAvailableProfiles(store.userProfiles).find(profile => profile.id === (saved.selectedProfile || 'interview'));
        const migrated = normalizeProfile({
            ...source,
            id: undefined,
            name: `${source?.name || 'Job Interview'} — My Profile`,
            prompt: { ...(source?.prompt || {}), userContext: legacy },
        });
        migrated.id = uniqueProfileId(migrated.id, getAvailableProfiles(store.userProfiles));
        store.userProfiles.push(migrated);
        profileId = migrated.id;
    }
    store.migrations.customPromptV1 = { done: true, profileId };
    if (!setProfileStore(store)) return;
    if (profileId) setPreferences({ selectedProfile: profileId, customPrompt: '' });
}

function migrateEpamHrProfileV2() {
    const store = getProfileStore();
    if (store.migrations.epamHrProfileV2.done) return;
    const index = store.userProfiles.findIndex(profile => profile.id === EPAM_HR_PROFILE_V2.id);
    if (index >= 0) store.userProfiles[index] = EPAM_HR_PROFILE_V2;
    store.migrations.epamHrProfileV2 = { done: true, updated: index >= 0 };
    setProfileStore(store);
}

function migrateSeniorJavaInterviewV2() {
    const store = getProfileStore();
    if (store.migrations.seniorJavaInterviewV2.done) return;
    const index = store.userProfiles.findIndex(profile => profile.id === SENIOR_JAVA_PROFILE.id);
    if (index >= 0) {
        const existing = store.userProfiles[index];
        store.userProfiles[index] = normalizeProfile({
            ...SENIOR_JAVA_PROFILE,
            prompt: {
                ...SENIOR_JAVA_PROFILE.prompt,
                userContext: existing.prompt.userContext,
            },
            behavior: existing.behavior,
        });
    }
    store.migrations.seniorJavaInterviewV2 = { done: true, updated: index >= 0 };
    setProfileStore(store);
}

function migrateSeniorJavaInterviewV3() {
    const store = getProfileStore();
    if (store.migrations.seniorJavaInterviewV3.done) return;
    const index = store.userProfiles.findIndex(profile => profile.id === SENIOR_JAVA_PROFILE.id);
    if (index >= 0) {
        const existing = store.userProfiles[index];
        store.userProfiles[index] = normalizeProfile({
            ...SENIOR_JAVA_PROFILE,
            prompt: {
                ...SENIOR_JAVA_PROFILE.prompt,
                userContext: existing.prompt.userContext,
            },
            behavior: existing.behavior,
        });
    }
    store.migrations.seniorJavaInterviewV3 = { done: true, updated: index >= 0 };
    setProfileStore(store);
}

function migrateSeniorJavaInterviewV4() {
    const store = getProfileStore();
    if (store.migrations.seniorJavaInterviewV4.done) return;
    const index = store.userProfiles.findIndex(profile => profile.id === SENIOR_JAVA_PROFILE.id);
    if (index >= 0) {
        const existing = store.userProfiles[index];
        store.userProfiles[index] = normalizeProfile({
            ...SENIOR_JAVA_PROFILE,
            prompt: {
                ...SENIOR_JAVA_PROFILE.prompt,
                userContext: existing.prompt.userContext,
            },
            behavior: existing.behavior,
        });
    }
    store.migrations.seniorJavaInterviewV4 = { done: true, updated: index >= 0 };
    setProfileStore(store);
}

function migrateSeniorJavaInterviewV5() {
    const store = getProfileStore();
    if (store.migrations.seniorJavaInterviewV5.done) return;
    const index = store.userProfiles.findIndex(profile => profile.id === SENIOR_JAVA_PROFILE.id);
    if (index >= 0) {
        const existing = store.userProfiles[index];
        store.userProfiles[index] = normalizeProfile({
            ...SENIOR_JAVA_PROFILE,
            prompt: {
                ...SENIOR_JAVA_PROFILE.prompt,
                userContext: existing.prompt.userContext,
            },
            behavior: existing.behavior,
        });
    }
    store.migrations.seniorJavaInterviewV5 = { done: true, updated: index >= 0 };
    setProfileStore(store);
}

// ============ KEYBINDS ============

function getKeybinds() {
    return readJsonFile(getKeybindsPath(), DEFAULT_KEYBINDS);
}

function setKeybinds(keybinds) {
    if (keybinds === null) return writeJsonFile(getKeybindsPath(), null);
    if (!keybinds || typeof keybinds !== 'object' || Array.isArray(keybinds)) throw new Error('Shortcuts must be an object');
    const entries = Object.entries(keybinds);
    const unknown = entries.find(([action]) => !KEYBIND_ACTIONS.has(action));
    if (unknown) throw new Error(`Unknown shortcut action "${unknown[0]}"`);
    if (entries.some(([, accelerator]) => typeof accelerator !== 'string' || !accelerator.trim() || accelerator.length > 64)) {
        throw new Error('Every shortcut must be a non-empty accelerator');
    }
    const normalized = entries.map(([action, accelerator]) => [action, accelerator.trim()]);
    if (new Set(normalized.map(([, accelerator]) => accelerator.toLocaleLowerCase())).size !== normalized.length) {
        throw new Error('Shortcuts must be unique');
    }
    return writeJsonFile(getKeybindsPath(), Object.fromEntries(normalized));
}

// ============ LIMITS (Rate Limiting) ============

function getLimits() {
    return readJsonFile(getLimitsPath(), DEFAULT_LIMITS);
}

function setLimits(limits) {
    return writeJsonFile(getLimitsPath(), limits);
}

function getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTodayLimits() {
    const limits = getLimits();
    const today = getTodayDateString();

    // Find today's entry
    const todayEntry = limits.data.find(entry => entry.date === today);

    if (todayEntry) {
        setLimits(limits);
        return todayEntry;
    }

    // No entry for today - clean old entries and create new one
    limits.data = limits.data.filter(entry => entry.date === today);
    const newEntry = {
        date: today,
        flash: { count: 0 },
        flashLite: { count: 0 },
    };
    limits.data.push(newEntry);
    setLimits(limits);

    return newEntry;
}

function incrementLimitCount(model) {
    const limits = getLimits();
    const today = getTodayDateString();

    // Find or create today's entry
    let todayEntry = limits.data.find(entry => entry.date === today);

    if (!todayEntry) {
        // Clean old entries and create new one
        limits.data = [];
        todayEntry = {
            date: today,
            flash: { count: 0 },
            flashLite: { count: 0 },
        };
        limits.data.push(todayEntry);
    } else {
        // Clean old entries, keep only today
        limits.data = limits.data.filter(entry => entry.date === today);
    }

    // Increment the appropriate model count
    if (model === 'gemini-2.5-flash') {
        todayEntry.flash.count++;
    } else if (model === 'gemini-2.5-flash-lite') {
        todayEntry.flashLite.count++;
    }

    setLimits(limits);
    return todayEntry;
}

function getAvailableModel() {
    const todayLimits = getTodayLimits();

    // RPD limits: flash = 20, flash-lite = 20
    // After both exhausted, fall back to flash (for paid API users)
    if (todayLimits.flash.count < 20) {
        return 'gemini-2.5-flash';
    } else if (todayLimits.flashLite.count < 20) {
        return 'gemini-2.5-flash-lite';
    }

    return 'gemini-2.5-flash'; // Default to flash for paid API users
}

// ============ HISTORY ============

function getSessionPath(sessionId) {
    return path.join(getHistoryDir(), `${sessionId}.json`);
}

function saveSession(sessionId, data) {
    const sessionPath = getSessionPath(sessionId);

    // Load existing session to preserve metadata
    const existingSession = readJsonFile(sessionPath, null);

    const sessionData = {
        sessionId,
        createdAt: existingSession?.createdAt || parseInt(sessionId),
        lastUpdated: Date.now(),
        // Profile context - set once when session starts
        profile: data.profile || existingSession?.profile || null,
        profileName: data.profileName || existingSession?.profileName || null,
        language: data.language || existingSession?.language || null,
        customPrompt: data.customPrompt || existingSession?.customPrompt || null,
        // Conversation data
        conversationHistory: data.conversationHistory || existingSession?.conversationHistory || [],
        screenAnalysisHistory: data.screenAnalysisHistory || existingSession?.screenAnalysisHistory || [],
    };
    return writeJsonFile(sessionPath, sessionData);
}

function getSession(sessionId) {
    return readJsonFile(getSessionPath(sessionId), null);
}

function getAllSessions() {
    const historyDir = getHistoryDir();

    try {
        if (!fs.existsSync(historyDir)) {
            return [];
        }

        const files = fs
            .readdirSync(historyDir)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => {
                // Sort by timestamp descending (newest first)
                const tsA = parseInt(a.replace('.json', ''));
                const tsB = parseInt(b.replace('.json', ''));
                return tsB - tsA;
            });

        return files
            .map(file => {
                const sessionId = file.replace('.json', '');
                const data = readJsonFile(path.join(historyDir, file), null);
                if (data) {
                    return {
                        sessionId,
                        createdAt: data.createdAt,
                        lastUpdated: data.lastUpdated,
                        messageCount: data.conversationHistory?.length || 0,
                        screenAnalysisCount: data.screenAnalysisHistory?.length || 0,
                        profile: data.profile || null,
                        profileName: data.profileName || null,
                        language: data.language || null,
                        customPrompt: data.customPrompt || null,
                    };
                }
                return null;
            })
            .filter(Boolean);
    } catch (error) {
        console.error('Error reading sessions:', error.message);
        return [];
    }
}

function deleteSession(sessionId) {
    const sessionPath = getSessionPath(sessionId);
    try {
        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
            return true;
        }
    } catch (error) {
        console.error('Error deleting session:', error.message);
    }
    return false;
}

function deleteAllSessions() {
    const historyDir = getHistoryDir();
    try {
        if (fs.existsSync(historyDir)) {
            const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
            files.forEach(file => {
                fs.unlinkSync(path.join(historyDir, file));
            });
        }
        return true;
    } catch (error) {
        console.error('Error deleting all sessions:', error.message);
        return false;
    }
}

// ============ CLEAR ALL DATA ============

function clearAllData() {
    resetConfigDir();
    return true;
}

module.exports = {
    // Initialization
    initializeStorage,
    getConfigDir,

    // Config
    getConfig,
    setConfig,
    updateConfig,

    // Credentials
    getCredentials,
    setCredentials,
    getApiKey,
    setApiKey,
    getGroqApiKey,
    setGroqApiKey,
    getGroqApiKeys,
    setGroqApiKeys,
    getGroqApiKeySequence,
    activateGroqApiKey,
    normalizeGroqApiKeys,
    normalizeGroqApiKeyIndex,
    orderGroqApiKeys,
    normalizeAudioMode,

    // Preferences
    getPreferences,
    setPreferences,
    updatePreference,

    // AI profiles
    getProfileStore,
    listAiProfiles,
    getAiProfile,
    createAiProfile,
    updateAiProfile,
    deleteAiProfile,
    importAiProfile,
    migrateLegacyCustomPrompt,

    // Keybinds
    getKeybinds,
    setKeybinds,

    // Limits (Rate Limiting)
    getLimits,
    setLimits,
    getTodayLimits,
    incrementLimitCount,
    getAvailableModel,

    // History
    saveSession,
    getSession,
    getAllSessions,
    deleteSession,
    deleteAllSessions,

    // Clear all
    clearAllData,
};
