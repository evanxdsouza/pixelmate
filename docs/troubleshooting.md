# Troubleshooting

---

## Extension Issues

### "Extension not found" banner in the PWA

**Cause**: The PWA origin is not whitelisted in `externally_connectable`, or the extension is not loaded.

**Fix**:
1. Confirm the extension is loaded: `chrome://extensions` → PixelMate → should show **Enabled**
2. Check that your origin (`localhost:5173` or your hosted domain) is in `manifest.json` under `externally_connectable.matches`
3. Rebuild and reload: `pnpm --filter @pixelmate/extension run build`, then click **↺ refresh** in `chrome://extensions`

---

### Extension popup is blank

**Cause**: JavaScript error in the popup bundle.

**Fix**:
1. Right-click the popup → **Inspect**
2. Check the Console for errors
3. If it says `chrome.runtime.connect is not a function`: confirm you're browsing with the extension loaded in Chrome (not Firefox or another browser)

---

### Service worker crashes silently

**Cause**: An unhandled exception in `background.ts`.

**Fix**:
1. `chrome://extensions` → PixelMate → click **Service Worker**
2. Read the console; look for `Uncaught` errors
3. Re-run `pnpm --filter @pixelmate/extension run build` to get fresh source maps

---

### Tools list is empty

**Cause**: The service worker hasn't finished initializing the `ToolRegistry`, or the extension is sleeping.

**Fix**: Send any message to the extension (e.g. open the popup) to wake the service worker. Wait 2–3 seconds and click **↺ Refresh** in the Tools view.

---

## API Key Issues

### "API key not found for provider: anthropic"

**Cause**: No API key has been saved for the selected provider.

**Fix**: Go to **Settings → AI Provider → API Key**, enter your key, and click **Save Key**.

---

### "401 Unauthorized" from the LLM provider

**Cause**: The saved API key is invalid or has been revoked.

**Fix**: Generate a new key from the provider's dashboard and re-save it.

---

### Model list shows "No models available"

**Cause**: The live `listModels()` call failed (usually because no key is saved yet) and the static fallback list is empty.

**Fix**: Save a valid API key first — the model list will populate automatically. If the list is still empty, check the service worker console for errors.

---

## Google Workspace Issues

### Google sign-in fails with "User cancelled"

**Cause**: You dismissed the OAuth popup, or the extension does not have the `identity` permission.

**Fix**:
1. Confirm `"identity"` is in the `permissions` array in `manifest.json`
2. Rebuild and reload the extension
3. Try signing in again — the `chrome.identity.getAuthToken({ interactive: true })` popup must be allowed

### Google Drive files don't appear

**Cause**: The access token hasn't been wired into `HybridFileSystem`.

**Fix**: After clicking **Connect Google**, switch to the Files view and click **↺ Refresh**.

---

## Build Issues

### `tsc` errors mentioning test files

**Cause**: `tsconfig.json` includes test files in the production build.

**Fix**: The tsconfigs exclude `*.test.ts` files. If they've been accidentally changed, ensure:

```json
// packages/extension-v2/tsconfig.json
"exclude": ["src/**/*.test.ts", "vitest.config.ts"]
```

---

### `pnpm run build` fails with "Cannot find module '@pixelmate/shared'"

**Cause**: Workspace packages haven't been built yet.

**Fix**:

```bash
pnpm --filter @pixelmate/shared run build
pnpm --filter @pixelmate/core run build
pnpm --filter @pixelmate/extension run build
```

Or build everything in dependency order:

```bash
pnpm -r run build
```

---

## Test Issues

### Tests fail with "scrollIntoView is not a function"

**Cause**: jsdom doesn't implement `scrollIntoView`.

**Fix**: Already handled in `packages/frontend/src/test-setup.ts`:

```ts
window.HTMLElement.prototype.scrollIntoView = vi.fn();
```

If you see this error, confirm `test-setup.ts` is listed in `vitest.config.ts` under `setupFiles`.

---

### "Chrome extension not available" during agent execution

**Cause**: `bridge.isAvailable()` returned `false` because `chrome.runtime` is not accessible from the current page.

**Fix**: Use the extension popup directly, or ensure the PWA origin is in `externally_connectable` and the extension is active.

---

## Still Stuck?

Open an issue at https://github.com/pixelmate/pixelmate/issues and include:

- Chrome version (`chrome://version`)
- Extension version (shown in `chrome://extensions`)
- The error from the service worker console
- Steps to reproduce
