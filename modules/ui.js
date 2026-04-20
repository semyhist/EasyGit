/**
 * EasyGit — UI Utilities
 * Toast notifications, markdown renderer, icon helpers, misc DOM utils.
 */

const UI = (() => {

  // ── Toast Notifications ──
  let toastContainer;

  function initToasts() {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  function toast(message, type = 'info', duration = 4000) {
    if (!toastContainer) initToasts();

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-msg">${message}</span>
    `;

    toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);

    return el;
  }

  // ── Simple Markdown Renderer ──
  function renderMarkdown(md) {
    if (!md) return '';

    // Preserve HTML blocks (div, p, img, a, br, table, tr, td, th, span, h1-h6, center, details, summary)
    // by temporarily replacing them with placeholders
    const htmlBlocks = [];
    let preserved = md.replace(/<(div|p|img|a|br|table|tr|td|th|span|h[1-6]|center|details|summary|hr|ul|ol|li|em|strong|b|i|code|pre|blockquote|sup|sub|picture|source|figure|figcaption)\b[^>]*\/?>|<\/(div|p|a|table|tr|td|th|span|h[1-6]|center|details|summary|ul|ol|li|em|strong|b|i|code|pre|blockquote|sup|sub|picture|source|figure|figcaption)>/gi, (match) => {
      const idx = htmlBlocks.length;
      htmlBlocks.push(match);
      return `\x00HTML${idx}\x00`;
    });

    let html = preserved
      // Escape remaining HTML (not our placeholders)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Headings
      .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
      .replace(/^##### (.+)$/gm,  '<h5>$1</h5>')
      .replace(/^#### (.+)$/gm,   '<h4>$1</h4>')
      .replace(/^### (.+)$/gm,    '<h3>$1</h3>')
      .replace(/^## (.+)$/gm,     '<h2>$1</h2>')
      .replace(/^# (.+)$/gm,      '<h1>$1</h1>')
      // Horizontal rule
      .replace(/^---+$/gm, '<hr>')
      // Bold & italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,         '<em>$1</em>')
      .replace(/__(.+?)__/g,         '<strong>$1</strong>')
      .replace(/_(.+?)_/g,           '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      // Blockquote
      .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
      // Strikethrough
      .replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Code blocks
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="lang-${lang}">${code.trimEnd()}</code></pre>`;
    });

    // Unordered lists (process multi-line)
    html = html.replace(/(?:^[-*+] .+$\n?)+/gm, match => {
      const items = match.trim().split('\n').map(line => {
        return `<li>${line.replace(/^[-*+] /, '')}</li>`;
      }).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists
    html = html.replace(/(?:^\d+\. .+$\n?)+/gm, match => {
      const items = match.trim().split('\n').map(line => {
        return `<li>${line.replace(/^\d+\. /, '')}</li>`;
      }).join('');
      return `<ol>${items}</ol>`;
    });

    // Tables (basic)
    html = html.replace(/(?:^\|.+\|$\n?)+/gm, match => {
      const rows = match.trim().split('\n');
      let tableHtml = '<table>';
      rows.forEach((row, i) => {
        if (row.match(/^\|[-:| ]+\|$/)) return; // skip separator
        const cells = row.split('|').filter((_, ci) => ci !== 0 && ci !== row.split('|').length - 1);
        const tag = i === 0 ? 'th' : 'td';
        tableHtml += `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
      });
      tableHtml += '</table>';
      return tableHtml;
    });

    // Paragraphs (double newlines)
    html = html.replace(/\n\n+/g, '</p><p>');
    html = `<p>${html}</p>`;

    // Clean up (paragraphs around block elements)
    html = html
      .replace(/<p>(<h[1-6]>)/g, '$1')
      .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
      .replace(/<p>(<ul>)/g, '$1')
      .replace(/(<\/ul>)<\/p>/g, '$1')
      .replace(/<p>(<ol>)/g, '$1')
      .replace(/(<\/ol>)<\/p>/g, '$1')
      .replace(/<p>(<pre>)/g, '$1')
      .replace(/(<\/pre>)<\/p>/g, '$1')
      .replace(/<p>(<table>)/g, '$1')
      .replace(/(<\/table>)<\/p>/g, '$1')
      .replace(/<p>(<hr>)<\/p>/g, '$1')
      .replace(/<p>(<blockquote>)/g, '$1')
      .replace(/(<\/blockquote>)<\/p>/g, '$1')
      .replace(/<p><\/p>/g, '')
      .replace(/<p>\n/g, '<p>')
      .replace(/\n<\/p>/g, '</p>');

    // Restore preserved HTML blocks
    html = html.replace(/\x00HTML(\d+)\x00/g, (_, idx) => htmlBlocks[parseInt(idx)]);

    return html;
  }

  // ── Language Color Dot ──
  function langDot(language) {
    return `<span class="repo-lang-dot" data-lang="${language || ''}" title="${language || 'Unknown'}"></span>`;
  }

  // ── Relative time ──
  function relativeTime(dateStr) {
    const date = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  }

  // ── Number formatting ──
  function formatNum(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  // ── SVG Icons ──
  const icons = {
    star:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    fork:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2a2 2 0 01-2 2H8a2 2 0 01-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>`,
    eye:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    close:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
    arrow:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
    refresh:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
    tag:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    edit:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    book:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
    sparkles:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L13.91 9.09L20 11L13.91 12.91L12 19L10.09 12.91L4 11L10.09 9.09L12 3Z"/><path d="M5 3L5.74 5.26L8 6L5.74 6.74L5 9L4.26 6.74L2 6L4.26 5.26L5 3Z"/><path d="M19 14L19.74 16.26L22 17L19.74 17.74L19 20L18.26 17.74L16 17L18.26 16.26L19 14Z"/></svg>`,
    settings:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    github: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
    logout:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    user:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    copy:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    search:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    filter:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
    readme:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    bolt:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    plus:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  };

  function icon(name, size) {
    const svg = icons[name] || '';
    if (!size) return svg;
    return svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  }

  // ── Skeleton generators ──
  function skelCard() {
    return `
      <div class="repo-card" style="pointer-events:none">
        <div class="repo-card-header">
          <div class="skeleton" style="width:12px;height:12px;border-radius:50%"></div>
          <div style="flex:1">
            <div class="skeleton" style="width:60%;height:14px;margin-bottom:6px"></div>
            <div class="skeleton" style="width:30%;height:11px"></div>
          </div>
        </div>
        <div class="skeleton" style="width:100%;height:11px;margin-top:4px"></div>
        <div class="skeleton" style="width:75%;height:11px"></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <div class="skeleton" style="width:60px;height:20px;border-radius:999px"></div>
          <div class="skeleton" style="width:70px;height:20px;border-radius:999px"></div>
        </div>
      </div>`;
  }

  // ── Copy to clipboard ──
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard!', 'success', 2000);
    } catch {
      toast('Failed to copy', 'error');
    }
  }

  // ── Show/hide page ──
  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
  }

  // ── Loading overlay helper ──
  function setLoading(btn, loading, originalText) {
    if (loading) {
      btn.disabled = true;
      btn._originalContent = btn.innerHTML;
      btn.innerHTML = `<span class="spinner"></span> ${originalText || 'Loading...'}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn._originalContent || originalText;
    }
  }

  // ── Debounce utility ──
  function debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  return {
    toast,
    initToasts,
    renderMarkdown,
    langDot,
    relativeTime,
    formatNum,
    icon,
    skelCard,
    copyText,
    showPage,
    setLoading,
    debounce,
  };
})();

window.UI = UI;
