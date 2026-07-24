const test = require('node:test');
const assert = require('node:assert/strict');
const { compileProfile, createBuiltInProfiles } = require('../src/utils/aiProfiles');
const { profilePrompts } = require('../src/utils/prompts');

const oldSizes = {
    interview: 3207,
    sales: 2398,
    meeting: 2257,
    presentation: 2463,
    negotiation: 2504,
    exam: 2544,
};

test('built-in prompts contain one clear format policy and no fabricated examples', () => {
    for (const profile of createBuiltInProfiles(profilePrompts)) {
        const compiled = compileProfile(profile, { language: 'en-US' });
        assert.equal((compiled.match(/^LENGTH$/gm) || []).length, 1, profile.id);
        assert.equal((compiled.match(/^FORMAT$/gm) || []).length, 1, profile.id);
        assert.doesNotMatch(compiled, /\*\*|500 businesses|\$200K|Sarah|Mike|99\.9%|25% market share/, profile.id);
        assert.ok(compiled.startsWith('APPLICATION SAFETY BOUNDARY'), profile.id);
    }
});

test('legacy prompt fields no longer ask for unavailable search or decorative Markdown', () => {
    for (const [id, prompt] of Object.entries(profilePrompts)) {
        const raw = Object.values(prompt).join('\n');
        assert.doesNotMatch(raw, /Google search|\*\*|markdown format/i, id);
    }
});

test('prompt reduction removes duplicated instructions while preserving role rules', () => {
    const profiles = Object.fromEntries(createBuiltInProfiles(profilePrompts).map(profile => [profile.id, profile]));
    for (const [id, oldSize] of Object.entries(oldSizes)) {
        const size = compileProfile(profiles[id], { language: 'en-US' }).length;
        assert.ok(size <= oldSize * 0.8, `${id} was not reduced by at least 20%`);
    }

    assert.match(profiles.interview.prompt.answerRules, /follow-ups/i);
    assert.match(profiles.sales.prompt.answerRules, /Never invent ROI/i);
    assert.match(profiles.meeting.prompt.answerRules, /unknown/i);
    assert.match(profiles.presentation.prompt.answerRules, /Never invent growth/i);
    assert.match(profiles.negotiation.prompt.answerRules, /conditional and reciprocal/i);
    assert.match(profiles.exam.prompt.answerRules, /Do not repeat the full question/i);
});
