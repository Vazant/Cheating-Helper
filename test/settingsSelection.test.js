const assert = require('node:assert/strict');
const fs = require('node:fs');

const customizeSource = fs.readFileSync(require.resolve('../src/components/views/CustomizeView'), 'utf8');
const profileSource = fs.readFileSync(require.resolve('../src/components/views/AICustomizeView'), 'utf8');

assert.ok(customizeSource.includes('?selected=${this.selectedLanguage === language.value}'));
assert.ok(customizeSource.includes('id="speech-language"'));
assert.ok(!customizeSource.includes('.value=${this.selectedLanguage}'));

assert.ok(profileSource.includes('?selected=${this._draft.id === x.id}'));
assert.ok(profileSource.includes('id="session-profile"'));
assert.ok(!profileSource.includes('.value=${this._draft.id}'));

console.log('Saved language and profile selection rendering: OK');
