/**
 * EasyGit — Main Application
 * Orchestrates onboarding, dashboard, repo panel, AI actions, and bulk operations.
 */

const App = (() => {

  // ══════════════════════════════════════
  //  STATE
  // ══════════════════════════════════════
  const state = {
    user: null,
    repos: [],
    filteredRepos: [],
    selectedRepos: new Set(),
    activeRepo: null,
    filter: 'all',
    langFilter: null,
    searchQuery: '',
    sortBy: 'updated',
    viewMode: 'grid',       // 'grid' | 'list'
    aiHistory: new Map(),  // repoId -> [{type, result, time}]
    // Onboarding
    obStep: 0,
    selectedProvider: null,
    // Modal state
    modalAction: null,
    modalRepo: null,
    modalResult: null,
  };

  // ══════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════
  function init() {
    UI.initToasts();
    renderProviderGrid();
    bindFilterEvents();
    initKeyboardShortcuts();
    initContextMenu();
    initRepoGridDelegation();

    // Debounced search binding
    const searchEl = document.getElementById('repo-search');
    if (searchEl) {
      const debouncedSearch = UI.debounce((val) => dashboard.search(val), 200);
      searchEl.addEventListener('input', (e) => debouncedSearch(e.target.value));
    }

    if (Store.isSetupComplete()) {
      showDashboard();
    } else {
      showOnboarding();
    }
  }

  function showOnboarding() {
    UI.showPage('page-onboarding');
    state.obStep = 0;
    updateObStep();
  }

  async function showDashboard() {
    UI.showPage('page-dashboard');
    await dashboard.load();
  }

  // ── AI options helper ──
  function aiOpts() {
    return {
      tone: Store.getAITone(),
      customInstructions: Store.getCustomInstructions(),
    };
  }

  // ── Append signature to readme content ──
  function withSignature(content) {
    const sig = Store.getSignature().trim();
    if (!sig) return content;
    return content.trimEnd() + '\n\n' + sig;
  }

  // ── OS Notification ──
  function sendNotification(title, body) {
    // Electron: use IPC bridge if available
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification(title, body);
      return;
    }
    // Web fallback
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'logo/logowithbg.png' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body, icon: 'logo/logowithbg.png' });
      });
    }
  }

  // ── Keyboard Shortcuts ──
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

      if (e.key === 'Escape') {
        if (document.getElementById('ai-modal').style.display !== 'none') { modal.close(); return; }
        if (document.getElementById('settings-modal').style.display !== 'none') { settings.close(); return; }
        if (document.getElementById('bulk-modal').style.display !== 'none') { return; }
        panel.close();
        closeContextMenu();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !inInput) {
        switch (e.key.toLowerCase()) {
          case 'r':
            e.preventDefault();
            dashboard.forceRefresh();
            break;
          case 'a':
            e.preventDefault();
            dashboard.toggleSelectAll();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('repo-search')?.focus();
            break;
          case 'g':
            e.preventDefault();
            dashboard.setView('grid');
            break;
          case 'l':
            e.preventDefault();
            dashboard.setView('list');
            break;
        }
      }
    });
  }

  // ── Context Menu ──
  let ctxMenu = null;

  function initContextMenu() {
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.repo-card');
      if (!card) { closeContextMenu(); return; }
      e.preventDefault();
      const repoId = parseInt(card.dataset.repoId);
      const repo = state.repos.find(r => r.id === repoId);
      if (!repo) return;
      showContextMenu(e.clientX, e.clientY, repo);
    });
  }

  function showContextMenu(x, y, repo) {
    closeContextMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'ctx-menu';

    const items = [
      { icon: '📂', label: 'Open Details', action: () => { panel.open(repo); closeContextMenu(); } },
      'separator',
      { icon: '🏷️', label: 'Add Topics', action: () => contextActions.topics(repo.id) },
      { icon: '📝', label: 'Write Description', action: () => contextActions.description(repo.id) },
      { icon: '📖', label: 'Generate README', action: () => contextActions.readme(repo.id) },
      { icon: '⚡', label: 'Do Everything', action: () => contextActions.all(repo.id) },
      'separator',
      { icon: '🌐', label: 'Open on GitHub', action: () => { window.open(repo.html_url, '_blank'); closeContextMenu(); } },
    ];

    items.forEach(item => {
      if (item === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'ctx-separator';
        ctxMenu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.className = 'ctx-item';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'ctx-item-icon';
      iconSpan.textContent = item.icon;
      el.appendChild(iconSpan);
      el.appendChild(document.createTextNode(item.label));
      el.addEventListener('click', item.action);
      ctxMenu.appendChild(el);
    });

    document.body.appendChild(ctxMenu);
    // Position
    const w = 200, h = ctxMenu.offsetHeight || 180;
    ctxMenu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    ctxMenu.style.top  = Math.min(y, window.innerHeight - h - 8) + 'px';
  }

  function closeContextMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }

  // ── Context API shortcuts ──
  const contextActions = {
    topics(repoId) {
      closeContextMenu();
      const repo = state.repos.find(r => r.id === repoId);
      if (repo) { state.activeRepo = repo; actions.addTopics(); }
    },
    description(repoId) {
      closeContextMenu();
      const repo = state.repos.find(r => r.id === repoId);
      if (repo) { state.activeRepo = repo; actions.addDescription(); }
    },
    readme(repoId) {
      closeContextMenu();
      const repo = state.repos.find(r => r.id === repoId);
      if (repo) { state.activeRepo = repo; actions.addReadme(); }
    },
    all(repoId) {
      closeContextMenu();
      const repo = state.repos.find(r => r.id === repoId);
      if (repo) { state.activeRepo = repo; actions.doEverything(); }
    },
  };

  // ══════════════════════════════════════
  //  ONBOARDING
  // ══════════════════════════════════════
  const onboarding = {
    next() {
      if (state.obStep < 2) {
        state.obStep++;
        updateObStep();
      }
    },
    prev() {
      if (state.obStep > 0) {
        state.obStep--;
        updateObStep();
      }
    },

    async verifyGitHub() {
      const token = document.getElementById('github-token-input').value.trim();
      if (!token) {
        UI.toast('Please enter your GitHub token.', 'error');
        return;
      }

      const btn = document.getElementById('btn-verify-github');
      UI.setLoading(btn, true, 'Verifying...');
      Store.setGitHubToken(token);

      const { valid, user, error } = await GitHub.validateToken();
      UI.setLoading(btn, false);

      if (valid) {
        state.user = user;
        UI.toast(`Welcome, ${user.name || user.login}! ✅`, 'success');
        onboarding.next();
      } else {
        Store.setGitHubToken('');
        UI.toast(`Invalid token: ${error}`, 'error');
      }
    },

    async finish() {
      const key = document.getElementById('ai-key-input').value.trim();
      if (!key) {
        UI.toast('Please enter your AI API key.', 'error');
        return;
      }
      if (!state.selectedProvider) {
        UI.toast('Please select an AI provider.', 'error');
        return;
      }

      const btn = document.getElementById('btn-finish-setup');
      UI.setLoading(btn, true, 'Verifying...');
      Store.setAIKey(key);

      const { valid, error } = await AI.validateKey();
      UI.setLoading(btn, false);

      if (valid) {
        UI.toast('AI key verified! 🎉 Launching EasyGit...', 'success');
        setTimeout(() => showDashboard(), 800);
      } else {
        const isQuota = error && (
          error.toLowerCase().includes('quota') ||
          error.toLowerCase().includes('rate limit') ||
          error.toLowerCase().includes('free_tier') ||
          error.toLowerCase().includes('billing') ||
          error.toLowerCase().includes('429')
        );

        if (isQuota) {
          // Key may be valid — quota is just exhausted. Don't wipe it.
          UI.toast(
            `Quota exceeded — select a different provider above (e.g. Groq ⚡ — free & fast).`,
            'error',
            6000
          );
          // Scroll provider grid into view so the user sees their options
          document.getElementById('provider-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Genuinely bad key — clear it so the user re-enters
          UI.toast(`Key error: ${error}`, 'error');
          Store.setAIKey('');
        }
      }
    },

    selectProvider(providerId) {
      state.selectedProvider = providerId;
      Store.setAIProvider(providerId);

      // Update UI
      document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('selected'));
      document.getElementById(`provider-${providerId}`).classList.add('selected');

      const prov = AI.getProvider(providerId);

      // Update model select
      const modelWrap = document.getElementById('model-selector-wrap');
      const modelSelect = document.getElementById('ai-model-select');
      modelSelect.innerHTML = prov.models.map(m =>
        `<option value="${m}" ${m === prov.defaultModel ? 'selected' : ''}>${m}</option>`
      ).join('');
      modelSelect.onchange = () => Store.setAIModel(modelSelect.value);
      Store.setAIModel(prov.defaultModel);
      modelWrap.style.display = 'block';

      // Update key input
      const keyInput = document.getElementById('ai-key-input');
      keyInput.placeholder = prov.keyHint;
      keyInput.disabled = false;
      document.getElementById('ai-key-provider-label').textContent = prov.name;
      document.getElementById('ai-key-hint').innerHTML =
        `Get your key at <a href="${prov.keyUrl}" target="_blank" rel="noopener">${prov.keyUrl}</a> — ${prov.keyGuide}`;
    },

    togglePassword(inputId, toggleEl) {
      const input = document.getElementById(inputId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const el = typeof toggleEl === 'string'
        ? document.getElementById(toggleEl)
        : toggleEl;
      if (el) el.textContent = isPassword ? '🙈' : '👁️';
    },
  };

  function updateObStep() {
    // Update step cards
    document.querySelectorAll('.ob-step').forEach((el, i) => {
      el.classList.toggle('active', i === state.obStep);
    });
    // Update dots
    document.querySelectorAll('.ob-step-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < state.obStep) dot.classList.add('done');
      if (i === state.obStep) dot.classList.add('active');
    });
  }

  function renderProviderGrid() {
    const grid = document.getElementById('provider-grid');
    if (!grid) return;
    grid.innerHTML = AI.getAllProviders().map(p => `
      <div class="provider-card" id="provider-${p.id}" onclick="App.onboarding.selectProvider('${p.id}')">
        <div class="provider-icon">${p.icon}</div>
        <div>${p.name}</div>
      </div>
    `).join('');
  }

  // ══════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════
  const dashboard = {
    async load() {
      // Render skeletons while loading
      renderSkeletons(9);

      try {
        // Load user
        state.user = await GitHub.getAuthenticatedUser();
        updateProfileUI(state.user);

        // Load repos
        state.repos = await GitHub.getAllPublicRepos(state.user.login);

        // Check profile README
        const profileReadme = await GitHub.getProfileReadme(state.user.login);
        const statusEl = document.getElementById('readme-status');
        if (profileReadme.exists) {
          statusEl.className = 'readme-status has-readme';
          statusEl.textContent = '✅ Profile README exists';
        } else {
          statusEl.className = 'readme-status no-readme';
          statusEl.textContent = '❌ No Profile README';
        }

        // Populate language filter
        populateLangFilter(state.repos);

        applyFilters();
      } catch (e) {
        UI.toast(`Failed to load: ${e.message}`, 'error');
        document.getElementById('repo-grid').innerHTML = `
          <div class="empty-state" style="display:flex;grid-column:1/-1">
            <div class="empty-icon">⚠️</div>
            <div class="empty-title">Failed to load repositories</div>
            <div class="empty-desc">${e.message}</div>
            <button class="btn btn-secondary" onclick="App.dashboard.forceRefresh()">Try Again</button>
          </div>`;
      }
    },

    async forceRefresh() {
      Store.cacheClear();
      state.repos = [];
      state.filteredRepos = [];
      state.selectedRepos.clear();
      await dashboard.load();
      UI.toast('Repositories refreshed!', 'success');
    },

    refresh() {
      applyFilters();
    },

    search(query) {
      state.searchQuery = query.toLowerCase();
      applyFilters();
    },

    sort(by) {
      state.sortBy = by;
      applyFilters();
    },

    toggleSelectAll() {
      const allSelected = state.filteredRepos.every(r => state.selectedRepos.has(r.id));
      if (allSelected) {
        state.filteredRepos.forEach(r => state.selectedRepos.delete(r.id));
      } else {
        state.filteredRepos.forEach(r => state.selectedRepos.add(r.id));
      }
      renderRepoGrid(state.filteredRepos);
      updateBulkBar();
    },

    clearSelection() {
      state.selectedRepos.clear();
      renderRepoGrid(state.filteredRepos);
      updateBulkBar();
    },

    setView(mode) {
      state.viewMode = mode;
      const grid = document.getElementById('repo-grid');
      const btnGrid = document.getElementById('btn-grid-view');
      const btnList = document.getElementById('btn-list-view');
      if (mode === 'list') {
        grid.classList.add('list-view');
        btnGrid?.classList.remove('active');
        btnList?.classList.add('active');
      } else {
        grid.classList.remove('list-view');
        btnGrid?.classList.add('active');
        btnList?.classList.remove('active');
      }
    },
  };

  function updateProfileUI(user) {
    // Topbar
    const avatarImg = document.getElementById('topbar-avatar-img');
    avatarImg.src = user.avatar_url;
    avatarImg.alt = user.login;
    document.getElementById('topbar-username').textContent = user.login;

    // Sidebar
    document.getElementById('sidebar-avatar').src = user.avatar_url;
    document.getElementById('sidebar-name').textContent = user.name || user.login;
    document.getElementById('sidebar-login').textContent = '@' + user.login;
    document.getElementById('sidebar-followers').textContent = UI.formatNum(user.followers);
    document.getElementById('sidebar-repos').textContent = UI.formatNum(user.public_repos);
  }

  function populateLangFilter(repos) {
    const langs = [...new Set(repos.map(r => r.language).filter(Boolean))].sort();
    const group = document.getElementById('lang-filter-group');
    group.innerHTML = `
      <label class="filter-option ${!state.langFilter ? 'active' : ''}">
        <input type="radio" name="lang" value="" ${!state.langFilter ? 'checked' : ''} /> All languages
      </label>
      ${langs.map(l => `
        <label class="filter-option ${state.langFilter === l ? 'active' : ''}">
          <input type="radio" name="lang" value="${l}" ${state.langFilter === l ? 'checked' : ''} />
          <span class="repo-lang-dot" data-lang="${l}"></span> ${l}
        </label>
      `).join('')}
    `;

    group.querySelectorAll('input[name="lang"]').forEach(input => {
      input.addEventListener('change', () => {
        state.langFilter = input.value || null;
        group.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
        input.closest('.filter-option').classList.add('active');
        applyFilters();
      });
    });
  }

  function bindFilterEvents() {
    document.querySelectorAll('input[name="filter"]').forEach(input => {
      input.addEventListener('change', () => {
        state.filter = input.value;
        document.querySelectorAll('.filter-option[id^="filter-"]').forEach(o => o.classList.remove('active'));
        document.getElementById(`filter-${input.value === 'all' ? 'all' : input.value}`).classList.add('active');
        applyFilters();
      });
    });
  }

  function applyFilters() {
    let repos = [...state.repos];

    // Filter
    if (state.filter === 'no-desc')    repos = repos.filter(r => !r.description);
    if (state.filter === 'no-topics')  repos = repos.filter(r => !r.topics || r.topics.length === 0);
    if (state.filter === 'no-readme')  repos = repos.filter(r => !r._hasReadme); // computed

    // Language filter
    if (state.langFilter) repos = repos.filter(r => r.language === state.langFilter);

    // Search
    if (state.searchQuery) {
      repos = repos.filter(r =>
        r.name.toLowerCase().includes(state.searchQuery) ||
        (r.description || '').toLowerCase().includes(state.searchQuery) ||
        (r.topics || []).some(t => t.includes(state.searchQuery))
      );
    }

    // Sort
    repos.sort((a, b) => {
      if (state.sortBy === 'stars')   return b.stargazers_count - a.stargazers_count;
      if (state.sortBy === 'name')    return a.name.localeCompare(b.name);
      if (state.sortBy === 'created') return new Date(b.created_at) - new Date(a.created_at);
      return new Date(b.updated_at) - new Date(a.updated_at); // default: updated
    });

    state.filteredRepos = repos;
    renderRepoGrid(repos);
  }

  function renderSkeletons(count) {
    const grid = document.getElementById('repo-grid');
    grid.innerHTML = Array.from({ length: count }, () => UI.skelCard()).join('');
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('repo-count').textContent = '— repos';
  }

  // ── Event delegation for repo grid (set once in init) ──
  function initRepoGridDelegation() {
    const grid = document.getElementById('repo-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.repo-card');
      if (!card) return;
      const repoId = parseInt(card.dataset.repoId);
      const repo = state.repos.find(r => r.id === repoId);
      if (!repo) return;

      // Checkbox click → select
      if (e.target.closest('.repo-card-check')) {
        if (state.selectedRepos.has(repoId)) {
          state.selectedRepos.delete(repoId);
          card.classList.remove('selected');
          const check = card.querySelector('.repo-card-check');
          const svg = check?.querySelector('svg');
          if (svg) svg.remove();
        } else {
          state.selectedRepos.add(repoId);
          card.classList.add('selected');
          card.querySelector('.repo-card-check').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        updateBulkBar();
        return;
      }

      // Card click → open panel
      panel.open(repo);
    });
  }

  function renderRepoGrid(repos) {
    const grid = document.getElementById('repo-grid');
    const emptyState = document.getElementById('empty-state');

    document.getElementById('repo-count').textContent = `${repos.length} repo${repos.length !== 1 ? 's' : ''}`;

    if (repos.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = repos.map(repo => repoCardHTML(repo)).join('');
  }

  function repoCardHTML(repo) {
    const isSelected = state.selectedRepos.has(repo.id);
    const hasDesc = !!repo.description;
    const hasTopics = repo.topics && repo.topics.length > 0;
    const lang = repo.language;

    const topicsHtml = hasTopics
      ? repo.topics.slice(0, 4).map(t => `<span class="topic-tag">${t}</span>`).join('')
        + (repo.topics.length > 4 ? `<span class="topic-tag">+${repo.topics.length - 4}</span>` : '')
      : '';

    const missingItems = [];
    if (!hasDesc)   missingItems.push('description');
    if (!hasTopics) missingItems.push('topics');

    const missingHtml = missingItems.map(item =>
      `<span class="missing-item">❌ ${item}</span>`
    ).join('');

    return `
      <div class="repo-card ${isSelected ? 'selected' : ''}" data-repo-id="${repo.id}">
        <div class="repo-card-check">
          ${isSelected ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>

        <div class="repo-card-header">
          <span class="repo-lang-dot" data-lang="${lang || ''}" title="${lang || 'Unknown'}"></span>
          <div>
            <div class="repo-name truncate">${repo.name}</div>
            <div class="repo-lang">${lang || 'Unknown'}</div>
          </div>
        </div>

        <div class="repo-description ${!hasDesc ? 'empty' : ''}">
          ${hasDesc ? repo.description : 'No description yet — click to add one with AI'}
        </div>

        ${hasTopics ? `<div class="repo-topics">${topicsHtml}</div>` : ''}

        <div class="repo-card-footer">
          <div class="repo-stats">
            <span class="repo-stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ${UI.formatNum(repo.stargazers_count)}
            </span>
            <span class="repo-stat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2a2 2 0 01-2 2H8a2 2 0 01-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>
              ${UI.formatNum(repo.forks_count)}
            </span>
            <span>${UI.relativeTime(repo.updated_at)}</span>
          </div>
          <div class="repo-missing">${missingHtml}</div>
        </div>
      </div>`;
  }

  function updateBulkBar() {
    const count = state.selectedRepos.size;
    const bulkBar = document.getElementById('bulk-bar');
    const bulkCount = document.getElementById('bulk-count');
    const btnSelectAll = document.getElementById('btn-select-all');

    bulkCount.textContent = `${count} selected`;
    bulkBar.classList.toggle('visible', count > 0);

    const allSelected = state.filteredRepos.length > 0 &&
      state.filteredRepos.every(r => state.selectedRepos.has(r.id));
    btnSelectAll.textContent = allSelected ? 'Deselect All' : 'Select All';
  }

  // ══════════════════════════════════════
  //  DETAIL PANEL
  // ══════════════════════════════════════
  const panel = {
    open(repo) {
      state.activeRepo = repo;
      const panelEl = document.getElementById('detail-panel');
      const panelBody = document.getElementById('panel-body');

      document.getElementById('panel-title').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        ${repo.name}
      `;

      const hasDesc = !!repo.description;
      const hasTopics = repo.topics && repo.topics.length > 0;
      const topicsHtml = hasTopics
        ? repo.topics.map(t => `<span class="topic-tag">${t}</span>`).join('')
        : `<span style="color:var(--text-muted);font-size:0.8125rem;font-style:italic">No topics yet</span>`;

      panelBody.innerHTML = `
        <div class="panel-repo-info">
          <div class="panel-repo-name">${repo.name}</div>
          ${repo.language ? `<span class="badge badge-blue">${repo.language}</span>` : ''}
          <p class="panel-repo-desc ${!hasDesc ? 'empty' : ''}">${hasDesc ? repo.description : 'No description'}</p>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="color:var(--warning)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span style="font-size:0.8125rem;color:var(--text-secondary)">${repo.stargazers_count} stars</span>
            <span style="font-size:0.8125rem;color:var(--text-secondary)">•</span>
            <span style="font-size:0.8125rem;color:var(--text-secondary)">${repo.forks_count} forks</span>
            <span style="font-size:0.8125rem;color:var(--text-secondary)">•</span>
            <span style="font-size:0.8125rem;color:var(--text-secondary)">Updated ${UI.relativeTime(repo.updated_at)}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${topicsHtml}</div>
          <a href="${repo.html_url}" target="_blank" rel="noopener" style="font-size:0.75rem;display:flex;align-items:center;gap:4px;color:var(--accent);margin-top:4px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            Open on GitHub
          </a>
        </div>

        <div class="panel-section">
          <div class="panel-section-title">AI Actions</div>
          <div class="action-cards">
            <div class="action-card" onclick="App.actions.addTopics()">
              <div class="action-card-icon" style="background:var(--accent-bg);color:var(--accent)">🏷️</div>
              <div class="action-card-body">
                <div class="action-card-name">Add Topics</div>
                <div class="action-card-desc">AI suggests 5-8 relevant topics</div>
              </div>
              <div class="action-card-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
            <div class="action-card" onclick="App.actions.addDescription()">
              <div class="action-card-icon" style="background:var(--success-bg);color:var(--success)">📝</div>
              <div class="action-card-body">
                <div class="action-card-name">Write Description</div>
                <div class="action-card-desc">A concise, professional description</div>
              </div>
              <div class="action-card-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
            <div class="action-card" onclick="App.actions.addReadme()">
              <div class="action-card-icon" style="background:var(--purple-bg);color:var(--purple)">📖</div>
              <div class="action-card-body">
                <div class="action-card-name">Generate README</div>
                <div class="action-card-desc">Full README.md with sections & badges</div>
              </div>
              <div class="action-card-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
            <div class="action-card" style="border-color:rgba(88,166,255,0.3);background:rgba(88,166,255,0.04)" onclick="App.actions.doEverything()">
              <div class="action-card-icon" style="background:var(--grad-accent);color:white">⚡</div>
              <div class="action-card-body">
                <div class="action-card-name" style="background:var(--grad-accent);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Do Everything</div>
                <div class="action-card-desc">Topics + Description + README in one go</div>
              </div>
              <div class="action-card-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
          </div>
        </div>
      `;

      panelEl.classList.add('open');
    },

    close() {
      document.getElementById('detail-panel').classList.remove('open');
      state.activeRepo = null;
    },
  };

  // ── AI history ──
  function pushHistory(repoId, type, result) {
    if (!state.aiHistory.has(repoId)) state.aiHistory.set(repoId, []);
    const list = state.aiHistory.get(repoId);
    list.unshift({ type, result, time: new Date() });
    if (list.length > 10) list.pop();
  }

  function getHistory(repoId) {
    return state.aiHistory.get(repoId) || [];
  }

  // ── AI ACTIONS (single repo) ──
  const actions = {
    async addTopics() {
      const repo = state.activeRepo;
      if (!repo) return;

      modal.open('🏷️ AI Topic Suggestions', 'topics', repo);

      try {
        // Fetch README for project content context
        const existing = await GitHub.getReadme(state.user.login, repo.name).catch(() => ({ content: null }));
        const opts = { ...aiOpts(), readmeContent: existing.content };
        const prompt = Prompts.topics(repo, opts);

        const raw = await AI.complete(prompt.user, prompt.system);
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('AI did not return valid JSON. Please try again or switch models.');
        const topics = JSON.parse(jsonMatch[0]);
        state.modalResult = { topics };
        pushHistory(repo.id, 'topics', topics);
        modal.showTopicsPreview(topics, repo.topics || []);
      } catch (e) {
        modal.showError(e.message);
      }
    },

    async addDescription() {
      const repo = state.activeRepo;
      if (!repo) return;

      modal.open('📝 AI Description', 'description', repo);

      try {
        // Fetch README for project content context
        const existing = await GitHub.getReadme(state.user.login, repo.name).catch(() => ({ content: null }));
        const opts = { ...aiOpts(), readmeContent: existing.content };
        const prompt = Prompts.description(repo, opts);

        const description = await AI.complete(prompt.user, prompt.system);
        state.modalResult = { description };
        pushHistory(repo.id, 'description', description);
        modal.showDescriptionPreview(description);
      } catch (e) {
        modal.showError(e.message);
      }
    },

    async addReadme() {
      const repo = state.activeRepo;
      if (!repo) return;

      modal.open('📖 AI README Generator', 'readme', repo);

      try {
        const existing = await GitHub.getReadme(state.user.login, repo.name);
        const prompt = Prompts.readme(repo, existing.content, aiOpts());
        const content = withSignature(await AI.complete(prompt.user, prompt.system));
        state.modalResult = { content, sha: existing.sha };
        pushHistory(repo.id, 'readme', content);
        modal.showReadmePreview(content);
      } catch (e) {
        modal.showError(e.message);
      }
    },

    async doEverything() {
      const repo = state.activeRepo;
      if (!repo) return;

      modal.open('⚡ Do Everything', 'all', repo);
      const opts = aiOpts();

      try {
        const readmeInfo = await GitHub.getReadme(state.user.login, repo.name).catch(() => ({ content: null, sha: null }));
        const optsWithContent = { ...opts, readmeContent: readmeInfo.content };

        const readmePrompt = Prompts.readme(repo, readmeInfo.content, opts);
        const readmeContent = withSignature(await AI.complete(readmePrompt.user, readmePrompt.system));
        await new Promise(r => setTimeout(r, 500));

        const descResult = await AI.complete(Prompts.description(repo, optsWithContent).user, Prompts.description(repo, optsWithContent).system);
        await new Promise(r => setTimeout(r, 500));

        const topicsResult = await AI.complete(Prompts.topics(repo, optsWithContent).user, Prompts.topics(repo, optsWithContent).system);

        const topicsMatch = topicsResult.match(/\[[\s\S]*\]/);
        if (!topicsMatch) throw new Error('AI did not return valid topic JSON. Please try again.');
        const topics = JSON.parse(topicsMatch[0]);
        const description = descResult.trim();

        state.modalResult = { topics, description, readmeContent, readmeSha: readmeInfo.sha };
        pushHistory(repo.id, 'all', { topics, description, readmeContent });
        modal.showAllPreview(topics, description, readmeContent);
      } catch (e) {
        modal.showError(e.message);
      }
    },

    async profileReadme() {
      if (!state.user) {
        UI.toast('User not loaded yet.', 'error');
        return;
      }

      state.modalAction = 'profileReadme';
      state.modalRepo = null;
      state.modalResult = null;

      document.getElementById('ai-modal-title').textContent = '👤 Profile README Generator';
      document.getElementById('ai-modal-footer').style.display = 'none';
      document.getElementById('ai-modal').style.display = 'flex';
      modal.showProfileWizard();
    },

    // ── Bulk actions ──
    async bulkTopics() {
      const repos = getSelectedRepos();
      if (!repos.length) return;
      const opts = aiOpts();
      await bulkModal.run('🏷️ Adding Topics', repos, async (repo, log) => {
        const prompt = Prompts.topics(repo, opts);
        const raw = await AI.complete(prompt.user, prompt.system);
        const topicMatch = raw.match(/\[[\s\S]*\]/);
        if (!topicMatch) throw new Error(`AI did not return valid JSON for ${repo.name}.`);
        const topics = JSON.parse(topicMatch[0]);
        await GitHub.updateRepoTopics(state.user.login, repo.name, topics);
        repo.topics = topics;
        log(`✅ ${repo.name}: ${topics.join(', ')}`);
      });
      sendNotification('EasyGit', `Topics added to ${repos.length} repositories.`);
    },

    async bulkDescriptions() {
      const repos = getSelectedRepos();
      if (!repos.length) return;
      const opts = aiOpts();
      await bulkModal.run('📝 Writing Descriptions', repos, async (repo, log) => {
        const prompt = Prompts.description(repo, opts);
        const description = (await AI.complete(prompt.user, prompt.system)).trim();
        await GitHub.updateRepoDescription(state.user.login, repo.name, description);
        repo.description = description;
        log(`✅ ${repo.name}: ${description}`);
      });
      sendNotification('EasyGit', `Descriptions updated for ${repos.length} repositories.`);
    },

    async bulkReadmes() {
      const repos = getSelectedRepos();
      if (!repos.length) return;
      const opts = aiOpts();
      await bulkModal.run('📖 Generating READMEs', repos, async (repo, log) => {
        const existing = await GitHub.getReadme(state.user.login, repo.name);
        const prompt = Prompts.readme(repo, existing.content, opts);
        const content = withSignature(await AI.complete(prompt.user, prompt.system));
        await GitHub.createOrUpdateReadme(state.user.login, repo.name, content, existing.sha);
        log(`✅ ${repo.name}: README ${existing.sha ? 'updated' : 'created'}`);
      });
      sendNotification('EasyGit', `READMEs generated for ${repos.length} repositories.`);
    },

    async bulkAll() {
      const repos = getSelectedRepos();
      if (!repos.length) return;
      const opts = aiOpts();
      await bulkModal.run('⚡ Doing Everything', repos, async (repo, log) => {
        log(`⏳ Processing ${repo.name}...`);
        const existingReadme = await GitHub.getReadme(state.user.login, repo.name);
        const optsWithContent = { ...opts, readmeContent: existingReadme.content };

        const readmeContent = withSignature(await AI.complete(Prompts.readme(repo, existingReadme.content, opts).user, Prompts.readme(repo, existingReadme.content, opts).system));
        await new Promise(r => setTimeout(r, 500));
        const desc = await AI.complete(Prompts.description(repo, optsWithContent).user, Prompts.description(repo, optsWithContent).system);
        await new Promise(r => setTimeout(r, 500));
        const tRaw = await AI.complete(Prompts.topics(repo, optsWithContent).user, Prompts.topics(repo, optsWithContent).system);

        const tMatch = tRaw.match(/\[[\s\S]*\]/);
        if (!tMatch) throw new Error(`AI did not return valid JSON for ${repo.name}. Skipping.`);
        const topics = JSON.parse(tMatch[0]);
        await Promise.all([
          GitHub.updateRepoTopics(state.user.login, repo.name, topics),
          GitHub.updateRepoDescription(state.user.login, repo.name, desc.trim()),
          GitHub.createOrUpdateReadme(state.user.login, repo.name, readmeContent, existingReadme.sha),
        ]);
        repo.topics = topics;
        repo.description = desc.trim();
        log(`✅ ${repo.name}: Topics, description & README done!`);
      });
      sendNotification('EasyGit', `All done for ${repos.length} repositories!`);
    },
  };

  function getSelectedRepos() {
    return state.repos.filter(r => state.selectedRepos.has(r.id));
  }

  // ══════════════════════════════════════
  //  AI MODAL
  // ══════════════════════════════════════
  const modal = {
    open(title, action, repo) {
      state.modalAction = action;
      state.modalRepo = repo;
      state.modalResult = null;

      document.getElementById('ai-modal-title').textContent = title;
      document.getElementById('ai-modal-footer').style.display = 'none';
      document.getElementById('ai-modal').style.display = 'flex';
      document.getElementById('ai-modal-body').innerHTML = `
        <div class="ai-loading">
          <div class="ai-loading-icon">✨</div>
          <div class="ai-loading-title">AI is analyzing your repository...</div>
          <div class="ai-loading-sub">${repo ? repo.name : 'Your profile'}</div>
          <div class="progress-bar-wrap"><div class="progress-bar"></div></div>
        </div>`;
    },

    showTopicsPreview(topics, existingTopics) {
      const footer = document.getElementById('ai-modal-footer');
      const body = document.getElementById('ai-modal-body');
      const existing = existingTopics.filter(t => !topics.includes(t));

      body.innerHTML = `
        <div class="preview-section">
          <div class="preview-label">Suggested Topics (click to remove)</div>
          <div class="topics-preview" id="topics-preview"></div>
          ${existing.length ? `
          <div class="preview-label" style="margin-top:12px">Existing topics not in suggestion (click to keep)</div>
          <div id="existing-topics" style="display:flex;flex-wrap:wrap;gap:6px"></div>` : ''}
          <div style="margin-top:16px;padding:12px;background:var(--bg-overlay);border-radius:8px;font-size:0.8125rem;color:var(--text-secondary)">
            Add your own topic:
            <div style="display:flex;gap:8px;margin-top:8px">
              <input type="text" id="custom-topic-input" class="input" style="flex:1" placeholder="my-topic" maxlength="35"
                onkeydown="if(event.key==='Enter'){App.modal.addCustomTopic();}" />
              <button class="btn btn-secondary btn-sm" onclick="App.modal.addCustomTopic()">Add</button>
            </div>
          </div>
        </div>`;

      const preview = document.getElementById('topics-preview');
      topics.forEach(t => preview.appendChild(modal._makeTopicTag(t)));

      if (existing.length) {
        const existingEl = document.getElementById('existing-topics');
        existing.forEach(t => {
          const chip = document.createElement('span');
          chip.className = 'topic-tag';
          chip.style.cssText = 'opacity:0.5;cursor:pointer';
          chip.textContent = '+ ' + t;
          chip.onclick = () => {
            preview.appendChild(modal._makeTopicTag(t));
            chip.remove();
          };
          existingEl.appendChild(chip);
        });
      }

      footer.style.display = 'flex';
    },

    _makeTopicTag(val) {
      const span = document.createElement('span');
      span.className = 'topic-tag removable';
      span.dataset.topic = val;
      const text = document.createTextNode(val + ' ');
      const x = document.createElement('span');
      x.className = 'tag-remove';
      x.textContent = '×';
      span.appendChild(text);
      span.appendChild(x);
      span.onclick = () => span.remove();
      return span;
    },

    addCustomTopic() {
      const input = document.getElementById('custom-topic-input');
      const val = input.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!val) return;
      document.getElementById('topics-preview').appendChild(modal._makeTopicTag(val));
      input.value = '';
    },

    showDescriptionPreview(description) {
      const body = document.getElementById('ai-modal-body');
      body.innerHTML = `
        <div class="preview-section">
          <div class="preview-label">Generated Description (editable)</div>
          <textarea class="desc-preview" id="desc-preview" maxlength="350">${description}</textarea>
          <div style="text-align:right;font-size:0.75rem;color:var(--text-muted)" id="desc-char-count">${description.length}/350</div>
        </div>`;
      const ta = document.getElementById('desc-preview');
      ta.addEventListener('input', () => {
        document.getElementById('desc-char-count').textContent = `${ta.value.length}/350`;
      });
      document.getElementById('ai-modal-footer').style.display = 'flex';
    },

    showReadmePreview(content) {
      const body = document.getElementById('ai-modal-body');
      body.innerHTML = `
        <div class="preview-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div class="preview-label" style="margin:0">README Preview</div>
            <div class="preview-tabs">
              <button class="preview-tab active" id="tab-preview" onclick="App.modal.switchTab('preview')">Preview</button>
              <button class="preview-tab" id="tab-raw" onclick="App.modal.switchTab('raw')">Raw</button>
            </div>
          </div>
          <div id="readme-preview-pane" class="markdown-preview">${UI.renderMarkdown(content)}</div>
          <textarea id="readme-raw-pane" class="desc-preview" style="display:none;min-height:300px;font-family:var(--font-mono);font-size:0.8rem">${content}</textarea>
        </div>`;
      const footer = document.getElementById('ai-modal-footer');
      footer.style.display = 'flex';
      // Show save to file button for readme
      const saveBtn = document.getElementById('ai-modal-save-btn');
      if (saveBtn) saveBtn.style.display = 'inline-flex';
    },

    showAllPreview(topics, description, readmeContent) {
      const body = document.getElementById('ai-modal-body');
      body.innerHTML = `
        <div class="preview-section">
          <div class="preview-label">Topics</div>
          <div class="topics-preview" id="topics-preview"></div>`;
      const preview = body.querySelector('#topics-preview');
      topics.forEach(t => preview.appendChild(modal._makeTopicTag(t)));
      body.querySelector('.preview-section').insertAdjacentHTML('beforeend', `

          <div class="preview-label" style="margin-top:16px">Description</div>
          <textarea class="desc-preview" id="desc-preview" maxlength="350">${description}</textarea>

          <div class="preview-label" style="margin-top:16px">README</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="preview-tabs">
              <button class="preview-tab active" id="tab-preview" onclick="App.modal.switchTab('preview')">Preview</button>
              <button class="preview-tab" id="tab-raw" onclick="App.modal.switchTab('raw')">Raw</button>
            </div>
          </div>
          <div id="readme-preview-pane" class="markdown-preview">${UI.renderMarkdown(readmeContent)}</div>
          <textarea id="readme-raw-pane" class="desc-preview" style="display:none;min-height:200px;font-family:var(--font-mono);font-size:0.8rem">${readmeContent}</textarea>
        `);
      document.getElementById('ai-modal-footer').style.display = 'flex';
    },

    showProfileWizard() {
      const body = document.getElementById('ai-modal-body');
      document.getElementById('ai-modal-footer').style.display = 'none';

      const templates = Prompts.PROFILE_TEMPLATES;
      const allSections = [
        { id: 'greeting', label: '👋 Greeting' },
        { id: 'bio',      label: '📝 Bio' },
        { id: 'stats',    label: '📊 Stats' },
        { id: 'tech',     label: '🛠️ Tech Stack' },
        { id: 'projects', label: '📌 Projects' },
        { id: 'activity', label: '🔭 Activity' },
        { id: 'contact',  label: '📬 Contact' },
        { id: 'fun',      label: '🎲 Fun Fact' },
      ];

      body.innerHTML = `
        <div class="profile-wizard">
          <div class="wizard-section">
            <div class="wizard-section-title">Template</div>
            <div class="wizard-style-grid" id="wizard-templates" style="grid-template-columns:repeat(3,1fr)">
              ${Object.entries(templates).map(([id, t], i) => `
                <div class="wizard-style-card ${i === 0 ? 'selected' : ''}" data-template="${id}" onclick="App.modal.selectWizardTemplate(this)">
                  <div class="wizard-style-label">${t.name}</div>
                  <div class="wizard-style-desc">${t.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="wizard-section">
            <div class="wizard-section-title">Sections <span style="color:var(--text-muted);font-weight:400;font-size:0.75rem">(toggle)</span></div>
            <div class="wizard-sections-grid">
              ${allSections.map((s, i) => `
                <div class="wizard-section-chip ${i < 5 ? 'selected' : ''}" data-section="${s.id}" onclick="this.classList.toggle('selected')">${s.label}</div>
              `).join('')}
            </div>
          </div>

          <div class="wizard-section">
            <div class="wizard-section-title">Stats Widgets</div>
            <div class="wizard-toggles">
              <label class="wizard-toggle"><input type="checkbox" id="wiz-streak" checked /><span class="wizard-toggle-track"></span><span class="wizard-toggle-label">🔥 Streak</span></label>
              <label class="wizard-toggle"><input type="checkbox" id="wiz-langs" checked /><span class="wizard-toggle-track"></span><span class="wizard-toggle-label">📊 Top Languages</span></label>
              <label class="wizard-toggle"><input type="checkbox" id="wiz-trophies" /><span class="wizard-toggle-track"></span><span class="wizard-toggle-label">🏆 Trophies</span></label>
            </div>
          </div>

          <div class="wizard-section">
            <div class="wizard-section-title">Personal Note <span style="color:var(--text-muted);font-weight:400;font-size:0.75rem">(optional — AI will use this)</span></div>
            <textarea id="wiz-custom-bio" class="desc-preview" style="min-height:60px" placeholder="E.g. I love building dev tools and open source. Currently learning Rust and WebAssembly."></textarea>
          </div>

          <button class="btn btn-gradient" style="width:100%;margin-top:4px" onclick="App.modal.generateProfileReadme()">
            ✨ Generate Profile README
          </button>
        </div>`;
    },

    selectWizardTemplate(el) {
      document.querySelectorAll('.wizard-style-card[data-template]').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
    },

    async generateProfileReadme() {
      const template = document.querySelector('.wizard-style-card[data-template].selected')?.dataset.template || 'classic';
      const sections = [...document.querySelectorAll('.wizard-section-chip.selected')].map(el => el.dataset.section);
      const showStreak   = document.getElementById('wiz-streak')?.checked ?? true;
      const showTopLangs = document.getElementById('wiz-langs')?.checked ?? true;
      const showTrophies = document.getElementById('wiz-trophies')?.checked ?? false;
      const customBio    = document.getElementById('wiz-custom-bio')?.value.trim() || '';

      document.getElementById('ai-modal-body').innerHTML = `
        <div class="ai-loading">
          <div class="ai-loading-icon">✨</div>
          <div class="ai-loading-title">Fetching your full profile data...</div>
          <div class="ai-loading-sub">${state.user.login}</div>
          <div class="progress-bar-wrap"><div class="progress-bar"></div></div>
        </div>`;

      try {
        const [existing, pinned, social] = await Promise.all([
          GitHub.getProfileReadme(state.user.login),
          GitHub.getPinnedRepos(state.user.login),
          GitHub.getSocialAccounts(state.user.login),
        ]);

        const opts = { ...aiOpts(), template, sections, showStreak, showTopLangs, showTrophies, customBio };
        const prompt = Prompts.profileReadme(state.user, state.repos, existing.content, opts, pinned, social);
        const content = withSignature(await AI.complete(prompt.user, prompt.system, { maxTokens: prompt.maxTokens || 8192 }));
        state.modalResult = { content, sha: existing.sha };
        pushHistory('profile', 'profileReadme', content);
        modal.showReadmePreview(content);
      } catch (e) {
        modal.showError(e.message);
      }
    },

    showError(msg) {
      document.getElementById('ai-modal-body').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">AI Error</div>
          <div class="empty-desc">${msg}</div>
        </div>`;
      document.getElementById('ai-modal-footer').style.display = 'flex';
    },

    switchTab(tab) {
      const previewPane = document.getElementById('readme-preview-pane');
      const rawPane = document.getElementById('readme-raw-pane');
      document.getElementById('tab-preview').classList.toggle('active', tab === 'preview');
      document.getElementById('tab-raw').classList.toggle('active', tab === 'raw');
      if (previewPane) previewPane.style.display = tab === 'preview' ? 'block' : 'none';
      if (rawPane) rawPane.style.display = tab === 'raw' ? 'block' : 'none';
    },

    async apply() {
      const btn = document.getElementById('ai-modal-apply-btn');
      UI.setLoading(btn, true, 'Applying...');

      try {
        const action = state.modalAction;
        const repo = state.modalRepo;
        const owner = state.user.login;

        if (action === 'topics' || action === 'all') {
          const topicEls = document.querySelectorAll('#topics-preview .topic-tag');
          const topics = [...topicEls]
            .map(el => (el.dataset.topic || el.firstChild?.textContent?.trim() || '').trim())
            .filter(Boolean);
          await GitHub.updateRepoTopics(owner, repo.name, topics);
          const localRepo = state.repos.find(r => r.id === repo.id);
          if (localRepo) localRepo.topics = topics;
          if (action === 'topics') { UI.toast(`✅ Topics updated for ${repo.name}`, 'success'); }
        }

        if (action === 'description' || action === 'all') {
          const descEl = document.getElementById('desc-preview');
          const description = descEl ? descEl.value.trim() : state.modalResult?.description;
          if (description) {
            await GitHub.updateRepoDescription(owner, repo.name, description);
            const localRepo = state.repos.find(r => r.id === repo.id);
            if (localRepo) localRepo.description = description;
            if (action === 'description') { UI.toast(`✅ Description updated for ${repo.name}`, 'success'); }
          }
        }

        if (action === 'readme' || action === 'all') {
          const rawEl = document.getElementById('readme-raw-pane');
          const content = rawEl ? rawEl.value : state.modalResult?.content || state.modalResult?.readmeContent;
          const sha = state.modalResult?.sha || state.modalResult?.readmeSha;
          if (content) {
            await GitHub.createOrUpdateReadme(owner, repo.name, content, sha);
            if (action === 'readme') { UI.toast(`✅ README ${sha ? 'updated' : 'created'} for ${repo.name}`, 'success'); }
          }
        }

        if (action === 'profileReadme') {
          const rawEl = document.getElementById('readme-raw-pane');
          const content = rawEl ? rawEl.value : state.modalResult?.content;
          const sha = state.modalResult?.sha;
          if (content) {
            await GitHub.createOrUpdateProfileReadme(owner, content, sha);
            UI.toast(`✅ Profile README ${sha ? 'updated' : 'created'}!`, 'success');
            document.getElementById('readme-status').className = 'readme-status has-readme';
            document.getElementById('readme-status').textContent = '✅ Profile README exists';
          }
        }

        if (action === 'all') {
          UI.toast(`✅ Everything applied to ${repo.name}!`, 'success');
          sendNotification('EasyGit', `${repo.name} fully updated on GitHub.`);
        }

        modal.close();
        applyFilters();
      } catch (e) {
        UI.toast(`❌ Error: ${e.message}`, 'error');
      } finally {
        UI.setLoading(btn, false);
      }
    },

    async saveToFile() {
      const rawEl = document.getElementById('readme-raw-pane');
      const content = rawEl ? rawEl.value : state.modalResult?.content || state.modalResult?.readmeContent || '';
      if (!content) return;

      const repoName = state.modalRepo?.name || (state.user?.login + '-profile');
      const filename = state.modalAction === 'profileReadme' ? 'profile-README.md' : `${repoName}-README.md`;

      // Electron: use native save dialog
      if (window.electronAPI?.saveFile) {
        await window.electronAPI.saveFile(content, filename);
        return;
      }

      // Web fallback: download
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('File downloaded!', 'success');
    },

    regenerate() {
      const action = state.modalAction;
      if (action === 'topics') actions.addTopics();
      else if (action === 'description') actions.addDescription();
      else if (action === 'readme') actions.addReadme();
      else if (action === 'all') actions.doEverything();
      else if (action === 'profileReadme') modal.showProfileWizard();
    },

    close() {
      document.getElementById('ai-modal').style.display = 'none';
    },

    closeOnBackdrop(e) {
      if (e.target === document.getElementById('ai-modal')) modal.close();
    },
  };

  // ══════════════════════════════════════
  //  BULK PROGRESS MODAL
  // ══════════════════════════════════════
  const bulkModal = {
    async run(title, repos, taskFn) {
      const modalEl = document.getElementById('bulk-modal');
      const bodyEl = document.getElementById('bulk-modal-body');
      const closeBtn = document.getElementById('bulk-modal-close-btn');
      const titleEl = document.getElementById('bulk-modal-title');

      titleEl.textContent = title;
      closeBtn.disabled = true;
      bodyEl.innerHTML = '';
      modalEl.style.display = 'flex';

      let successCount = 0;
      let failCount = 0;

      for (const repo of repos) {
        const logEl = document.createElement('div');
        logEl.style.cssText = 'font-size:0.8125rem;color:var(--text-secondary);padding:4px 0;transition:color 0.2s';
        logEl.textContent = `⏳ ${repo.name}...`;
        bodyEl.appendChild(logEl);
        bodyEl.scrollTop = bodyEl.scrollHeight;

        const log = (msg) => {
          logEl.textContent = msg;
          logEl.style.color = msg.startsWith('✅') ? 'var(--success)' : msg.startsWith('❌') ? 'var(--danger)' : 'var(--text-secondary)';
        };

        try {
          await taskFn(repo, log);
          successCount++;
        } catch (e) {
          log(`❌ ${repo.name}: ${e.message}`);
          failCount++;
        }

        await new Promise(r => setTimeout(r, 200)); // Small delay for UX
      }

      // Summary
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-top:16px;padding:12px;background:var(--bg-overlay);border-radius:8px;font-size:0.875rem;font-weight:600;color:var(--text-primary)';
      summary.textContent = `Done! ✅ ${successCount} succeeded${failCount ? `, ❌ ${failCount} failed` : ''}`;
      bodyEl.appendChild(summary);

      closeBtn.disabled = false;
      applyFilters();
      UI.toast(`Bulk operation complete: ${successCount}/${repos.length} done`, 'success');
    },

    close() {
      document.getElementById('bulk-modal').style.display = 'none';
    },
  };

  // ══════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════
  const settings = {
    open() {
      const modal = document.getElementById('settings-modal');

      const provSelect = document.getElementById('settings-ai-provider');
      provSelect.innerHTML = AI.getAllProviders()
        .map(p => `<option value="${p.id}" ${p.id === Store.getAIProvider() ? 'selected' : ''}>${p.icon} ${p.name}</option>`)
        .join('');
      settings.onProviderChange();

      // Render per-provider key inputs
      const keysContainer = document.getElementById('settings-provider-keys');
      keysContainer.innerHTML = AI.getAllProviders().map(p => `
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:110px;font-size:0.8125rem;color:var(--text-secondary);flex-shrink:0">${p.icon} ${p.name}</span>
          <div class="input-with-icon" style="flex:1">
            <input type="password" id="key-${p.id}" class="input" style="font-size:0.8125rem;padding:6px 36px 6px 10px"
              placeholder="${p.keyHint}" value="${Store.getProviderKey(p.id) || ''}" autocomplete="off" spellcheck="false" />
            <span class="input-icon" style="font-size:0.85rem" onclick="App.onboarding.togglePassword('key-${p.id}', this)">👁️</span>
          </div>
        </div>
      `).join('');

      document.getElementById('settings-github-token').value = Store.getGitHubToken();
      document.getElementById('settings-custom-instructions').value = Store.getCustomInstructions();
      document.getElementById('settings-signature').value = Store.getSignature();

      const currentTone = Store.getAITone();
      document.querySelectorAll('#settings-tone-chips .tone-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.tone === currentTone);
      });

      modal.style.display = 'flex';
    },

    onProviderChange() {
      const providerId = document.getElementById('settings-ai-provider').value;
      const prov = AI.getProvider(providerId);
      const modelSelect = document.getElementById('settings-ai-model');
      const currentModel = Store.getAIModel();
      modelSelect.innerHTML = prov.models
        .map(m => `<option value="${m}" ${m === (currentModel || prov.defaultModel) ? 'selected' : ''}>${m}</option>`)
        .join('');
    },

    selectTone(chip) {
      document.querySelectorAll('#settings-tone-chips .tone-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      Store.setAITone(chip.dataset.tone);
    },

    async save() {
      const githubToken = document.getElementById('settings-github-token').value.trim();
      const aiProvider  = document.getElementById('settings-ai-provider').value;
      const aiModel     = document.getElementById('settings-ai-model').value;
      const customInstructions = document.getElementById('settings-custom-instructions').value;
      const signature      = document.getElementById('settings-signature').value;
      const aiTone         = document.querySelector('#settings-tone-chips .tone-chip.active')?.dataset.tone || 'default';

      const providerKeys = {};
      AI.getAllProviders().forEach(p => {
        const val = document.getElementById(`key-${p.id}`)?.value.trim();
        if (val) providerKeys[p.id] = val;
      });

      Store.saveAll({ githubToken, aiProvider, aiModel, aiTone, customInstructions, signature, providerKeys });
      Store.cacheClear();
      UI.toast('Settings saved!', 'success');
      settings.close();
    },

    close() {
      document.getElementById('settings-modal').style.display = 'none';
    },

    closeOnBackdrop(e) {
      if (e.target === document.getElementById('settings-modal')) settings.close();
    },

    reset() {
      if (!confirm('This will sign you out and clear all saved settings. Continue?')) return;
      Store.clear();
      Store.cacheClear();
      state.user = null;
      state.repos = [];
      state.selectedRepos.clear();
      settings.close();
      showOnboarding();
    },
  };

  // ══════════════════════════════════════
  //  EXPOSE PUBLIC API
  // ══════════════════════════════════════
  return {
    init,
    onboarding,
    dashboard,
    panel,
    actions,
    modal,
    bulkModal,
    settings,
    contextActions,
    closeContextMenu,
    getHistory,
    sendNotification,
  };
})();

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
