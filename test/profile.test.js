const assert = require('assert');
const fs = require('fs');
const { SENIOR_JAVA_PROFILE, compileProfile, createBuiltInProfiles, importProfile, normalizeProfile } = require('../src/utils/aiProfiles');
const { profilePrompts } = require('../src/utils/prompts');

const minimal = normalizeProfile({ name: ' Minimal ', prompt: {} }, { strict: true, id: 'user:test' });
assert.strictEqual(minimal.name, 'Minimal');
assert.strictEqual(minimal.prompt.length, 'auto');
assert.strictEqual(minimal.prompt.format, 'plain');
assert.strictEqual(minimal.schemaVersion, 2);
assert.throws(() => normalizeProfile(null, { strict: true }), /object/);
assert.throws(() => normalizeProfile({ name: 'Bad', prompt: { length: 'huge' } }, { strict: true }), /length/);
assert.throws(() => importProfile('{bad json'), /JSON/);

const imported = importProfile({
    id: 'foreign-id',
    name: 'Legacy Java',
    config: {
        prompt: {
            systemPrompt: 'candidate facts',
            intro: 'persona',
            contextInstruction: 'rules',
            searchFocus: 'search',
            length: 'detailed',
            format: 'teleprompter',
            formatInstruction: 'Use **BOLD** everywhere',
        },
        models: { textMessage: { primaryModel: 'must-not-appear' } },
    },
});
assert.strictEqual(imported.prompt.userContext, 'candidate facts');
assert.strictEqual(imported.prompt.persona, 'persona');
assert.strictEqual(imported.prompt.answerRules, 'rules');
assert.strictEqual(imported.prompt.searchPolicy, undefined);
assert.strictEqual(imported.prompt.formatInstruction, undefined);
assert.strictEqual(imported.coveragePacks, undefined);
assert.strictEqual(imported.models, undefined);

const promptA = compileProfile(imported, true);
const promptB = compileProfile(imported, true);
assert.strictEqual(promptA, promptB);
const markers = ['APPLICATION SAFETY BOUNDARY', 'ROLE AND PERSONA', 'USER CONTEXT', 'ANSWER RULES', 'RESPONSE STYLE', 'LANGUAGE', 'LENGTH', 'FORMAT'];
for (let i = 1; i < markers.length; i++) assert.ok(promptA.indexOf(markers[i - 1]) < promptA.indexOf(markers[i]));
const autoPrompt = compileProfile(minimal);
assert.ok(autoPrompt.includes('10-18'));
assert.ok(autoPrompt.includes('15-30'));
assert.ok(!promptA.includes('must-not-appear'));
assert.ok(!promptA.includes('**BOLD**'));
assert.ok(!promptA.includes('SEARCH POLICY'));
assert.ok(!promptA.includes('RELEVANT COVERAGE'));
assert.strictEqual((promptA.match(/^LENGTH$/gm) || []).length, 1);
assert.strictEqual((promptA.match(/^FORMAT$/gm) || []).length, 1);
assert.ok(promptA.includes('Always reply in English'));
const russianPrompt = compileProfile(imported, { language: 'ru-RU' });
assert.ok(russianPrompt.includes('Always reply in Russian'));
assert.ok(russianPrompt.includes('Do not infer or change the response language'));

const builtIns = createBuiltInProfiles(profilePrompts);
const originalName = builtIns[0].name;
builtIns[0].name = 'Mutated local clone';
assert.strictEqual(createBuiltInProfiles(profilePrompts)[0].name, originalName);
assert.strictEqual(SENIOR_JAVA_PROFILE.coveragePacks, undefined);
assert.ok(SENIOR_JAVA_PROFILE.prompt.answerRules.includes('Spring'));

const portable = JSON.stringify({ schemaVersion: 2, type: 'cheating-helper-profile', profile: { name: 'Round trip', prompt: minimal.prompt } });
assert.strictEqual(importProfile(portable).name, 'Round trip');

const epamProfilePath = require.resolve('../profiles/epam-hr-call.json');
const epamProfile = importProfile(fs.readFileSync(epamProfilePath, 'utf8'));
const epamPrompt = compileProfile(epamProfile, { language: 'en-US' });
assert.strictEqual(epamProfile.name, 'EPAM HR Call');
assert.strictEqual(epamProfile.prompt.length, 'concise');
assert.strictEqual(epamProfile.prompt.format, 'teleprompter');
assert.ok(epamPrompt.includes('around PLN 16,000 per month'));
assert.ok(epamPrompt.includes('renewal application is being processed'));
assert.ok(epamPrompt.includes('Always reply in English'));
assert.ok(epamPrompt.includes("Greetings, thanks and 'How are you?' get 1-2 natural sentences"));
assert.ok(epamPrompt.includes("Keep 'Why are you changing jobs?' separate from 'Why EPAM?'"));
assert.ok(epamPrompt.includes('Rephrased questions must preserve the same facts and core position'));
assert.ok(epamPrompt.includes('Never add unrelated background just to reach a sentence count'));
assert.ok(epamPrompt.includes('JOB CHANGE:'));
assert.ok(epamPrompt.includes('WHY EPAM:'));
assert.ok(epamPrompt.includes('give a 60-90 second recruiter introduction in this order'));
assert.ok(epamPrompt.includes('two proof points only'));
assert.ok(epamPrompt.includes('Do not include every project'));
assert.ok(epamPrompt.includes('Do not mention Chrome extensions or the AudienceRate assignment'));
assert.ok(epamPrompt.includes('CV SCOPE:'));
assert.ok(epamPrompt.includes('This is a CV selection decision, not a period without work'));
assert.ok(epamPrompt.includes('omitted Jaspersoft, BPMN configuration and other non-Java-primary responsibilities'));
assert.ok(epamPrompt.includes('Never imply unemployment, inactivity or an attempt to hide work'));

const uiSource = fs.readFileSync(require.resolve('../src/components/views/AICustomizeView'), 'utf8');
for (const removed of ['Expertise / Coverage', 'Length Override', 'Format Override', 'Search Policy', '>Advanced<'])
    assert.ok(!uiSource.includes(removed));
for (const visible of ['About you / Facts the assistant may use', 'Assistant role', 'Answer instructions', 'What will be sent to the AI'])
    assert.ok(uiSource.includes(visible));
assert.ok(uiSource.includes('flex-direction: column'));
assert.ok(uiSource.includes('Profile for next session'));
assert.ok(uiSource.includes('Changes apply after a new Start'));

const historySource = fs.readFileSync(require.resolve('../src/components/views/HistoryView'), 'utf8');
assert.ok(historySource.includes('if (session.profileName) return session.profileName'));
assert.ok(historySource.includes("profile_senior_java_interview: 'Senior Java Interview'"));

console.log('AI profile schema, import and compiler: OK');
