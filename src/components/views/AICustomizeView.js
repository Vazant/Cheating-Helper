import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { unifiedPageStyles } from './sharedPageStyles.js';

const LENGTHS = {
    auto: ['Automatic', 'Adapts to the question: short for simple topics, fuller for technical explanations.'],
    concise: ['Short', 'About 4–6 sentences with only the essential mechanism and conclusion.'],
    standard: ['Full', 'About 10–18 sentences with an example, pitfalls, and trade-offs.'],
    detailed: ['Deep', 'About 18–30 sentences for internals, alternatives, and production details.'],
};

const FORMATS = {
    teleprompter: ['Natural speech', 'Short paragraphs written to be read aloud.'],
    structured: ['Structured', 'Headings and lists when they improve a complex explanation.'],
    plain: ['Plain text', 'Simple readable text with minimal Markdown.'],
};

export class AICustomizeView extends LitElement {
    static styles = [
        unifiedPageStyles,
        css`
            .unified-page, .unified-wrap { height: 100%; }
            .unified-wrap { max-width: 900px; overflow-y: auto; }
            .surface { padding: var(--space-lg); }
            .profile-form { display: flex; flex-direction: column; gap: var(--space-xl); }
            .profile-form .form-group { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 6px; }
            .profile-form .control { width: 100%; }
            .toolbar, .field-meta, .preview-heading { display: flex; align-items: center; gap: var(--space-sm); }
            .toolbar { flex-wrap: wrap; margin-top: var(--space-sm); }
            .toolbar button, .preview-heading button { width: auto; }
            .section { display: flex; flex-direction: column; gap: var(--space-md); }
            .section + .section { border-top: 1px solid var(--border); padding-top: var(--space-xl); }
            .section-title { color: var(--text-primary); font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); }
            .section-description { color: var(--text-muted); font-size: var(--font-size-sm); line-height: 1.5; margin-top: -8px; }
            .compact-grid, .preference-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-md); }
            .callout { padding: var(--space-md); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-elevated); color: var(--text-secondary); font-size: var(--font-size-sm); line-height: 1.5; }
            .field-meta { justify-content: space-between; color: var(--text-muted); font-size: var(--font-size-xs); line-height: 1.4; }
            .field-meta span:first-child { max-width: 78%; }
            textarea.control { resize: vertical; user-select: text; }
            textarea.background { min-height: 280px; }
            textarea.role { min-height: 140px; }
            textarea.rules { min-height: 220px; }
            textarea.preview { min-height: 280px; font-family: var(--font-mono); }
            .preference-help { color: var(--text-muted); font-size: var(--font-size-xs); line-height: 1.45; min-height: 36px; }
            details.preview-panel { border-top: 1px solid var(--border); padding-top: var(--space-lg); }
            details.preview-panel summary { cursor: pointer; color: var(--text-secondary); font-weight: var(--font-weight-medium); }
            .preview-content { display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-md); }
            .preview-heading { justify-content: space-between; }
            .error { color: var(--danger); font-size: var(--font-size-sm); }
            @media (max-width: 720px) {
                .unified-page { padding: var(--space-md); }
                .surface { padding: var(--space-md); }
                .compact-grid, .preference-grid { grid-template-columns: 1fr; }
                .field-meta { align-items: flex-start; flex-direction: column; }
                .field-meta span:first-child { max-width: none; }
            }
        `,
    ];

    static properties = {
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        _profiles: { state: true },
        _draft: { state: true },
        _preview: { state: true },
        _error: { state: true },
        _copied: { state: true },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this._profiles = [];
        this._draft = null;
        this._preview = '';
        this._error = '';
        this._copied = false;
        this._load();
    }

    updated(changed) {
        if (changed.has('selectedProfile') && changed.get('selectedProfile') !== undefined) this._selectDraft();
    }

    async _load() {
        const prefs = await cheatingDaddy.storage.getPreferences();
        this._profiles = prefs.availableProfiles || [];
        this._selectDraft();
    }

