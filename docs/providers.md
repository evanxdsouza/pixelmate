# LLM Providers

PixelMate supports three LLM providers. Each implements the `LLMProvider` interface from `@pixelmate/shared` and runs inside the extension service worker — your API keys never leave the browser.

---

## Supported Providers

### Anthropic (Claude)

| Setting | Value |
|---------|-------|
| Provider ID | `anthropic` |
| Default model | `claude-sonnet-4` |
| Key format | `sk-ant-…` |
| Get a key | https://console.anthropic.com |

**Available models** (static list, no API key required to view):

| Model | Context | Best for |
|-------|---------|----------|
| `claude-opus-4-1` | 200k | Complex reasoning, long documents |
| `claude-sonnet-4` | 200k | Balanced speed and quality (default) |
| `claude-haiku-3` | 200k | Fast, lightweight tasks |
| `claude-3.5-sonnet` | 200k | Previous-gen sonnet |
| `claude-3-haiku` | 200k | Previous-gen haiku |

---

### OpenAI (GPT)

| Setting | Value |
|---------|-------|
| Provider ID | `openai` |
| Default model | `gpt-4o` |
| Key format | `sk-…` |
| Get a key | https://platform.openai.com/api-keys |

**Available models** (fetched live from `client.models.list()`, filtered to GPT models):

| Model | Best for |
|-------|---------|
| `gpt-4o` | Latest multimodal flagship (default) |
| `gpt-4o-mini` | Fast, cost-effective |
| `gpt-4-turbo` | Previous-gen turbo |
| `gpt-4` | Base GPT-4 |
| `gpt-3.5-turbo` | Very fast, lower cost |

---

### Groq (Llama / Mixtral)

| Setting | Value |
|---------|-------|
| Provider ID | `groq` |
| Default model | `llama-3.3-70b-versatile` |
| Key format | `gsk_…` |
| Get a key | https://console.groq.com |

**Available models** (fetched live from Groq's OpenAI-compatible endpoint):

| Model | Best for |
|-------|---------|
| `llama-3.3-70b-versatile` | Best open-source quality (default) |
| `llama-3.1-70b-versatile` | Stable Llama 3.1 70B |
| `llama-3.1-8b-instant` | Ultra-fast responses |
| `mixtral-8x7b-32768` | Long context MoE |
| `gemma2-9b-it` | Compact, efficient |

---

## Model Selection

Models are loaded from the backend via the `GET_MODELS` message when the Settings view is opened, or when the provider is changed. If no API key is set yet, or if the live API call fails, the static list above is used as fallback.

The selected model is persisted to `chrome.storage.sync` under `selected_model` and restored on next launch.

---

## Switching Provider and Model at Runtime

In the Settings view:

1. Open **Settings → AI Provider**
2. Choose a **Provider** from the dropdown
3. The **Model** dropdown auto-refreshes with that provider's models
4. Select the model you want — it is saved immediately

The selection takes effect for the next message you send.

---

## Adding a Provider

Implement `LLMProvider` from `@pixelmate/shared`:

```ts
import { LLMProvider, ChatOptions, ChatResponse, StreamingChunk } from '@pixelmate/shared';

export class MyProvider implements LLMProvider {
  name = 'myprovider';

  constructor(private apiKey: string) {}

  async chat(options: ChatOptions): Promise<ChatResponse> {
    // Call your API …
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<StreamingChunk> {
    // Stream deltas …
  }

  async listModels(): Promise<string[]> {
    return ['my-model-v1', 'my-model-v2'];
  }
}
```

Then register it in `packages/extension-v2/src/background.ts`:

```ts
import { MyProvider } from '@pixelmate/core';

// inside getProvider():
case 'myprovider':
  return new MyProvider(apiKey);
```

And add it to the static fallbacks:

```ts
const STATIC_MODELS: Record<string, string[]> = {
  // …
  myprovider: ['my-model-v1', 'my-model-v2'],
};
```

Finally, add the option to the provider `<select>` in `packages/frontend/src/App.tsx`.
