import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { unifiedPageStyles } from './sharedPageStyles.js';

const DEFAULT_SCREEN_ANALYSIS_PROMPT =
    'Identify the single main visible question, task, code issue, or error in the central content and respond to it directly. Use only visible requirements. If the intent is unclear or essential content is cropped, say what is missing instead of guessing.';

export class CustomizeView extends LitElement {
    static styles = [
        unifiedPageStyles,
        css`
            .unified-wrap {
                max-width: 880px;
                gap: 18px;
                padding-bottom: var(--space-lg);
            }

            .page-header {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 4px 2px 8px;
            }

            .page-title {
                margin: 0;
            }

            .surface {
                padding: 22px;
            }

            .section-header {
                margin-bottom: 18px;
            }

            .surface-title {
                margin: 0 0 6px;
            }

            .surface-subtitle {
                margin: 0;
                max-width: 680px;
                font-size: var(--font-size-sm);
                line-height: 1.5;
            }

            .form-grid {
                gap: 18px;
            }

            .form-group {
                min-width: 0;
                align-items: stretch;
                flex-direction: column;
                justify-content: flex-start;
                gap: 7px;
            }

            .form-label {
                color: var(--text-primary);
                font-weight: var(--font-weight-medium);
                line-height: 1.35;
                white-space: normal;
            }

            .control {
                width: 100%;
                min-width: 0;
                min-height: 38px;
            }

            .field-help,
            .form-hint {
                max-width: 680px;
                color: var(--text-muted);
                font-size: var(--font-size-xs);
                line-height: 1.5;
                overflow-wrap: anywhere;
            }

            .field-actions {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: var(--space-sm);
                margin-top: 3px;
            }

            .secondary-button {
                min-height: 34px;
                padding: 7px 11px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg-elevated);
                color: var(--text-secondary);
                font-size: var(--font-size-xs);
                cursor: pointer;
                transition:
                    border-color var(--transition),
                    color var(--transition),
                    background var(--transition);
            }

            .secondary-button:hover {
                border-color: var(--border-strong);
                color: var(--text-primary);
            }

            .check-row {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
                line-height: 1.45;
            }

            .check-row input {
                flex: 0 0 auto;
                margin: 2px 0 0;
                accent-color: var(--accent);
                cursor: pointer;
            }

            .danger-surface {
                border-color: var(--danger);
            }

            .warning-callout {
                position: relative;
                margin-top: 4px;
                padding: 8px 12px;
                border: 1px solid var(--danger);
                border-radius: var(--radius-sm);
                color: var(--danger);
                font-size: var(--font-size-xs);
                line-height: 1.4;
                background: rgba(239, 68, 68, 0.06);
            }

            .warning-callout::before {
                content: '';
                position: absolute;
                top: -6px;
                left: 16px;
                width: 10px;
                height: 10px;
                background: var(--bg-surface);
                border-top: 1px solid var(--danger);
                border-left: 1px solid var(--danger);
                transform: rotate(45deg);
            }

            .field-help {
                color: var(--text-muted);
                font-size: var(--font-size-xs);
                line-height: 1.4;
            }

            .toggle-row {
                display: flex;
                align-items: center;
                gap: var(--space-sm);
                padding: var(--space-sm);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg-elevated);
            }

            .toggle-input {
                width: 14px;
                height: 14px;
                accent-color: var(--text-primary);
                cursor: pointer;
            }

            .toggle-label {
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                cursor: pointer;
                user-select: none;
            }

            .slider-wrap {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: var(--space-xs);
            }

            .slider-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-sm);
            }

            .slider-value {
                font-family: var(--font-mono);
                font-size: var(--font-size-xs);
                color: var(--text-secondary);
                background: var(--bg-elevated);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 2px 8px;
            }

            .slider-input {
                -webkit-appearance: none;
                appearance: none;
                width: calc(100% - 2px);
                min-width: 0;
                height: 4px;
                margin: 0 1px;
                border-radius: 2px;
                background: var(--border);
                outline: none;
                cursor: pointer;
            }

            .slider-input::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--text-primary);
                border: none;
            }

            .slider-input::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--text-primary);
                border: none;
            }

            .keybind-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 160px;
                align-items: center;
                gap: var(--space-md);
                padding: 12px 0;
                border-bottom: 1px solid var(--border);
            }

            .keybind-row:last-of-type {
                border-bottom: none;
            }

            .keybind-name {
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
                line-height: 1.4;
                overflow-wrap: anywhere;
            }

            .keybind-input {
                width: 160px;
                text-align: center;
                font-family: var(--font-mono);
                font-size: var(--font-size-xs);
            }

            .danger-button {
                border: 1px solid var(--danger);
                color: var(--danger);
                background: transparent;
                border-radius: var(--radius-sm);
                padding: 9px 12px;
                font-size: var(--font-size-sm);
                cursor: pointer;
                transition: background var(--transition);
            }

            .danger-button:hover {
                background: rgba(241, 76, 76, 0.11);
            }

            .danger-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .status {
                margin-top: var(--space-sm);
                padding: var(--space-sm);
                border-radius: var(--radius-sm);
                border: 1px solid var(--border);
                font-size: var(--font-size-xs);
            }

            .status.success {
                border-color: var(--success);
                color: var(--success);
            }

            .status.error {
                border-color: var(--danger);
                color: var(--danger);
            }

            @media (max-width: 720px) {
                .surface {
                    padding: var(--space-md);
                }

                .keybind-row {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }

                .keybind-input {
                    width: 100%;
                }
            }
        `,
    ];

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        keybinds: { type: Object },
        googleSearchEnabled: { type: Boolean },
        backgroundTransparency: { type: Number },
        fontSize: { type: Number },
        theme: { type: String },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onImageQualityChange: { type: Function },
        onLayoutModeChange: { type: Function },
        isClearing: { type: Boolean },
        isRestoring: { type: Boolean },
        clearStatusMessage: { type: String },
        clearStatusType: { type: String },
        providerMode: { type: String },
        hostedTextModel: { type: String },
        visionProvider: { type: String },
        ollamaVisionModel: { type: String },
        screenAnalysisPrompt: { type: String },
        visionIncludeConversation: { type: Boolean },
        localVisionModels: { type: Array },
        localVisionStatus: { type: String },
        audioMode: { type: String },
        speechCaptureMode: { type: String },
        microphoneDeviceId: { type: String },
        microphoneDevices: { type: Array },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.keybinds = this.getDefaultKeybinds();
        this.onProfileChange = () => {};
        this.onLanguageChange = () => {};
        this.onImageQualityChange = () => {};
        this.onLayoutModeChange = () => {};
        this.googleSearchEnabled = true;
        this.isClearing = false;
        this.isRestoring = false;
        this.clearStatusMessage = '';
        this.clearStatusType = '';
        this.backgroundTransparency = 0.8;
        this.fontSize = 20;
        this.audioMode = 'speaker_only';
        this.speechCaptureMode = 'toggle';
        this.microphoneDeviceId = '';
        this.microphoneDevices = [];
        this.customPrompt = '';
        this.theme = 'dark';
        this.providerMode = 'byok';
        this.hostedTextModel = 'openai/gpt-oss-120b';
        this.visionProvider = 'groq';
        this.ollamaVisionModel = 'qwen3-vl:4b';
        this.screenAnalysisPrompt = '';
        this.visionIncludeConversation = true;
        this.localVisionModels = [];
        this.localVisionStatus = '';
        this._loadFromStorage();
    }

    getThemes() {
        return cheatingDaddy.theme.getAll();
    }

    async _loadFromStorage() {
        try {
            const [prefs, keybinds] = await Promise.all([cheatingDaddy.storage.getPreferences(), cheatingDaddy.storage.getKeybinds()]);
            this.googleSearchEnabled = prefs.googleSearchEnabled ?? true;
            this.backgroundTransparency = prefs.backgroundTransparency ?? 0.8;
            this.fontSize = prefs.fontSize ?? 20;
            this.audioMode = prefs.audioMode === 'mic_only' ? 'mic_only' : 'speaker_only';
            this.speechCaptureMode = prefs.speechCaptureMode === 'always' ? 'always' : 'toggle';
            this.microphoneDeviceId = prefs.microphoneDeviceId || '';
            this.customPrompt = prefs.customPrompt ?? '';
            this.theme = prefs.theme ?? 'dark';
            this.providerMode = prefs.providerMode === 'local' ? 'local' : 'byok';
            this.hostedTextModel = prefs.hostedTextModel ?? 'openai/gpt-oss-120b';
            this.visionProvider = prefs.visionProvider ?? 'groq';
            this.ollamaVisionModel = prefs.ollamaVisionModel ?? 'qwen3-vl:4b';
            this.screenAnalysisPrompt = prefs.screenAnalysisPrompt ?? '';
            this.visionIncludeConversation = prefs.visionIncludeConversation !== false;
            if (this.visionProvider === 'ollama') await this.refreshLocalVisionModels();
            if (keybinds) {
                this.keybinds = { ...this.getDefaultKeybinds(), ...keybinds };
                if (keybinds.toggleSpeechCapture && !keybinds.toggleSystemAudio) {
                    this.keybinds.toggleSystemAudio = keybinds.toggleSpeechCapture;
                }
                delete this.keybinds.toggleSpeechCapture;
            }
            await this.refreshMicrophoneDevices();
            this.updateBackgroundAppearance();
            this.updateFontSize();
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    getProfiles() {
        return [
            { value: 'interview', name: 'Job Interview' },
            { value: 'sales', name: 'Sales Call' },
            { value: 'meeting', name: 'Business Meeting' },
            { value: 'presentation', name: 'Presentation' },
            { value: 'negotiation', name: 'Negotiation' },
            { value: 'exam', name: 'Exam Assistant' },
        ];
    }

    getLanguages() {
        return [
            { value: 'en-US', name: 'English (US)' },
            { value: 'en-GB', name: 'English (UK)' },
            { value: 'en-AU', name: 'English (Australia)' },
            { value: 'en-IN', name: 'English (India)' },
            { value: 'de-DE', name: 'German (Germany)' },
            { value: 'es-US', name: 'Spanish (US)' },
            { value: 'es-ES', name: 'Spanish (Spain)' },
            { value: 'fr-FR', name: 'French (France)' },
            { value: 'fr-CA', name: 'French (Canada)' },
            { value: 'hi-IN', name: 'Hindi (India)' },
            { value: 'pt-BR', name: 'Portuguese (Brazil)' },
            { value: 'ar-XA', name: 'Arabic (Generic)' },
            { value: 'id-ID', name: 'Indonesian (Indonesia)' },
            { value: 'it-IT', name: 'Italian (Italy)' },
            { value: 'ja-JP', name: 'Japanese (Japan)' },
            { value: 'tr-TR', name: 'Turkish (Turkey)' },
            { value: 'vi-VN', name: 'Vietnamese (Vietnam)' },
            { value: 'bn-IN', name: 'Bengali (India)' },
            { value: 'gu-IN', name: 'Gujarati (India)' },
            { value: 'kn-IN', name: 'Kannada (India)' },
            { value: 'ml-IN', name: 'Malayalam (India)' },
            { value: 'mr-IN', name: 'Marathi (India)' },
            { value: 'ta-IN', name: 'Tamil (India)' },
            { value: 'te-IN', name: 'Telugu (India)' },
            { value: 'nl-NL', name: 'Dutch (Netherlands)' },
            { value: 'ko-KR', name: 'Korean (South Korea)' },
            { value: 'cmn-CN', name: 'Mandarin Chinese (China)' },
            { value: 'pl-PL', name: 'Polish (Poland)' },
            { value: 'ru-RU', name: 'Russian (Russia)' },
            { value: 'th-TH', name: 'Thai (Thailand)' },
        ];
    }

    getDefaultKeybinds() {
        const isMac = cheatingDaddy.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
            moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
            moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
            moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
            previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
            nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
            scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
            scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
            toggleSystemAudio: 'F8',
            toggleMicrophone: 'F9',
        };
    }

    getKeybindActions() {
        return [
            { key: 'moveUp', name: 'Move Window Up', description: 'Move the app window up' },
            { key: 'moveDown', name: 'Move Window Down', description: 'Move the app window down' },
            { key: 'moveLeft', name: 'Move Window Left', description: 'Move the app window left' },
            { key: 'moveRight', name: 'Move Window Right', description: 'Move the app window right' },
            { key: 'toggleVisibility', name: 'Toggle Visibility', description: 'Show or hide the app window' },
            { key: 'toggleClickThrough', name: 'Toggle Click-through', description: 'Enable or disable click-through mode' },
            { key: 'nextStep', name: 'Ask Next Step', description: 'Take screenshot and ask for next step' },
            { key: 'previousResponse', name: 'Previous Response', description: 'Move to previous AI response' },
            { key: 'nextResponse', name: 'Next Response', description: 'Move to next AI response' },
            { key: 'scrollUp', name: 'Scroll Response Up', description: 'Scroll response content upward' },
            { key: 'scrollDown', name: 'Scroll Response Down', description: 'Scroll response content downward' },
            { key: 'toggleSystemAudio', name: 'System Audio Recording', description: 'Start or stop System Audio recording' },
            { key: 'toggleMicrophone', name: 'Microphone Recording', description: 'Start or stop microphone recording' },
        ];
    }

    async saveKeybinds() {
        await cheatingDaddy.storage.setKeybinds(this.keybinds);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    async handleProfileSelect(e) {
        const next = e.target.value;
        try {
            await this.onProfileChange(next);
            this.selectedProfile = next;
        } catch (error) {
            this.showSettingsError(error);
        }
    }

    async handleLanguageSelect(e) {
        const next = e.target.value;
        try {
            await this.onLanguageChange(next);
            this.selectedLanguage = next;
        } catch (error) {
            this.showSettingsError(error);
        }
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(this.selectedImageQuality);
    }

    handleLayoutModeSelect(e) {
        this.layoutMode = e.target.value;
        this.onLayoutModeChange(this.layoutMode);
    }

    async handleCustomPromptInput(e) {
        this.customPrompt = e.target.value;
        await cheatingDaddy.storage.updatePreference('customPrompt', this.customPrompt);
    }

    async handleAudioModeSelect(e) {
        await this.savePreference('audioMode', e.target.value);
    }

    async handleSpeechCaptureModeSelect(e) {
        await this.savePreference('speechCaptureMode', e.target.value);
        await cheatingDaddy.refreshPreferencesCache();
    }

    async handleMicrophoneDeviceSelect(e) {
        await this.savePreference('microphoneDeviceId', e.target.value);
    }

    async savePreference(property, value) {
        const previous = this[property];
        try {
            await cheatingDaddy.storage.updatePreference(property, value);
            this[property] = value;
            this.clearStatusMessage = '';
        } catch (error) {
            this[property] = previous;
            this.showSettingsError(error);
        }
        this.requestUpdate();
    }

    showSettingsError(error) {
        this.clearStatusMessage = error?.message || 'Could not save the setting';
        this.clearStatusType = 'error';
        this.requestUpdate();
    }

    async refreshMicrophoneDevices(requestPermission = false) {
        try {
            this.microphoneDevices = await cheatingDaddy.getMicrophoneDevices(requestPermission);
            this.clearStatusMessage = '';
        } catch (error) {
            console.warn('Could not list microphones:', error.message);
            this.microphoneDevices = [];
            if (requestPermission) this.showSettingsError(error);
        }
    }

    async handleHostedTextModelSelect(e) {
        this.hostedTextModel = e.target.value;
        await cheatingDaddy.storage.updatePreference('hostedTextModel', this.hostedTextModel);
        this.requestUpdate();
    }

    async handleVisionProviderSelect(e) {
        this.visionProvider = e.target.value;
        await cheatingDaddy.storage.updatePreference('visionProvider', this.visionProvider);
        if (this.visionProvider === 'ollama') await this.refreshLocalVisionModels();
        this.requestUpdate();
    }

    async handleOllamaVisionModelSelect(e) {
        this.ollamaVisionModel = e.target.value;
        await cheatingDaddy.storage.updatePreference('ollamaVisionModel', this.ollamaVisionModel);
    }

    async handleScreenAnalysisPrompt(e) {
        this.screenAnalysisPrompt = e.target.value.trim() || DEFAULT_SCREEN_ANALYSIS_PROMPT;
        await cheatingDaddy.storage.updatePreference('screenAnalysisPrompt', this.screenAnalysisPrompt);
        this.requestUpdate();
    }

    async resetScreenAnalysisPrompt() {
        this.screenAnalysisPrompt = DEFAULT_SCREEN_ANALYSIS_PROMPT;
        await cheatingDaddy.storage.updatePreference('screenAnalysisPrompt', this.screenAnalysisPrompt);
        this.requestUpdate();
    }

    async handleVisionContextChange(e) {
        this.visionIncludeConversation = e.target.checked;
        await cheatingDaddy.storage.updatePreference('visionIncludeConversation', this.visionIncludeConversation);
    }

    async refreshLocalVisionModels() {
        this.localVisionStatus = 'Checking Ollama...';
        this.requestUpdate();
        try {
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('list-local-vision-models');
            this.localVisionModels = result.models || [];
            this.localVisionStatus = result.success
                ? this.localVisionModels.length
                    ? 'Verified Vision support'
                    : 'No installed Vision models found'
                : `Ollama unavailable: ${result.error}`;
            if (this.localVisionModels.length && !this.localVisionModels.includes(this.ollamaVisionModel)) {
                this.ollamaVisionModel = this.localVisionModels[0];
                await cheatingDaddy.storage.updatePreference('ollamaVisionModel', this.ollamaVisionModel);
            }
        } catch (error) {
            this.localVisionModels = [];
            this.localVisionStatus = `Ollama unavailable: ${error.message}`;
        }
        this.requestUpdate();
    }

    async handleThemeChange(e) {
        this.theme = e.target.value;
        await cheatingDaddy.theme.save(this.theme);
        this.updateBackgroundAppearance();
        this.requestUpdate();
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        await cheatingDaddy.storage.updatePreference('googleSearchEnabled', this.googleSearchEnabled);
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }
        this.requestUpdate();
    }

    async handleBackgroundTransparencyChange(e) {
        this.backgroundTransparency = parseFloat(e.target.value);
        await cheatingDaddy.storage.updatePreference('backgroundTransparency', this.backgroundTransparency);
        this.updateBackgroundAppearance();
        this.requestUpdate();
    }

    updateBackgroundAppearance() {
        const colors = cheatingDaddy.theme.get(this.theme);
        cheatingDaddy.theme.applyBackgrounds(colors.background, this.backgroundTransparency);
    }

    async handleFontSizeChange(e) {
        this.fontSize = parseInt(e.target.value, 10);
        await cheatingDaddy.storage.updatePreference('fontSize', this.fontSize);
        this.updateFontSize();
        this.requestUpdate();
    }

    updateFontSize() {
        document.documentElement.style.setProperty('--response-font-size', `${this.fontSize}px`);
    }

    async handleKeybindChange(action, value) {
        const duplicate = Object.entries(this.keybinds).find(([key, keybind]) => key !== action && keybind === value);
        if (duplicate) {
            this.clearStatusMessage = `${value} is already assigned. Choose another shortcut.`;
            this.clearStatusType = 'error';
            this.requestUpdate();
            return false;
        }
        this.clearStatusMessage = '';
        const previous = this.keybinds;
        this.keybinds = { ...this.keybinds, [action]: value };
        try {
            await this.saveKeybinds();
            this.requestUpdate();
            return true;
        } catch (error) {
            this.keybinds = previous;
            this.showSettingsError(error);
            return false;
        }
    }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    async handleKeybindInput(e) {
        e.preventDefault();
        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        let mainKey = e.key;

        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            default:
                if (e.key.length === 1) mainKey = e.key.toUpperCase();
                break;
        }

        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;

        const action = e.target.dataset.action;
        const keybind = [...modifiers, mainKey].join('+');
        if (await this.handleKeybindChange(action, keybind)) e.target.value = keybind;
        e.target.blur();
    }

    async resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        await cheatingDaddy.storage.setKeybinds(null);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
        this.requestUpdate();
    }

    async restoreAllSettings() {
        if (this.isRestoring) return;
        this.isRestoring = true;
        this.clearStatusMessage = '';
        this.clearStatusType = '';
        this.requestUpdate();
        try {
            // Restore all preferences to defaults
            const defaults = {
                customPrompt: '',
                selectedProfile: 'interview',
                selectedLanguage: 'en-US',
                selectedScreenshotInterval: '5',
                selectedImageQuality: 'medium',
                audioMode: 'speaker_only',
                speechCaptureMode: 'toggle',
                microphoneDeviceId: '',
                fontSize: 20,
                backgroundTransparency: 0.8,
                googleSearchEnabled: false,
                theme: 'dark',
                hostedTextModel: 'openai/gpt-oss-120b',
                visionProvider: 'groq',
                groqVisionModel: 'qwen/qwen3.6-27b',
                ollamaVisionModel: 'qwen3-vl:4b',
                screenAnalysisPrompt: DEFAULT_SCREEN_ANALYSIS_PROMPT,
                visionIncludeConversation: true,
            };
            for (const [key, value] of Object.entries(defaults)) {
                await cheatingDaddy.storage.updatePreference(key, value);
            }

            // Restore keybinds
            this.keybinds = this.getDefaultKeybinds();
            await cheatingDaddy.storage.setKeybinds(null);
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('update-keybinds', this.keybinds);
            }

            // Apply to local state
            this.selectedProfile = defaults.selectedProfile;
            this.selectedLanguage = defaults.selectedLanguage;
            this.selectedImageQuality = defaults.selectedImageQuality;
            this.audioMode = defaults.audioMode;
            this.speechCaptureMode = defaults.speechCaptureMode;
            this.microphoneDeviceId = defaults.microphoneDeviceId;
            this.fontSize = defaults.fontSize;
            this.backgroundTransparency = defaults.backgroundTransparency;
            this.googleSearchEnabled = defaults.googleSearchEnabled;
            this.customPrompt = defaults.customPrompt;
            this.theme = defaults.theme;
            this.hostedTextModel = defaults.hostedTextModel;
            this.visionProvider = defaults.visionProvider;
            this.ollamaVisionModel = defaults.ollamaVisionModel;
            this.screenAnalysisPrompt = defaults.screenAnalysisPrompt;
            this.visionIncludeConversation = defaults.visionIncludeConversation;

            // Notify parent callbacks
            this.onProfileChange(defaults.selectedProfile);
            this.onLanguageChange(defaults.selectedLanguage);
            this.onImageQualityChange(defaults.selectedImageQuality);

            // Apply visual changes
            this.updateBackgroundAppearance();
            this.updateFontSize();
            await cheatingDaddy.theme.save(defaults.theme);

            this.clearStatusMessage = 'All settings restored to defaults';
            this.clearStatusType = 'success';
        } catch (error) {
            console.error('Error restoring settings:', error);
            this.clearStatusMessage = `Error restoring settings: ${error.message}`;
            this.clearStatusType = 'error';
        } finally {
            this.isRestoring = false;
            this.requestUpdate();
        }
    }

    async clearLocalData() {
        if (this.isClearing) return;
        this.isClearing = true;
        this.clearStatusMessage = '';
        this.clearStatusType = '';
        this.requestUpdate();
        try {
            await cheatingDaddy.storage.clearAll();
            this.clearStatusMessage = 'Successfully cleared all local data';
            this.clearStatusType = 'success';
            this.requestUpdate();
            setTimeout(() => {
                this.clearStatusMessage = 'Closing application...';
                this.requestUpdate();
                setTimeout(async () => {
                    if (window.require) {
                        const { ipcRenderer } = window.require('electron');
                        await ipcRenderer.invoke('quit-application');
                    }
                }, 1000);
            }, 2000);
        } catch (error) {
            console.error('Error clearing data:', error);
            this.clearStatusMessage = `Error clearing data: ${error.message}`;
            this.clearStatusType = 'error';
        } finally {
            this.isClearing = false;
            this.requestUpdate();
        }
    }

    renderAudioSection() {
        return html`
            <section class="surface">
                <div class="section-header">
                    <div class="surface-title">Audio Input</div>
                    <div class="surface-subtitle">Choose how speech recording starts and which input is used.</div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Audio Mode</label>
                        <select class="control" .value=${this.audioMode} @change=${this.handleAudioModeSelect}>
                            <option value="speaker_only">System Audio</option>
                            <option value="mic_only">Microphone</option>
                        </select>
                        <div class="field-help">
                            Used by Always listen. In Toggle-to-talk, ${this.keybinds.toggleSystemAudio} always records System Audio and
                            ${this.keybinds.toggleMicrophone} always records Microphone.
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Speech Recording</label>
                        <select class="control" .value=${this.speechCaptureMode} @change=${this.handleSpeechCaptureModeSelect}>
                            <option value="toggle">Start / stop with shortcuts (recommended)</option>
                            <option value="always">Always listen</option>
                        </select>
                        <div class="field-help">
                            Press ${this.keybinds.toggleSystemAudio} once to start System Audio and again to send. Use
                            ${this.keybinds.toggleMicrophone} the same way for Microphone. Long recordings are transcribed in parts but sent as one
                            question.
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Microphone</label>
                        <select class="control" .value=${this.microphoneDeviceId} @change=${this.handleMicrophoneDeviceSelect}>
                            <option value="">Windows default microphone</option>
                            ${this.microphoneDevices.map(device => html`<option value=${device.deviceId}>${device.label}</option>`)}
                        </select>
                        <div class="field-help">Used by ${this.keybinds.toggleMicrophone} and by Always listen when Audio Mode is Microphone.</div>
                        <div class="field-actions">
                            <button class="secondary-button" @click=${() => this.refreshMicrophoneDevices(true)}>Refresh microphones</button>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderHostedModelsSection() {
        if (this.providerMode !== 'byok') return '';

        return html`
            <section class="surface">
                <div class="section-header">
                    <div class="surface-title">AI Models</div>
                    <div class="surface-subtitle">Select the hosted model used to generate answers from typed questions and transcripts.</div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Text Response Model</label>
                        <select class="control" .value=${this.hostedTextModel} @change=${this.handleHostedTextModelSelect}>
                            <option value="openai/gpt-oss-120b">GPT-OSS 120B — Quality (recommended)</option>
                            <option value="openai/gpt-oss-20b">GPT-OSS 20B — Faster</option>
                            <option value="qwen/qwen3.6-27b">Qwen 3.6 27B — Preview (explicit only)</option>
                        </select>
                        <div class="form-hint">Used only to generate text answers from transcripts and typed questions.</div>
                    </div>
                </div>
            </section>
        `;
    }

    renderVisionSection() {
        return html`
            <section class="surface">
                <div class="section-header">
                    <div class="surface-title">Screenshot Analysis</div>
                    <div class="surface-subtitle">Configure where screenshots are processed and what context is sent with them.</div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Vision Provider</label>
                        <select class="control" .value=${this.visionProvider} @change=${this.handleVisionProviderSelect}>
                            <option value="disabled">Off</option>
                            <option value="groq">Groq — Hosted quality</option>
                            <option value="ollama">Ollama — Local/private</option>
                        </select>
                    </div>
                    ${
                        this.visionProvider === 'groq'
                            ? html`<div class="form-group">
                                  <label class="form-label">Vision Model</label>
                                  <select class="control" disabled>
                                      <option>Qwen 3.6 27B (Preview)</option>
                                  </select>
                                  <div class="form-hint">Uses the active Groq key pool. Screenshots are sent to Groq.</div>
                              </div>`
                            : ''
                    }
                    ${
                        this.visionProvider === 'ollama'
                            ? html`<div class="form-group">
                                  <label class="form-label">Local Vision Model</label>
                                  <select
                                      class="control"
                                      .value=${this.ollamaVisionModel}
                                      @change=${this.handleOllamaVisionModelSelect}
                                      ?disabled=${!this.localVisionModels.length}
                                  >
                                      ${this.localVisionModels.map(model => html`<option value=${model}>${model}</option>`)}
                                  </select>
                                  <div class="field-help">${this.localVisionStatus}</div>
                                  <div class="field-actions">
                                      <button class="secondary-button" @click=${this.refreshLocalVisionModels}>Refresh Ollama models</button>
                                  </div>
                              </div>`
                            : ''
                    }
                    ${
                        this.visionProvider !== 'disabled'
                            ? html`<div class="form-group">
                                  <label class="form-label">Screenshot Instruction</label>
                                  <textarea
                                      class="control"
                                      rows="5"
                                      .value=${this.screenAnalysisPrompt}
                                      @change=${this.handleScreenAnalysisPrompt}
                                  ></textarea>
                                  <label class="check-row">
                                      <input type="checkbox" .checked=${this.visionIncludeConversation} @change=${this.handleVisionContextChange} />
                                      Include the last two conversation turns
                                  </label>
                                  <div class="field-actions">
                                      <button class="secondary-button" @click=${this.resetScreenAnalysisPrompt}>Reset instruction</button>
                                  </div>
                              </div>`
                            : ''
                    }
                    <div class="form-group">
                        <label class="form-label">Screenshot Quality</label>
                        <select class="control" .value=${this.selectedImageQuality} @change=${this.handleImageQualitySelect}>
                            <option value="high">High Quality</option>
                            <option value="medium">Medium Quality</option>
                            <option value="low">Low Quality</option>
                        </select>
                        <div class="field-help">Higher quality preserves more detail but increases processing time and request size.</div>
                    </div>
                </div>
            </section>
        `;
    }

    renderLanguageSection() {
        return html`
            <section class="surface">
                <div class="section-header">
                    <div class="surface-title">Language</div>
                    <div class="surface-subtitle">The assistant uses this language for speech recognition and generated answers.</div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label" for="speech-language">Speech Language</label>
                        <select id="speech-language" class="control" @change=${this.handleLanguageSelect}>
                            ${this.getLanguages().map(
                                language =>
                                    html`<option value=${language.value} ?selected=${this.selectedLanguage === language.value}>${language.name}</option>`
                            )}
                        </select>
                    </div>
                </div>
            </section>
        `;
    }

    renderAppearanceSection() {
        return html`
            <section class="surface">
                <div class="section-header">
                    <div class="surface-title">Appearance</div>
                    <div class="surface-subtitle">Adjust how the application and generated responses are displayed.</div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Theme</label>
                        <select class="control" .value=${this.theme} @change=${this.handleThemeChange}>
                            ${this.getThemes().map(theme => html`<option value=${theme.value}>${theme.name}</option>`)}
                        </select>
                    </div>
                    <div class="form-group slider-wrap">
                        <div class="slider-header">
                            <label class="form-label">Background Transparency</label>
                            <span class="slider-value">${Math.round(this.backgroundTransparency * 100)}%</span>
                        </div>
                        <input
                            class="slider-input"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            .value=${this.backgroundTransparency}
                            @input=${this.handleBackgroundTransparencyChange}
                        />
                    </div>
                    <div class="form-group slider-wrap">
                        <div class="slider-header">
                            <label class="form-label">Response Font Size</label>
                            <span class="slider-value">${this.fontSize}px</span>
                        </div>
                        <input
                            class="slider-input"
                            type="range"
                            min="12"
                            max="32"
                            step="1"
                            .value=${this.fontSize}
                            @input=${this.handleFontSizeChange}
                        />
                    </div>
                </div>
            </section>
        `;
    }

    renderKeyboardSection() {
        return html`
            <section class="surface">
                <div class="section-header">
                    <div class="surface-title">Keyboard Shortcuts</div>
                    <div class="surface-subtitle">Select a shortcut field, then press the key combination you want to assign.</div>
                </div>
                ${this.getKeybindActions().map(
                    action => html`
                        <div class="keybind-row">
                            <span class="keybind-name">${action.name}</span>
                            <input
                                type="text"
                                class="control keybind-input"
                                .value=${this.keybinds[action.key]}
                                data-action=${action.key}
                                @keydown=${this.handleKeybindInput}
                                @focus=${this.handleKeybindFocus}
                                readonly
                            />
                        </div>
                    `
                )}
                <div class="field-actions">
                    <button class="secondary-button" @click=${this.resetKeybinds}>Reset to defaults</button>
                </div>
                ${this.clearStatusMessage && this.clearStatusType === 'error' ? html`<div class="status error">${this.clearStatusMessage}</div>` : ''}
            </section>
        `;
    }

    renderPrivacySection() {
        return html`
            <section class="surface danger-surface">
                <div class="section-header">
                    <div class="surface-title danger">Privacy and Data</div>
                    <div class="surface-subtitle">Reset preferences or permanently remove locally stored application data.</div>
                </div>
                <div class="field-actions">
                    <button class="danger-button" @click=${this.restoreAllSettings} ?disabled=${this.isRestoring}>
                        ${this.isRestoring ? 'Restoring...' : 'Restore all settings'}
                    </button>
                    <button class="danger-button" @click=${this.clearLocalData} ?disabled=${this.isClearing}>
                        ${this.isClearing ? 'Clearing...' : 'Delete all data'}
                    </button>
                </div>
                ${
                    this.clearStatusMessage
                        ? html` <div class="status ${this.clearStatusType === 'success' ? 'success' : 'error'}">${this.clearStatusMessage}</div> `
                        : ''
                }
            </section>
        `;
    }

    render() {
        return html`
            <div class="unified-page">
                <div class="unified-wrap">
                    <header class="page-header">
                        <div class="page-title">Settings</div>
                        <div class="page-subtitle">Configure models, audio, language, appearance, and shortcuts.</div>
                    </header>
                    ${this.renderHostedModelsSection()} ${this.renderVisionSection()} ${this.renderAudioSection()} ${this.renderLanguageSection()}
                    ${this.renderAppearanceSection()} ${this.renderKeyboardSection()} ${this.renderPrivacySection()}
                </div>
            </div>
        `;
    }
}

customElements.define('customize-view', CustomizeView);