    _selectDraft() {
        const profile = this._profiles.find(item => item.id === this.selectedProfile) || this._profiles[0];
        if (!profile) return;
        this._draft = JSON.parse(JSON.stringify(profile));
        this._refreshPreview();
    }

    async _select(id) {
        await this.onProfileChange(id);
        this.selectedProfile = id;
        this._selectDraft();
    }

    async _refreshPreview() {
        if (this._draft) this._preview = await cheatingDaddy.storage.compileAiProfile(this._draft);
    }

    async _patch(patch) {
        try {
            this._error = '';
            const result = await cheatingDaddy.storage.updateAiProfile(this._draft.id, patch);
            await this._load();
            if (result.createdCopy || result.profile.id !== this.selectedProfile) await this._select(result.profile.id);
            else this._draft = result.profile;
            await this._refreshPreview();
        } catch (error) {
            this._error = error.message;
        }
    }

    _promptField(field, value) {
        this._draft = { ...this._draft, prompt: { ...this._draft.prompt, [field]: value } };
        return this._patch({ prompt: { [field]: value } });
    }

    async _new(sourceId = null) {
        const profile = await cheatingDaddy.storage.createAiProfile(sourceId);
        await this._load();
        await this._select(profile.id);
    }

    async _delete() {
        if (this._draft?.isBuiltin || !confirm(`Delete "${this._draft?.name}"?`)) return;
        const fallback = await cheatingDaddy.storage.deleteAiProfile(this._draft.id);
        await this._load();
        await this._select(fallback);
    }

