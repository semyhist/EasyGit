/**
 * EasyGit — Multi-Provider AI Wrapper
 * Supports: OpenAI, Groq, Anthropic, Google Gemini, OpenRouter
 */

const AI = (() => {

  // ── Friendly error formatter ──
  function friendlyError(rawMessage, providerName) {
    const msg = (rawMessage || '').toLowerCase();
    const isQuota   = msg.includes('quota') || msg.includes('rate limit') || msg.includes('rate_limit') ||
                      msg.includes('429') || msg.includes('too many requests') ||
                      msg.includes('free_tier') || msg.includes('billing');
    const isAuth    = msg.includes('invalid') && (msg.includes('key') || msg.includes('api')) ||
                      msg.includes('unauthorized') || msg.includes('403') || msg.includes('401');
    const isTimeout = msg.includes('timeout') || msg.includes('timed out');

    if (isQuota) {
      return `${providerName || 'AI'} quota exceeded. Open Settings → switch to a different provider (e.g. Groq — free & fast) or upgrade your plan.`;
    }
    if (isAuth) {
      return `${providerName || 'AI'} API key is invalid or expired. Open Settings → re-enter your key.`;
    }
    if (isTimeout) {
      return `${providerName || 'AI'} request timed out. Try again or switch to a faster model in Settings.`;
    }
    return rawMessage; // fallback: original message
  }

  // ── Provider Configurations ──
  const PROVIDERS = {
    openai: {
      name: 'OpenAI',
      icon: '🤖',
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4o-mini',
      keyHint: 'sk-...',
      keyUrl: 'https://platform.openai.com/api-keys',
      keyGuide: 'platform.openai.com/api-keys adresinde hesap oluşturun',
    },
    groq: {
      name: 'Groq',
      icon: '⚡',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      models: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile',
        'gemma2-9b-it',
      ],
      defaultModel: 'llama-3.3-70b-versatile',
      keyHint: 'gsk_...',
      keyUrl: 'https://console.groq.com/keys',
      keyGuide: 'console.groq.com/keys — ücretsiz ve hızlı',
    },
    anthropic: {
      name: 'Anthropic',
      icon: '🧠',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'],
      defaultModel: 'claude-3-5-haiku-20241022',
      keyHint: 'sk-ant-...',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyGuide: 'console.anthropic.com — Claude API anahtarı',
      customHandler: true,
    },
    gemini: {
      name: 'Google Gemini',
      icon: '✨',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      defaultModel: 'gemini-2.0-flash',
      keyHint: 'AIza...',
      keyUrl: 'https://aistudio.google.com/apikey',
      keyGuide: 'aistudio.google.com — ücretsiz API anahtarı',
      customHandler: true,
    },
    openrouter: {
      name: 'OpenRouter',
      icon: '🌐',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      models: [
        'openrouter/auto',
        'meta-llama/llama-3.3-70b-instruct:free',
        'openai/gpt-oss-120b:free',
        'openai/gpt-oss-20b:free',
        'nvidia/nemotron-3-super:free',
        'google/gemma-4-31b-it:free',
        'google/gemma-4-26b-a4b-it:free',
        'qwen/qwen3-coder-480b-a35b-instruct:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
        'arcee-ai/trinity-large-preview:free',
        'minimax/minimax-m2.5:free',
        'nvidia/nemotron-nano-9b-v2:free',
      ],
      defaultModel: 'openrouter/auto',
      keyHint: 'sk-or-...',
      keyUrl: 'https://openrouter.ai/settings/keys',
      keyGuide: 'openrouter.ai — birden fazla model, ücretsiz katman var',
    },
  };

  function getProvider(id) {
    return PROVIDERS[id] || PROVIDERS['openai'];
  }

  function getAllProviders() {
    return Object.entries(PROVIDERS).map(([id, p]) => ({ id, ...p }));
  }

  // ── OpenAI-compatible request (OpenAI, Groq, OpenRouter) ──
  async function requestOpenAICompat(config, messages, systemPrompt) {
    const { baseUrl, model, key } = config;

    // OpenRouter free models cap at 2048 tokens
    const isOpenRouterFree = config.provider === 'openrouter' && model.endsWith(':free');
    const maxTok = config.maxTokens || (isOpenRouterFree ? 2048 : 4096);

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: maxTok,
    };

    let res;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      res = await fetch(baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(config.provider === 'openrouter' ? {
            'HTTP-Referer': 'https://easygit.app',
            'X-Title': 'EasyGit',
          } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') throw new Error(`${config.name || config.provider} — Request timed out (30s). Try a smaller model or check your connection.`);
      throw new Error(`${config.name || config.provider} — Network error: ${networkErr.message}. If you are using Electron, check that the API URL is not blocked.`);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw = err?.error?.message || err?.message || `HTTP ${res.status}`;
      throw new Error(friendlyError(raw, config.name || config.provider));
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${config.name || config.provider} returned an empty response.`);
    return text.trim();
  }

  // ── Anthropic request ──
  async function requestAnthropic(config, messages, systemPrompt) {
    const { model, key } = config;

    let res;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: config.maxTokens || 4096,
          system: systemPrompt,
          messages,
        }),
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') throw new Error('Anthropic — Request timed out (30s).');
      throw new Error(`Anthropic — Network error: ${networkErr.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Anthropic error shape: { error: { type, message } }
      const raw = err?.error?.message || `Anthropic HTTP ${res.status}`;
      throw new Error(friendlyError(raw, 'Anthropic'));
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error('Anthropic returned an empty response.');
    return text.trim();
  }

  // ── Google Gemini request ──
  async function requestGemini(config, messages, systemPrompt) {
    const { baseUrl, model, key } = config;
    const url = baseUrl.replace('{model}', model) + `?key=${key}`;

    const parts = [{ text: systemPrompt + '\n\n' + (messages[0]?.content || '') }];

    let res;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            maxOutputTokens: config.maxTokens || 4096,
            temperature: 0.7,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') throw new Error('Google Gemini — Request timed out (30s).');
      throw new Error(`Google Gemini — Network error: ${networkErr.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw = err?.error?.message || err?.error?.status || `Gemini HTTP ${res.status}`;
      throw new Error(friendlyError(raw, 'Google Gemini'));
    }

    const data = await res.json();

    // Gemini may block content and return empty candidates
    const candidate = data?.candidates?.[0];
    if (!candidate) {
      const reason = data?.promptFeedback?.blockReason || 'unknown';
      throw new Error(`Google Gemini blocked the response (reason: ${reason}). Try a different prompt or model.`);
    }
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Google Gemini blocked the response due to safety filters. Try rephrasing.');
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Google Gemini returned an empty response.');
    return text.trim();
  }

  // ── Main request dispatcher ──
  async function complete(prompt, systemPrompt = 'You are a helpful GitHub profile assistant.', opts = {}) {
    const provider = Store.getAIProvider();
    const key      = Store.getProviderKey(provider) || Store.getAIKey();
    const model    = Store.getAIModel() || getProvider(provider).defaultModel;
    const pConfig  = getProvider(provider);

    if (!key) throw new Error(`No API key configured for ${pConfig.name}. Open Settings and add your key.`);

    const config = { ...pConfig, model, key, provider, maxTokens: opts.maxTokens };
    const messages = [{ role: 'user', content: prompt }];

    switch (provider) {
      case 'anthropic':
        return requestAnthropic(config, messages, systemPrompt);
      case 'gemini':
        return requestGemini(config, messages, systemPrompt);
      default:
        return requestOpenAICompat(config, messages, systemPrompt);
    }
  }

  // ── Validate API key ──
  async function validateKey() {
    try {
      const result = await complete('Say "OK" and nothing else.', 'You are a test.');
      return { valid: !!result, result };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  return {
    PROVIDERS,
    getProvider,
    getAllProviders,
    complete,
    validateKey,
  };
})();

window.AI = AI;
