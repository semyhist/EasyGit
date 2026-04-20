/**
 * EasyGit — GitHub API Wrapper
 * Covers: user info, repos, topics, description, README (contents API).
 */

const GitHub = (() => {
  const BASE = 'https://api.github.com';

  function headers(token) {
    return {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async function request(path, options = {}) {
    const token = Store.getGitHubToken();
    if (!token) throw new Error('GitHub token not set.');

    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers(token), ...(options.headers || {}) },
    });

    if (!res.ok) {
      let msg = `GitHub API error ${res.status}`;
      try {
        const data = await res.json();
        msg = data.message || msg;
      } catch {}
      throw new Error(msg);
    }

    if (res.status === 204) return null; // No content
    return res.json();
  }

  // ── User ──

  async function getAuthenticatedUser() {
    const cached = Store.cacheGet('user');
    if (cached) return cached;
    const user = await request('/user');
    Store.cacheSet('user', user);
    return user;
  }

  async function validateToken() {
    try {
      const user = await getAuthenticatedUser();
      return { valid: true, user };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  // ── Repos ──

  async function getPublicRepos(username, page = 1, perPage = 100) {
    const repos = await request(
      `/users/${username}/repos?type=public&per_page=${perPage}&page=${page}&sort=updated`
    );
    return repos;
  }

  async function getAllPublicRepos(username) {
    const cached = Store.cacheGet(`repos_${username}`);
    if (cached) return cached;

    let all = [];
    let page = 1;
    while (true) {
      const chunk = await getPublicRepos(username, page);
      all = all.concat(chunk);
      if (chunk.length < 100) break;
      page++;
    }

    Store.cacheSet(`repos_${username}`, all);
    return all;
  }

  async function getRepo(owner, repo) {
    return request(`/repos/${owner}/${repo}`);
  }

  // ── Update Repo (description + topics together if needed) ──

  async function updateRepoDescription(owner, repo, description) {
    return request(`/repos/${owner}/${repo}`, {
      method: 'PATCH',
      body: JSON.stringify({ description }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function updateRepoTopics(owner, repo, topics) {
    // Topics API requires a different accept header
    const token = Store.getGitHubToken();
    const res = await fetch(`${BASE}/repos/${owner}/${repo}/topics`, {
      method: 'PUT',
      headers: {
        ...headers(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ names: topics }),
    });

    if (!res.ok) {
      let msg = `GitHub topics update error ${res.status}`;
      try { const d = await res.json(); msg = d.message || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  // ── README ──

  // UTF-8 safe base64 decode helper
  function decodeBase64UTF8(base64) {
    try {
      const raw = atob(base64.replace(/\n/g, ''));
      // Handle UTF-8 multi-byte sequences
      return decodeURIComponent(escape(raw));
    } catch {
      // Fallback: plain atob for ASCII-only content
      return atob(base64.replace(/\n/g, ''));
    }
  }

  async function getReadme(owner, repo) {
    try {
      const data = await request(`/repos/${owner}/${repo}/readme`);
      const content = decodeBase64UTF8(data.content);
      return { exists: true, content, sha: data.sha, path: data.path };
    } catch (e) {
      if (e.message.includes('404') || e.message.includes('Not Found')) {
        return { exists: false, content: null, sha: null };
      }
      throw e;
    }
  }

  async function createOrUpdateReadme(owner, repo, content, sha = null, commitMessage = null) {
    const msg = commitMessage || (sha ? `docs: update README via EasyGit` : `docs: add README via EasyGit`);
    const body = {
      message: msg,
      content: btoa(unescape(encodeURIComponent(content))), // UTF-8 safe base64
    };
    if (sha) body.sha = sha;

    return request(`/repos/${owner}/${repo}/contents/README.md`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Profile README (username/username repo) ──

  async function getProfileReadme(username) {
    try {
      const data = await request(`/repos/${username}/${username}/readme`);
      const content = decodeBase64UTF8(data.content);
      return { exists: true, content, sha: data.sha };
    } catch {
      return { exists: false, content: null, sha: null };
    }
  }

  async function createOrUpdateProfileReadme(username, content, sha = null) {
    try {
      // Ensure the special repo exists, if not guide user (we can't auto-create repos)
      return await createOrUpdateReadme(username, username, content, sha, 'docs: update profile README via EasyGit');
    } catch (e) {
      if (e.message.includes('404')) {
        throw new Error(`Profile README repo "${username}/${username}" does not exist. Please create a public repo named "${username}" on GitHub first.`);
      }
      throw e;
    }
  }

  // ── Topics of a repo ──
  async function getRepoTopics(owner, repo) {
    try {
      const data = await request(`/repos/${owner}/${repo}/topics`);
      return data.names || [];
    } catch {
      return [];
    }
  }

  // ── Pinned repos via GraphQL ──
  async function getPinnedRepos(username) {  // MARKER_PINNED
    const token = Store.getGitHubToken();
    if (!token) return [];
    try {
      const query = `{
        user(login: "${username}") {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository {
                name
                description
                url
                stargazerCount
                forkCount
                primaryLanguage { name }
                repositoryTopics(first: 5) {
                  nodes { topic { name } }
                }
              }
            }
          }
        }
      }`;
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.data?.user?.pinnedItems?.nodes || [];
    } catch {
      return [];
    }
  }

  // ── Social accounts ──
  async function getSocialAccounts(username) {
    try {
      const data = await request(`/users/${username}/social_accounts`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // ── Full profile data (user + pinned + social) ──
  async function getFullProfile(username) {
    const cached = Store.cacheGet(`profile_${username}`);
    if (cached) return cached;
    const [user, pinned, social] = await Promise.all([
      getAuthenticatedUser(),
      getPinnedRepos(username),
      getSocialAccounts(username),
    ]);
    const result = { user, pinned, social };
    Store.cacheSet(`profile_${username}`, result);
    return result;
  }

  return {
    getAuthenticatedUser,
    validateToken,
    getPublicRepos,
    getAllPublicRepos,
    getRepo,
    updateRepoDescription,
    updateRepoTopics,
    getReadme,
    createOrUpdateReadme,
    getProfileReadme,
    createOrUpdateProfileReadme,
    getRepoTopics,
    getPinnedRepos,
    getSocialAccounts,
    getFullProfile,
  };
})();

window.GitHub = GitHub;
