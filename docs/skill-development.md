# Skill Development

Skills are system prompt presets that configure the agent for a specific type of task. They are defined in `packages/core/src/skills/index.ts` and selected per-session.

---

## Built-in Skills

| Skill ID | Speciality |
|----------|-----------|
| `document` | Writing and editing documents |
| `email` | Drafting and managing email |
| `presentation` | Creating slide decks |
| `spreadsheet` | Working with tabular data |
| `research` | Web research and synthesis |
| `code` | Writing and debugging code |

When no skill is selected the agent uses the default prompt: `"You are a helpful AI assistant."`

---

## How Skills Work

The `getSkillPrompt(skill: string): string` function is called in the extension's `executeAgentWithStream()` before creating the agent:

```ts
// packages/extension-v2/src/background.ts
const systemPrompt = skill ? getSkillPrompt(skill) : undefined;
const agent = new Agent(llmProvider, toolRegistry, { model, systemPrompt });
```

The prompt string is passed as the agent's `systemPrompt` option, which the provider includes as the system message for every LLM call.

---

## Adding a New Skill

### 1. Add the prompt constant

In `packages/core/src/skills/index.ts`, add:

```ts
export const SKILL_TRANSLATION = `
# Translation Assistant

You are an expert translator. Your capabilities include:
- Translating text between any two languages
- Preserving tone, style, and formatting
- Detecting the source language automatically
- Providing alternative translations when appropriate

Always indicate the source and target language, and flag any phrases
that are culturally nuanced or have no direct equivalent.
`;
```

### 2. Register it in the SKILLS map

```ts
export const SKILLS: Record<string, string> = {
  document:     SKILL_DOCUMENT,
  email:        SKILL_EMAIL,
  presentation: SKILL_PRESENTATION,
  spreadsheet:  SKILL_SPREADSHEET,
  research:     SKILL_RESEARCH,
  code:         SKILL_CODE,
  translation:  SKILL_TRANSLATION,   // ← add this line
};
```

`getSkillPrompt()` and `listSkills()` pick it up automatically — no further changes needed.

### 3. Expose it in the UI (optional)

The frontend currently does not have a skill picker. If you add one, pass the skill ID via `bridge.executeAgent()`:

```ts
bridge.executeAgent(prompt, { provider, model, skill: 'translation' }, onEvent, onComplete, onError);
```

---

## API

### `getSkillPrompt(skill: string): string`

Returns the system prompt for the given skill ID (case-insensitive). Falls back to `"You are a helpful AI assistant."` for unknown IDs.

```ts
import { getSkillPrompt } from '@pixelmate/core';

const prompt = getSkillPrompt('code');     // → full coding system prompt
const fallback = getSkillPrompt('magic');  // → "You are a helpful AI assistant."
```

### `listSkills(): string[]`

Returns the lowercase IDs of all registered skills.

```ts
import { listSkills } from '@pixelmate/core';
listSkills(); // ['document', 'email', 'presentation', 'spreadsheet', 'research', 'code']
```

### `SKILLS`

The raw `Record<string, string>` map — useful for iterating all skills and their prompts.

---

## Writing Tests

```ts
import { describe, it, expect } from 'vitest';
import { getSkillPrompt, listSkills } from '@pixelmate/core';

describe('translation skill', () => {
  it('is listed', () => {
    expect(listSkills()).toContain('translation');
  });

  it('returns a non-empty prompt', () => {
    const prompt = getSkillPrompt('translation');
    expect(prompt.length).toBeGreaterThan(20);
  });

  it('is case-insensitive', () => {
    expect(getSkillPrompt('TRANSLATION')).toBe(getSkillPrompt('translation'));
  });
});
```