    async _import(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const profile = await cheatingDaddy.storage.importAiProfile(await file.text());
            await this._load();
            await this._select(profile.id);
        } catch (error) {
            this._error = error.message;
        }
        e.target.value = '';
    }

    _export() {
        const { id, isBuiltin, schemaVersion, ...portable } = this._draft;
        const json = JSON.stringify({ schemaVersion: 2, type: 'cheating-helper-profile', profile: portable }, null, 2);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        link.download = `${this._draft.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'profile'}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async _copyPreview() {
        await navigator.clipboard.writeText(this._preview);
        this._copied = true;
        setTimeout(() => (this._copied = false), 1500);
    }

    _size(value = '') {
        return `${value.length.toLocaleString()} characters · about ${Math.ceil(value.length / 4).toLocaleString()} tokens`;
    }

    render() {
        if (!this._draft) return html`<div class="unified-page"><div class="unified-wrap">Loading profiles…</div></div>`;
        const builtIns = this._profiles.filter(profile => profile.isBuiltin);
        const custom = this._profiles.filter(profile => !profile.isBuiltin);
        const p = this._draft.prompt;
        return html`
            <div class="unified-page"><div class="unified-wrap">
                <div><div class="page-title">AI Profiles</div><div class="page-subtitle">Create reusable instructions for different conversations and tasks.</div></div>
                <section class="surface profile-form">
                    <div class="section">
                        <div class="form-group"><label class="form-label">Active profile</label><select class="control" .value=${this._draft.id} @change=${e => this._select(e.target.value)}>
                            <optgroup label="Built-in">${builtIns.map(x => html`<option value=${x.id}>${x.name}</option>`)}</optgroup>
                            <optgroup label="My profiles">${custom.map(x => html`<option value=${x.id}>${x.name}</option>`)}</optgroup>
                        </select></div>
                        <div class="toolbar">
                            <button class="control" @click=${() => this._new()}>New</button>
                            <button class="control" @click=${() => this._new(this._draft.id)}>Duplicate</button>
                            <button class="control" @click=${() => this.shadowRoot.querySelector('#import').click()}>Import</button>
                            <button class="control" @click=${this._export}>Export</button>
                            <button class="control" ?disabled=${this._draft.isBuiltin} @click=${this._delete}>Delete</button>
                            <input id="import" hidden type="file" accept="application/json,.json" @change=${this._import} />
                        </div>
                        <div class="callout">A profile controls which facts the assistant may use and how it should answer. AI models, API keys, audio, and screenshot processing are configured separately in Settings.</div>
                        ${this._draft.isBuiltin ? html`<div class="form-help">This is a built-in template. The first edit automatically creates your own copy.</div>` : ''}
                        ${this._error ? html`<div class="error">${this._error}</div>` : ''}
                    </div>

                    <div class="section">
                        <div class="section-title">About this profile</div>
                        <div class="section-description">A name and short description help you choose the right profile later.</div>
                        <div class="compact-grid">
                            ${this._inputField('Name', this._draft.name, value => this._patch({ name: value }), 'Example: Product Manager Interview')}
                            ${this._inputField('Description', this._draft.description, value => this._patch({ description: value }), 'What this profile is for')}
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">Your background</div>
                        <div class="section-description">Facts the assistant may rely on. Put your CV, projects, experience, goals, and factual constraints here—not instructions about writing style.</div>
                        ${this._textareaField('About you / Facts the assistant may use', p.userContext, value => this._promptField('userContext', value), 'background', 'Example: role, years of experience, projects, measurable results, facts that must not be invented.')}
                    </div>

                    <div class="section">
                        <div class="section-title">How the assistant should answer</div>
                        <div class="section-description">Define the assistant’s role separately from the rules it must follow when producing an answer.</div>
                        ${this._textareaField('Assistant role', p.persona, value => this._promptField('persona', value), 'role', 'Example: Act as a live interview assistant and write the exact words the candidate can say aloud.')}
                        ${this._textareaField('Answer instructions', p.answerRules, value => this._promptField('answerRules', value), 'rules', 'Example: explain relevant mechanisms, give a practical example, mention pitfalls, and never invent personal experience.')}
                        ${this._inputField('Response style', p.responseStyle, value => this._promptField('responseStyle', value), 'Example: Natural, direct, senior-level speech with short paragraphs.')}
                    </div>

                    <div class="section">
                        <div class="section-title">Response preferences</div>
                        <div class="section-description">These presets are the only source of length and formatting instructions, which prevents conflicting prompts.</div>
                        <div class="preference-grid">
                            ${this._presetField('Length', p.length, LENGTHS, value => this._promptField('length', value))}
                            ${this._presetField('Format', p.format, FORMATS, value => this._promptField('format', value))}
                        </div>
                    </div>

                    <details class="preview-panel">
                        <summary>What will be sent to the AI · ${this._size(this._preview)}</summary>
                        <div class="preview-content">
                            <div class="preview-heading"><div class="form-help">Read-only result generated from the fields above. This exact prompt is used at session start.</div><button class="control" @click=${this._copyPreview}>${this._copied ? 'Copied' : 'Copy'}</button></div>
                            <textarea class="control preview" readonly .value=${this._preview}></textarea>
                        </div>
                    </details>
                </section>
            </div></div>`;
    }

    _inputField(label, value, save, placeholder) {
        return html`<div class="form-group"><label class="form-label">${label}</label><input class="control" .value=${value || ''} placeholder=${placeholder} @change=${e => save(e.target.value)} /></div>`;
    }

    _textareaField(label, value, save, className, help) {
        return html`<div class="form-group"><label class="form-label">${label}</label><textarea class="control ${className}" .value=${value || ''} placeholder=${help} @change=${e => save(e.target.value)}></textarea><div class="field-meta"><span>${help}</span><span>${this._size(value)}</span></div></div>`;
    }

    _presetField(label, value, options, save) {
        return html`<div class="form-group"><label class="form-label">${label}</label><select class="control" .value=${value} @change=${e => save(e.target.value)}>${Object.entries(options).map(([id, [name]]) => html`<option value=${id}>${name}</option>`)}</select><div class="preference-help">${options[value]?.[1] || ''}</div></div>`;
    }
}

customElements.define('ai-customize-view', AICustomizeView);
