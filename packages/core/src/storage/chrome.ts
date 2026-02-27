/**
 * Chrome storage wrapper for API keys and preferences
 */

export async function getChromeStorage(keys: string[]): Promise<Record<string, unknown>> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Fallback for non-Chrome environment
    const values: Record<string, unknown> = {};
    for (const key of keys) {
      const stored = localStorage.getItem(`pixelmate:${key}`);
      values[key] = stored ? JSON.parse(stored) : undefined;
    }
    return values;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (items) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(items);
      }
    });
  });
}

export async function setChromeStorage(items: Record<string, unknown>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Fallback for non-Chrome environment
    for (const [key, value] of Object.entries(items)) {
      localStorage.setItem(`pixelmate:${key}`, JSON.stringify(value));
    }
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function removeChromeStorage(keys: string[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Fallback for non-Chrome environment
    for (const key of keys) {
      localStorage.removeItem(`pixelmate:${key}`);
    }
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function getApiKey(provider: string): Promise<string | undefined> {
  const result = await getChromeStorage([`api_key:${provider}`]);
  return result[`api_key:${provider}`] as string | undefined;
}

export async function setApiKey(provider: string, apiKey: string): Promise<void> {
  await setChromeStorage({ [`api_key:${provider}`]: apiKey });
}
