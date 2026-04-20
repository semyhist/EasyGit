/**
 * EasyGit — AI Prompt Templates
 * Structured prompts for topic generation, description, README, and profile README.
 * Supports: tone (formal/casual/technical/beginner) + custom user instructions.
 */

const Prompts = (() => {

  const SYSTEM = `You are EasyGit, a GitHub profile and repository documentation assistant.
Your task is to generate clean, professional content for GitHub repositories and profiles.
Always respond ONLY with the requested content. No explanations, no markdown code fences like \`\`\`json, no preamble, no commentary.`;

  const PROFILE_SYSTEM = `You are an expert GitHub profile README designer. You write stunning, real-world GitHub profile READMEs that look like they were crafted by a senior developer.

You know exactly how to use:
- shields.io badges: https://img.shields.io/badge/LABEL-MESSAGE-COLOR?style=for-the-badge&logo=LOGO&logoColor=white
- github-readme-stats: https://github-readme-stats.vercel.app/api?username=USER&show_icons=true&theme=THEME&hide_border=true&count_private=true
- github-readme-streak-stats: https://streak-stats.demolab.com/?user=USER&theme=THEME&hide_border=true
- top-langs card: https://github-readme-stats.vercel.app/api/top-langs/?username=USER&layout=compact&theme=THEME&hide_border=true&langs_count=8
- github-profile-trophy: https://github-profile-trophy.vercel.app/?username=USER&theme=THEME&no-frame=true&row=1&column=6
- readme-typing-svg: https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=COLOR&center=true&vCenter=true&width=500&lines=LINE1;LINE2;LINE3
- github-readme-activity-graph: https://github-readme-activity-graph.vercel.app/graph?username=USER&theme=THEME&hide_border=true
- visitor-badge: https://komarev.com/ghpvc/?username=USER&label=Profile%20views&color=COLOR&style=flat
- skill-icons: https://skillicons.dev/icons?i=ICON1,ICON2,ICON3

Badge logo names for shields.io (use lowercase): javascript, typescript, python, react, nodejs, express, nextdotjs, vuedotjs, angular, svelte, tailwindcss, bootstrap, html5, css3, sass, java, kotlin, swift, go, rust, cplusplus, csharp, php, ruby, flutter, dart, docker, kubernetes, git, github, gitlab, linux, ubuntu, windows, macos, vscode, vim, figma, postgresql, mysql, mongodb, redis, firebase, supabase, aws, googlecloud, azure, vercel, netlify, heroku, nginx, graphql, prisma, jest, vitest, webpack, vite, electron

Always respond ONLY with the Markdown/HTML content. No explanations, no code fences, no preamble.`;

  // ─── Build the extra instructions block ─────────────────────────────────────
  function extraBlock(opts = {}) {
    const { tone, customInstructions } = opts;
    const lines = [];

    if (tone && tone !== 'default') {
      const toneMap = {
        formal:   'Tone: Formal and professional. Use precise language.',
        casual:   'Tone: Casual and approachable. Conversational but still professional.',
        technical:'Tone: Highly technical. Use precise terminology, assume developer audience.',
        beginner: 'Tone: Beginner-friendly. Avoid jargon, explain concepts simply.',
      };
      if (toneMap[tone]) lines.push(toneMap[tone]);
    }

    if (customInstructions && customInstructions.trim()) {
      lines.push(`Additional user instructions: ${customInstructions.trim()}`);
    }

    if (opts.readmeContent) {
      lines.push(`\nProject Content/Context (from existing README):\n---\n${opts.readmeContent.slice(0, 1500)}\n---`);
    }

    return lines.length ? '\n\n' + lines.join('\n') : '';
  }

  // ── Serialize repo data for prompts ──
  function repoContext(repo) {
    return `Repository Name: ${repo.name}
Description: ${repo.description || '(none)'}
Language: ${repo.language || '(unknown)'}
Topics: ${(repo.topics || []).join(', ') || '(none)'}
Stars: ${repo.stargazers_count}
Forks: ${repo.forks_count}
Created: ${new Date(repo.created_at).toLocaleDateString()}
Updated: ${new Date(repo.updated_at).toLocaleDateString()}
Homepage: ${repo.homepage || '(none)'}
Is Fork: ${repo.fork ? 'yes' : 'no'}`.trim();
  }

  // ── Profile context ──
  function userContext(user, repos, pinned = [], social = []) {
    const langs = [...new Set(repos.map(r => r.language).filter(Boolean))];
    const topRepos = [...repos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 8)
      .map(r => `  - ${r.name} (${r.language || 'n/a'}, ⭐${r.stargazers_count}, 🍴${r.forks_count}): ${r.description || 'no description'}`)
      .join('\n');

    const pinnedSection = pinned.length
      ? `\nPinned Repositories (user's highlighted work):\n` + pinned.map(p =>
          `  - ${p.name} (${p.primaryLanguage?.name || 'n/a'}, ⭐${p.stargazerCount}): ${p.description || 'no description'}`
        ).join('\n')
      : '';

    const socialSection = social.length
      ? `\nSocial Accounts:\n` + social.map(s => `  - ${s.provider}: ${s.url}`).join('\n')
      : '';

    const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const totalForks = repos.reduce((sum, r) => sum + r.forks_count, 0);
    const recentActivity = [...repos]
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 3)
      .map(r => `  - ${r.name} (updated ${new Date(r.updated_at).toLocaleDateString()})`)
      .join('\n');

    return `GitHub Username: ${user.login}
Name: ${user.name || user.login}
Bio: ${user.bio || '(none)'}
Location: ${user.location || '(unknown)'}
Company: ${user.company || '(none)'}
Website/Blog: ${user.blog || '(none)'}
Email: ${user.email || '(not public)'}
Twitter: ${user.twitter_username ? '@' + user.twitter_username : '(none)'}
Public Repos: ${user.public_repos}
Followers: ${user.followers} | Following: ${user.following}
Total Stars Earned: ${totalStars}
Total Forks: ${totalForks}
Account Created: ${new Date(user.created_at).toLocaleDateString()}
Main Languages: ${langs.slice(0, 10).join(', ')}

Top Repositories by Stars:
${topRepos}${pinnedSection}${socialSection}

Recently Active Repos:
${recentActivity}`.trim();
  }

  // ═══════════════════════════════════════
  //  1. TOPICS
  // ═══════════════════════════════════════
  function topics(repo, opts = {}) {
    const hasContent = opts.readmeContent && opts.readmeContent.trim().length > 50;
    return {
      system: SYSTEM,
      user: `Generate 5-8 relevant GitHub topics for the following repository.

${repoContext(repo)}${extraBlock(opts)}

${hasContent ? `IMPORTANT: Base your topics primarily on the actual project content above (README), not just the programming language. Identify the real purpose, domain, and features of this specific project.` : `IMPORTANT: Infer the project's actual purpose and domain from the repository name and description — go beyond just the language.`}

Rules:
- Return ONLY a JSON array of strings, e.g: ["topic1", "topic2", "topic3"]
- Topics must be lowercase, use hyphens (not spaces), max 35 chars each
- PRIORITIZE domain/purpose tags (e.g., "task-manager", "expense-tracker", "portfolio") over generic language tags
- Include at most 1-2 language/runtime tags (e.g., "nodejs", "python")
- Include framework tags only if clearly used (e.g., "react", "fastapi")
- Add feature/domain tags that describe WHAT the project does (e.g., "authentication", "real-time", "dashboard")
- Do NOT include the repo name as a topic
- Do NOT add generic tags like "open-source", "github", "programming"

Return only the JSON array, nothing else.`,
    };
  }

  // ═══════════════════════════════════════
  //  2. DESCRIPTION
  // ═══════════════════════════════════════
  function description(repo, opts = {}) {
    const hasContent = opts.readmeContent && opts.readmeContent.trim().length > 50;
    return {
      system: SYSTEM,
      user: `Write a concise GitHub repository description for the following repository.

${repoContext(repo)}${extraBlock(opts)}

${hasContent ? `IMPORTANT: The description must reflect the actual project content from the README above. Describe what this specific project DOES and WHO it is for — not just what language it uses.` : `IMPORTANT: Infer the real purpose of this project from its name and existing description. Describe what it does concretely.`}

Rules:
- Maximum 120 characters
- Write in English
- Focus on the PROJECT'S PURPOSE and VALUE, not the technology stack
- Start with a verb or noun phrase describing the core function (e.g., "Track your daily expenses...", "CLI tool that converts...", "Dashboard for monitoring...")
- Mention the key technology only if it adds meaningful context
- Do NOT use emojis
- Do NOT start with "This is a..." or "A repository for..."
- Do NOT write generic descriptions like "A Python project" or "A web application"
- Return ONLY the description text, nothing else.`,
    };
  }

  // ═══════════════════════════════════════
  //  3. REPO README (ENHANCED)
  // ═══════════════════════════════════════
  function readme(repo, existingReadme = null, opts = {}) {
    const existingSection = existingReadme
      ? `\nExisting README (use as context and improve it — keep any useful specific details):\n---\n${existingReadme.slice(0, 2000)}\n---`
      : '';

    const owner = repo.owner?.login || 'username';
    const lang = repo.language || 'Unknown';
    const hasTopics = repo.topics && repo.topics.length > 0;
    const isWebProject = ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'Vue', 'Svelte'].includes(lang);
    const isPythonProject = lang === 'Python';
    const isJavaProject = ['Java', 'Kotlin'].includes(lang);
    const isCLI = (repo.description || '').toLowerCase().match(/cli|command.?line|terminal/) || (repo.name || '').toLowerCase().match(/cli/);
    const isLibrary = (repo.description || '').toLowerCase().match(/library|sdk|framework|package|module/);
    const hasHomepage = !!repo.homepage;

    return {
      system: SYSTEM,
      user: `Create a **professional, visually stunning** README.md for the following GitHub repository.

${repoContext(repo)}${existingSection}${extraBlock(opts)}

The README must be comprehensive, well-structured, and make the project look polished and professional.

=== REQUIRED STRUCTURE ===

1. **Hero Section**
   - Project name with a relevant emoji as H1 heading
   - 1-2 sentence tagline that explains what the project does and why it matters
   - Badge row using shields.io:
     - ![GitHub Stars](https://img.shields.io/github/stars/${owner}/${repo.name}?style=for-the-badge&logo=github&logoColor=white&color=0891b2)
     - ![License](https://img.shields.io/github/license/${owner}/${repo.name}?style=for-the-badge&color=6366f1)
     - ![Language](https://img.shields.io/badge/${encodeURIComponent(lang)}-${isWebProject ? '3178c6' : isPythonProject ? '3572a5' : '0891b2'}?style=for-the-badge&logo=${lang.toLowerCase().replace(/[^a-z]/g,'')}&logoColor=white)
     ${hasHomepage ? `- ![Website](https://img.shields.io/badge/Website-Visit-0891b2?style=for-the-badge&logo=googlechrome&logoColor=white)` : ''}
   ${hasHomepage ? `- Link to live demo/website: ${repo.homepage}` : ''}

2. **Table of Contents** (use markdown links)
   - Only include sections that you actually generate
   - Format: - [Section Name](#section-name)

3. **About / Overview**
   - 2-3 paragraphs explaining the project in detail
   - What problem does it solve? Who is the target audience?
   - What makes it different or notable?
   ${isCLI ? '- Emphasize command-line usage and workflow' : ''}
   ${isLibrary ? '- Emphasize API design and integration simplicity' : ''}

4. **Key Features** (use emojis as bullet prefixes)
   - 5-8 concrete features with brief descriptions
   - Format: ✨ **Feature Name** — Brief explanation
   - Be specific to THIS project, not generic features

5. **Tech Stack** (if applicable)
   - Use shields.io badges in a single row for each technology
   - Only include technologies that are evident from the repo data

6. **Getting Started**
   - **Prerequisites**: List what's needed (Node.js version, Python version, etc.)
   - **Installation**: Step-by-step with code blocks
     ${isWebProject ? '```bash\ngit clone https://github.com/' + owner + '/' + repo.name + '.git\ncd ' + repo.name + '\nnpm install\nnpm run dev\n```' : ''}
     ${isPythonProject ? '```bash\ngit clone https://github.com/' + owner + '/' + repo.name + '.git\ncd ' + repo.name + '\npip install -r requirements.txt\npython main.py\n```' : ''}
   - Adapt the installation steps to the actual language: ${lang}

7. **Usage** (with code examples)
   - Show 1-2 practical usage examples with code blocks
   - Use the correct language tag for syntax highlighting
   ${isCLI ? '- Show CLI command examples with expected output' : ''}
   ${isLibrary ? '- Show import/usage API examples' : ''}

8. **Project Structure** (brief overview)
   - Show a simplified directory tree of key files/folders
   - Use code block with no language tag

9. **Contributing**
   - Brief contributing guidelines (4-5 steps)
   - Link to issues page: https://github.com/${owner}/${repo.name}/issues

10. **License**
    - Reference the license type if known
    - Link: [LICENSE](LICENSE)

=== FORMATTING RULES ===
- Use proper Markdown with code blocks, language-specific syntax highlighting
- Use HTML <div align="center"> for centering badges and hero section
- Add horizontal rules (---) between major sections for visual separation
- Use blockquotes (>) for important notes or tips
- Keep the total length between 150-300 lines
- For the repo owner use: ${owner}
- Do NOT wrap the output in \`\`\`markdown code fences
- Return ONLY the raw Markdown content`,
    };
  }

  // ═══════════════════════════════════════
  //  4. PROFILE README
  // ═══════════════════════════════════════
  const PROFILE_TEMPLATES = {
    classic: {
      name: '🏠 Classic',
      desc: 'Centered header, stats row, tech badges, featured repos',
      theme: 'tokyonight',
      accentColor: '58a6ff',
    },
    radical: {
      name: '🌈 Radical',
      desc: 'Gradient vibes, radical theme, animated typing header',
      theme: 'radical',
      accentColor: 'fe428e',
    },
    dark: {
      name: '🌑 Dark Pro',
      desc: 'Dark theme, skill icons, clean grid layout',
      theme: 'github_dark',
      accentColor: '79c0ff',
    },
    minimal: {
      name: '⚪ Minimal',
      desc: 'No widgets, pure markdown, elegant simplicity',
      theme: null,
      accentColor: null,
    },
    hacker: {
      name: '💻 Hacker',
      desc: 'Terminal intro, code blocks, matrix aesthetic',
      theme: 'merko',
      accentColor: '00ff41',
    },
    creative: {
      name: '🎨 Creative',
      desc: 'Typing SVG, snake graph, trophies, full personality',
      theme: 'dracula',
      accentColor: 'bd93f9',
    },
  };

  function profileReadme(user, repos, existingReadme = null, opts = {}, pinned = [], social = []) {
    const templateId = opts.template || 'classic';
    const template   = PROFILE_TEMPLATES[templateId] || PROFILE_TEMPLATES.classic;
    const theme      = template.theme || 'tokyonight';
    const accent     = template.accentColor || '58a6ff';
    const u          = user.login;

    const sections      = opts.sections || ['greeting', 'bio', 'stats', 'tech', 'projects', 'contact'];
    const showStreak    = opts.showStreak !== false;
    const showTopLangs  = opts.showTopLangs !== false;
    const showTrophies  = opts.showTrophies === true;
    const customBio     = opts.customBio || '';

    // ── Derive real data ──
    const langs = [...new Set(repos.map(r => r.language).filter(Boolean))];
    const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
    const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);

    // Map language names to skill-icons / shields.io logo slugs
    const LANG_SLUG = {
      'JavaScript':'javascript','TypeScript':'typescript','Python':'python','Java':'java',
      'C++':'cpp','C#':'cs','C':'c','Go':'go','Rust':'rust','Ruby':'ruby','PHP':'php',
      'Swift':'swift','Kotlin':'kotlin','Dart':'dart','Scala':'scala','Shell':'bash',
      'HTML':'html','CSS':'css','Vue':'vue','Svelte':'svelte',
    };
    const skillSlugs = langs.slice(0, 12).map(l => LANG_SLUG[l] || l.toLowerCase().replace(/[^a-z0-9]/g,'')).filter(Boolean);

    // ── Pre-built widget URLs with real username ──
    const WIDGETS = {
      stats:    `https://github-readme-stats.vercel.app/api?username=${u}&show_icons=true&theme=${theme}&hide_border=true&count_private=true&include_all_commits=true`,
      streak:   `https://streak-stats.demolab.com/?user=${u}&theme=${theme}&hide_border=true`,
      langs:    `https://github-readme-stats.vercel.app/api/top-langs/?username=${u}&layout=compact&theme=${theme}&hide_border=true&langs_count=8`,
      trophies: `https://github-profile-trophy.vercel.app/?username=${u}&theme=${theme}&no-frame=true&row=1&column=6`,
      activity: `https://github-readme-activity-graph.vercel.app/graph?username=${u}&theme=${theme}&hide_border=true&area=true`,
      visitor:  `https://komarev.com/ghpvc/?username=${u}&label=Profile%20views&color=${accent}&style=flat`,
      skills:   skillSlugs.length ? `https://skillicons.dev/icons?i=${skillSlugs.join(',')}` : null,
      typing:   `https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=${accent}&center=true&vCenter=true&width=500&lines=${encodeURIComponent((user.name || u) + ' 👋')};${encodeURIComponent(langs.slice(0,3).join(' • ') || 'Developer')};${encodeURIComponent(user.bio?.slice(0,50) || 'Building cool things')}`,
    };

    // ── Shields.io tech badges ──
    const techBadges = langs.slice(0, 10).map(l => {
      const slug = LANG_SLUG[l] || l.toLowerCase().replace(/[^a-z0-9]/g,'');
      return `![${l}](https://img.shields.io/badge/${encodeURIComponent(l)}-${accent}?style=for-the-badge&logo=${slug}&logoColor=white)`;
    }).join(' ');

    // ── Pinned / top repos ──
    const featuredRepos = pinned.length
      ? pinned.slice(0, 4).map(p => ({
          name: p.name, url: p.url,
          desc: p.description || '',
          lang: p.primaryLanguage?.name || '',
          stars: p.stargazerCount,
        }))
      : [...repos].sort((a,b) => b.stargazers_count - a.stargazers_count).slice(0,4).map(r => ({
          name: r.name, url: r.html_url,
          desc: r.description || '',
          lang: r.language || '',
          stars: r.stargazers_count,
        }));

    // ── Social links ──
    const allLinks = [
      user.blog         ? `[🌐 Website](${user.blog.startsWith('http') ? user.blog : 'https://' + user.blog})` : null,
      user.twitter_username ? `[🐦 Twitter](https://twitter.com/${user.twitter_username})` : null,
      ...social.map(s => {
        const icons = { linkedin:'💼', twitter:'🐦', youtube:'📺', twitch:'🎮', instagram:'📸', facebook:'📘', npm:'📦' };
        const icon = icons[s.provider.toLowerCase()] || '🔗';
        return `[${icon} ${s.provider}](${s.url})`;
      }),
      `[🐙 GitHub](https://github.com/${u})`,
    ].filter(Boolean);

    const existingSection = existingReadme
      ? `\nExisting README (reference only, create something better):\n---\n${existingReadme.slice(0, 600)}\n---`
      : '';

    const customBioLine = customBio ? `\nDeveloper says: "${customBio}"` : '';

    // ── Section-specific instructions with real pre-built content ──
    const sectionDefs = {
      greeting: `
## GREETING SECTION
${ templateId === 'hacker'
  ? `Use a code block terminal intro like:
\`\`\`bash
$ whoami
${user.name || u}
$ cat about.txt
${user.bio || 'Developer'} | ${user.location || 'Earth'}
$ ls skills/
${langs.slice(0,6).join('  ')}
\`\`\``
  : templateId === 'creative' || templateId === 'radical'
  ? `Use the animated typing SVG as the main header (centered):
<div align="center">
  <img src="${WIDGETS.typing}" alt="Typing SVG" />
</div>`
  : `Use a centered greeting with the visitor badge:
<div align="center">
  <img src="${WIDGETS.visitor}" />
  <h1>Hi there, I'm ${user.name || u}! 👋</h1>
</div>`
}`,

      bio: `
## BIO SECTION
Write 2-3 sentences about this developer based on their ACTUAL data:
- Name: ${user.name || u}
- Location: ${user.location || 'unknown'}
- Company: ${user.company || 'independent'}
- Bio: ${user.bio || '(none — infer from repos)'}
- Main languages: ${langs.slice(0,5).join(', ')}
- Total stars earned: ${totalStars} across ${repos.length} repos
- Account since: ${new Date(user.created_at).getFullYear()}
${customBioLine}
Make it specific and personal. No generic filler.`,

      stats: `
## STATS SECTION
Include these widgets (use HTML table for side-by-side layout):
<p align="center">
  <img src="${WIDGETS.stats}" height="180" />
  ${ showStreak ? `<img src="${WIDGETS.streak}" height="180" />` : '' }
</p>
${ showTopLangs ? `<p align="center"><img src="${WIDGETS.langs}" height="160" /></p>` : '' }
${ showTrophies ? `<p align="center"><img src="${WIDGETS.trophies}" /></p>` : '' }
${ templateId === 'creative' ? `<p align="center"><img src="${WIDGETS.activity}" /></p>` : '' }`,

      tech: `
## TECH STACK SECTION
${ WIDGETS.skills
  ? `Use skill-icons for a clean visual grid:
<p align="center">
  <img src="${WIDGETS.skills}&theme=dark" />
</p>
Then add shields.io badges below for additional context:
${techBadges}`
  : `Use shields.io badges:
${techBadges}`
}
Only include technologies that appear in their actual repos. Their languages: ${langs.join(', ')}`,

      projects: `
## FEATURED PROJECTS SECTION
Create a visually appealing projects section. Use this exact repo data:
${featuredRepos.map(r => `- **[${r.name}](${r.url})** — ${r.desc} ${r.lang ? `\`${r.lang}\`` : ''} ${r.stars ? `⭐ ${r.stars}` : ''}`).join('\n')}
Format as a clean list or use a 2-column HTML table with repo cards.`,

      contact: `
## CONTACT SECTION
Create a connect section with these REAL links:
${allLinks.join(' • ')}
${ user.email ? `Email: ${user.email}` : '' }
Format as centered badges or a clean list.`,

      activity: `
## ACTIVITY SECTION
Add the activity graph:
<p align="center">
  <img src="${WIDGETS.activity}" />
</p>
Also mention recently active repos: ${[...repos].sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at)).slice(0,3).map(r=>r.name).join(', ')}`,

      fun: `
## FUN / PERSONAL SECTION
Add something unique and personal — a fun fact, a quote, or a personality touch.
Base it on their actual profile: ${user.bio || ''}, location: ${user.location || ''}, languages: ${langs.slice(0,3).join(', ')}.`,
    };

    const selectedSections = sections
      .filter(s => sectionDefs[s])
      .map(s => sectionDefs[s])
      .join('\n');

    return {
      system: PROFILE_SYSTEM,
      maxTokens: 8192,
      user: `Create a GitHub profile README for this developer. Template: ${template.name} — ${template.desc}

=== DEVELOPER DATA ===
${userContext(user, repos, pinned, social)}${existingSection}

=== TEMPLATE INSTRUCTIONS ===
Theme to use for all widgets: ${theme}
Accent color: #${accent}

=== SECTIONS TO GENERATE ===
${selectedSections}

=== ABSOLUTE RULES ===
1. NEVER use placeholder text like "your-username", "Your Name", "your-repo" — use REAL data above
2. The GitHub username is: ${u} — hardcode it in every single URL
3. Every widget URL must be complete and working with the real username
4. Use <div align="center"> or <p align="center"> for centering elements
5. Separate sections with <br> or --- dividers for visual breathing room
6. Return ONLY the final Markdown/HTML. No explanations, no code fences wrapping the whole thing.`,
    };
  }

  // ═══════════════════════════════════════
  //  5. BULK TOPICS
  // ═══════════════════════════════════════
  function bulkTopics(repos, opts = {}) {
    const repoList = repos
      .map((r, i) => `${i + 1}. ${repoContext(r)}\n---`)
      .join('\n');

    return {
      system: SYSTEM,
      user: `Generate relevant GitHub topics for each of the following repositories.

${repoList}${extraBlock(opts)}

Return a JSON object where keys are repo names and values are arrays of 5-8 topics.
Example:
{
  "repo-name-1": ["topic1", "topic2", "topic3"],
  "repo-name-2": ["topicA", "topicB"]
}

Rules:
- Topics must be lowercase with hyphens
- 5-8 topics per repo
- Return ONLY the JSON object, nothing else.`,
    };
  }

  // ═══════════════════════════════════════
  //  6. BULK DESCRIPTIONS
  // ═══════════════════════════════════════
  function bulkDescriptions(repos, opts = {}) {
    const repoList = repos
      .map((r, i) => `${i + 1}. ${repoContext(r)}\n---`)
      .join('\n');

    return {
      system: SYSTEM,
      user: `Write concise GitHub repository descriptions for each of the following repositories.

${repoList}${extraBlock(opts)}

Return a JSON object where keys are repo names and values are description strings.
Example:
{
  "repo-name-1": "A fast CLI tool for generating component boilerplate",
  "repo-name-2": "React hooks library for real-time data fetching"
}

Rules:
- Max 120 characters per description
- No emojis
- Be specific and informative
- Return ONLY the JSON object, nothing else.`,
    };
  }

  return {
    topics,
    description,
    readme,
    profileReadme,
    bulkTopics,
    bulkDescriptions,
    repoContext,
    userContext,
    extraBlock,
    PROFILE_TEMPLATES,
  };
})();

window.Prompts = Prompts;
