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
      models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'],
      defaultModel: 'llama3-70b-8192',
      keyHint: 'gsk_...',
      keyUrl: 'https://console.groq.com/keys',
      keyGuide: 'console.groq.com/keys — ücretsiz ve hızlı',
    },
    anthropic: {
      name: 'Anthropic',
      icon: '🧠',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      models: ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20240620'],
      defaultModel: 'claude-3-haiku-20240307',
      keyHint: 'sk-ant-...',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyGuide: 'console.anthropic.com — Claude API anahtarı',
      customHandler: true,
    },
    gemini: {
      name: 'Google Gemini',
      icon: '✨',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
      defaultModel: 'gemini-1.5-flash',
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
        'meta-llama/llama-3-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'google/gemma-7b-it:free',
        'microsoft/phi-3-mini-128k-instruct:free',
        'qwen/qwen-2-7b-instruct:free',
        'openchat/openchat-7b:free',
      ],
      defaultModel: 'meta-llama/llama-3-8b-instruct:free',
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

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: config.maxTokens || 4096,
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
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

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw = err?.error?.message || `AI error ${res.status}`;
      throw new Error(friendlyError(raw, config.provider));
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  // ── Anthropic request ──
  async function requestAnthropic(config, messages, systemPrompt) {
    const { model, key } = config;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
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

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw = err?.error?.message || `Anthropic error ${res.status}`;
      throw new Error(friendlyError(raw, 'Anthropic'));
    }

    const data = await res.json();
    return data.content[0].text.trim();
  }

  // ── Google Gemini request ──
  async function requestGemini(config, messages, systemPrompt) {
    const { baseUrl, model, key } = config;
    const url = baseUrl.replace('{model}', model) + `?key=${key}`;

    // Combine system + user messages for Gemini
    const parts = [
      { text: systemPrompt + '\n\n' + (messages[0]?.content || '') }
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: config.maxTokens || 4096,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Gemini embeds the message in error.message or error.status
      const raw = err?.error?.message || err?.error?.status || `Gemini error ${res.status}`;
      throw new Error(friendlyError(raw, 'Google Gemini'));
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text.trim();
  }

  // ── Main request dispatcher ──
  async function complete(prompt, systemPrompt = 'You are a helpful GitHub profile assistant.', opts = {}) {
    const provider = Store.getAIProvider();
    const key      = Store.getAIKey();
    const model    = Store.getAIModel() || getProvider(provider).defaultModel;
    const pConfig  = getProvider(provider);

    if (!key) throw new Error('AI API key not configured.');

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
