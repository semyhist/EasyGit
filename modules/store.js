/**
 * EasyGit — Local Storage Manager
 * Handles persisting GitHub token, AI settings, and app preferences.
 */

const Store = (() => {
  const PREFIX = 'easygit_';

  function key(k) { return PREFIX + k; }

  function get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(key(k));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function set(k, value) {
    try {
      localStorage.setItem(key(k), JSON.stringify(value));
    } catch (e) {
      console.error('[Store] set error:', e);
    }
  }

  function remove(k) {
    localStorage.removeItem(key(k));
  }

  function clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  // ── Typed helpers ──

  function getGitHubToken() { return get('github_token', ''); }
  function setGitHubToken(t) { set('github_token', t); }

  function getAIProvider() { return get('ai_provider', 'openai'); }
  function setAIProvider(p) { set('ai_provider', p); }

  function getAIKey() { return get('ai_key', ''); }
  function setAIKey(k) { set('ai_key', k); }

  function getAIModel() { return get('ai_model', ''); }
  function setAIModel(m) { set('ai_model', m); }

  function getAITone() { return get('ai_tone', 'default'); }
  function setAITone(t) { set('ai_tone', t); }

  function getCustomInstructions() { return get('custom_instructions', ''); }
  function setCustomInstructions(v) { set('custom_instructions', v); }

  function isSetupComplete() {
    return !!(getGitHubToken() && getAIKey() && getAIProvider());
  }

  function saveAll({ githubToken, aiProvider, aiKey, aiModel, aiTone, customInstructions }) {
    if (githubToken !== undefined) setGitHubToken(githubToken);
    if (aiProvider  !== undefined) setAIProvider(aiProvider);
    if (aiKey       !== undefined) setAIKey(aiKey);
    if (aiModel     !== undefined) setAIModel(aiModel);
    if (aiTone      !== undefined) setAITone(aiTone);
    if (customInstructions !== undefined) setCustomInstructions(customInstructions);
  }


  // Cache for fetched repos (session only)
  const sessionCache = new Map();

  function cacheSet(k, v) { sessionCache.set(k, v); }
  function cacheGet(k)    { return sessionCache.get(k) ?? null; }
  function cacheClear()   { sessionCache.clear(); }

  return {
    get, set, remove, clear,
    getGitHubToken, setGitHubToken,
    getAIProvider,  setAIProvider,
    getAIKey,       setAIKey,
    getAIModel,     setAIModel,
    getAITone,      setAITone,
    getCustomInstructions, setCustomInstructions,
    isSetupComplete, saveAll,
    cacheSet, cacheGet, cacheClear,
  };
})();

window.Store = Store;
