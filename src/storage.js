const fs = require('fs');
const path = require('path');
const os = require('os');
const { DEFAULT_GROQ_MODEL, GROQ_MODELS } = require('./utils/groq');
const { DEFAULT_OMNIROUTE_BASE_URL, DEFAULT_OMNIROUTE_MODEL, normalizeOmniRouteBaseUrl, normalizeOmniRouteModel } = require('./utils/omniroute');
const { GROQ_VISION_MODEL, DEFAULT_OLLAMA_VISION_MODEL, DEFAULT_SCREEN_ANALYSIS_PROMPT, normalizeVisionProvider } = require('./utils/vision');
const { PROFILE_SCHEMA_VERSION, SENIOR_JAVA_PROFILE, importProfile, normalizeProfile, normalizeUserProfiles } = require('./utils/aiProfiles');
const { getAvailableProfiles } = require('./utils/prompts');
const EPAM_HR_PROFILE_V2 = normalizeProfile(require('../profiles/epam-hr-call.json').profile);

const CONFIG_VERSION = 1;
const HOSTED_TEXT_MODELS = new Set(GROQ_MODELS);

function normalizeHostedTextModel(model) {
    if (HOSTED_TEXT_MODELS.has(model)) return model;
    if (model !== undefined) console.warn(`Unknown hosted text model "${model}"; using ${DEFAULT_GROQ_MODEL}`);
    return DEFAULT_GROQ_MODEL;
}

function normalizeHostedTextProvider(provider) {
    return provider === 'omniroute' ? 'omniroute' : 'groq';
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
    omnirouteApiKey: '',
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
    return value === 'toggle' ? 'toggle' : 'always';
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
    speechCaptureMode: 'always',
    fontSize: 'medium',
    backgroundTransparency: 0.8,
    googleSearchEnabled: false,
    hostedTextModel: DEFAULT_GROQ_MODEL,
    hostedTextProvider: 'groq',
    omnirouteBaseUrl: DEFAULT_OMNIROUTE_BASE_URL,
    omnirouteTextModel: DEFAULT_OMNIROUTE_MODEL,
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
    migrations: { customPromptV1: { done: false, profileId: null }, epamHrProfileV2: { done: false, updated: false } },
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
    }
    return defaultValue;
}

// Helper to write JSON file safely
function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        return false;
    }
}

// Check if we need to reset (no configVersion or wrong version)
function needsReset() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return true;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return !config.configVersion || config.configVersion !== CONFIG_VERSION;
    } catch {
        return true;
    }
}

// Wipe and reinitialize the config directory
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
    if (needsReset()) {
        resetConfigDir();
    } else {
        // Ensure history directory exists
        const historyDir = getHistoryDir();
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
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

function getOmniRouteApiKey() {
    const value = getCredentials().omnirouteApiKey;
    return typeof value === 'string' ? value.trim() : '';
}

function setOmniRouteApiKey(omnirouteApiKey) {
    return setCredentials({ omnirouteApiKey: typeof omnirouteApiKey === 'string' ? omnirouteApiKey.trim() : '' });
}

// ============ PREFERENCES ============

function getPreferences() {
    const saved = readJsonFile(getPreferencesPath(), {});
    return {
        ...DEFAULT_PREFERENCES,
        ...saved,
        audioMode: normalizeAudioMode(saved.audioMode),
        speechCaptureMode: normalizeSpeechCaptureMode(saved.speechCaptureMode),
        hostedTextModel: normalizeHostedTextModel(saved.hostedTextModel),
        hostedTextProvider: normalizeHostedTextProvider(saved.hostedTextProvider),
        omnirouteBaseUrl: normalizeOmniRouteBaseUrl(saved.omnirouteBaseUrl),
        omnirouteTextModel: normalizeOmniRouteModel(saved.omnirouteTextModel),
        visionProvider: normalizeVisionProvider(saved.visionProvider),
        groqVisionModel: GROQ_VISION_MODEL,
        ollamaVisionModel:
            typeof saved.ollamaVisionModel === 'string' && saved.ollamaVisionModel.trim()
                ? saved.ollamaVisionModel.trim()
                : DEFAULT_OLLAMA_VISION_MODEL,
        screenAnalysisPrompt:
            typeof saved.screenAnalysisPrompt === 'string' && saved.screenAnalysisPrompt.trim()
                ? saved.screenAnalysisPrompt
                : DEFAULT_SCREEN_ANALYSIS_PROMPT,
        visionIncludeConversation: saved.visionIncludeConversation !== false,
        availableProfiles: listAiProfiles(),
    };
}

function persistPreferences(preferences) {
    const { availableProfiles, ...persisted } = preferences;
    persisted.hostedTextModel = normalizeHostedTextModel(persisted.hostedTextModel);
    persisted.hostedTextProvider = normalizeHostedTextProvider(persisted.hostedTextProvider);
    persisted.omnirouteBaseUrl = normalizeOmniRouteBaseUrl(persisted.omnirouteBaseUrl);
    persisted.omnirouteTextModel = normalizeOmniRouteModel(persisted.omnirouteTextModel);
    persisted.visionProvider = normalizeVisionProvider(persisted.visionProvider);
    persisted.audioMode = normalizeAudioMode(persisted.audioMode);
    persisted.speechCaptureMode = normalizeSpeechCaptureMode(persisted.speechCaptureMode);
    persisted.groqVisionModel = GROQ_VISION_MODEL;
    return writeJsonFile(getPreferencesPath(), persisted);
}

function setPreferences(preferences) {
    const current = getPreferences();
    const { availableProfiles, ...persistedCurrent } = current;
    return persistPreferences({ ...persistedCurrent, ...preferences });
}

function updatePreference(key, value) {
    const preferences = getPreferences();
    preferences[key] =
        key === 'hostedTextModel'
            ? normalizeHostedTextModel(value)
            : key === 'hostedTextProvider'
              ? normalizeHostedTextProvider(value)
              : key === 'omnirouteBaseUrl'
                ? normalizeOmniRouteBaseUrl(value)
                : key === 'omnirouteTextModel'
                  ? normalizeOmniRouteModel(value)
                  : key === 'visionProvider'
                    ? normalizeVisionProvider(value)
                    : key === 'audioMode'
                      ? normalizeAudioMode(value)
                      : key === 'speechCaptureMode'
                        ? normalizeSpeechCaptureMode(value)
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

// ============ KEYBINDS ============

function getKeybinds() {
    return readJsonFile(getKeybindsPath(), DEFAULT_KEYBINDS);
}

function setKeybinds(keybinds) {
    return writeJsonFile(getKeybindsPath(), keybinds);
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
    getOmniRouteApiKey,
    setOmniRouteApiKey,
    normalizeGroqApiKeys,
    normalizeGroqApiKeyIndex,
    orderGroqApiKeys,
    normalizeAudioMode,
    normalizeHostedTextProvider,

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
