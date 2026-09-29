// DS Note - Side Panel

const STORAGE_KEY = 'ds_saved_messages';
const SETTINGS_KEY = 'ds_notes_settings';

// i18n
const i18n = {
  en: {
    title: 'DS Note',
    all: 'All',
    current: 'Current',
    starred: 'Starred',
    select: 'Select',
    cancel: 'Cancel',
    export: 'Export ▼',
    clear: 'Clear',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    copy: 'Copy',
    exportSel: 'Export',
    formatLabel: 'FORMAT',
    exportLabel: 'EXPORT NOTES',
    copyLabel: 'COPY NOTES',
    exportAll: 'All Notes',
    exportCurrent: 'Current Notes',
    exportByConvo: 'By Conversation',
    copyAll: 'All Notes',
    copyCurrent: 'Current Notes',
    emptyText: 'No saved notes yet',
    emptyHint: 'Select text in DeepSeek and click 📌 to save',
    noResults: 'No matching notes',
    notes: 'notes',
    note: 'note',
    user: 'USER',
    assistant: 'AI',
    delete: 'Delete',
    clearConfirm: 'Delete all notes? This cannot be undone.',
    noNotes: 'No notes to export',
    noSelection: 'No notes selected',
    noCurrent: 'No notes in current session',
    copied: 'Copied!',
    langBtn: '中文',
    searchPlaceholder: 'Search notes...',
    justNow: 'now',
    mAgo: 'm',
    hAgo: 'h',
    jumpTo: 'Jump to original',
    selPopupOn: 'Selection popup: on',
    selPopupOff: 'Selection popup: off',
    collapse: 'Collapse',
    expand: 'Expand'
  },
  zh: {
    title: 'DS Note',
    all: '全部',
    current: '当前',
    starred: '星标',
    select: '选择',
    cancel: '取消',
    export: '导出 ▼',
    clear: '清空',
    selectAll: '全选',
    deselectAll: '取消全选',
    copy: '复制',
    exportSel: '导出',
    formatLabel: '格式',
    exportLabel: '导出笔记',
    copyLabel: '复制笔记',
    exportAll: '全部笔记',
    exportCurrent: '当前笔记',
    exportByConvo: '按对话导出',
    copyAll: '全部笔记',
    copyCurrent: '当前笔记',
    emptyText: '暂无笔记',
    emptyHint: '在 DeepSeek 中选中文字，点击 📌 保存',
    noResults: '无匹配笔记',
    notes: '条',
    note: '条',
    user: '用户',
    assistant: 'AI',
    delete: '删除',
    clearConfirm: '删除所有笔记？此操作无法撤销。',
    noNotes: '没有可导出的笔记',
    noSelection: '未选择笔记',
    noCurrent: '当前会话没有笔记',
    copied: '已复制！',
    langBtn: 'EN',
    searchPlaceholder: '搜索笔记...',
    justNow: '刚刚',
    mAgo: '分钟前',
    hAgo: '小时前',
    jumpTo: '跳转到原文',
    selPopupOn: '选中弹窗：开',
    selPopupOff: '选中弹窗：关',
    collapse: '收起',
    expand: '展开'
  }
};

let lang = 'en';
let theme = 'dark'; // 'dark' or 'light'
let view = 'current';
let tabUrl = '';
let tabTitle = '';
let messages = [];
let selectMode = false;
let selected = new Set();
let collapsedConvos = new Set();
let searchQuery = '';
let exportFormat = 'md'; // 'md' or 'jsonl'
let selectionPopup = true; // show save/markdown bar on text selection

const $ = id => document.getElementById(id);

function t(key) {
  return i18n[lang][key] || key;
}

function updateAllText() {
  $('title').textContent = t('title');
  $('viewAllBtn').textContent = t('all');
  $('viewCurrentBtn').textContent = t('current');
  $('viewStarredBtn').title = t('starred');
  $('selectBtn').textContent = selectMode ? t('cancel') : t('select');
  $('exportBtn').textContent = t('export');
  $('clearBtn').textContent = t('clear');
  $('selectAllBtn').textContent = t('selectAll');
  $('copySelectedBtn').textContent = t('copy');
  $('exportSelectedBtn').textContent = t('exportSel');
  $('menuFormatLabel').textContent = t('formatLabel');
  $('menuExportLabel').textContent = t('exportLabel');
  $('menuCopyLabel').textContent = t('copyLabel');
  $('exportAll').textContent = t('exportAll');
  $('exportCurrent').textContent = t('exportCurrent');
  $('exportByConvo').textContent = t('exportByConvo');
  $('copyAll').textContent = t('copyAll');
  $('copyCurrent').textContent = t('copyCurrent');
  $('searchInput').placeholder = t('searchPlaceholder');
  $('langBtn').textContent = t('langBtn');
  applySelPopup();
}

function applySelPopup() {
  const btn = $('selPopupBtn');
  btn.classList.toggle('off', !selectionPopup);
  btn.title = selectionPopup ? t('selPopupOn') : t('selPopupOff');
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return t('justNow');
  if (diff < 3600000) return Math.floor(diff / 60000) + t('mAgo');
  if (diff < 86400000) return Math.floor(diff / 3600000) + t('hAgo');
  return new Date(ts).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric'
  });
}

function convoId(url) {
  try { return new URL(url).pathname.split('/').pop() || 'unknown'; }
  catch { return 'unknown'; }
}

function shortId(url) {
  const id = convoId(url);
  return id.length > 12 ? id.slice(0, 12) + '…' : id;
}

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function highlight(text, query) {
  if (!query) return esc(text);
  const escaped = esc(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function groupByConvo(msgs) {
  const g = {};
  msgs.forEach(m => {
    const id = convoId(m.conversationUrl);
    if (!g[id]) g[id] = { url: m.conversationUrl, notes: [] };
    g[id].notes.push(m);
  });
  return g;
}

// Star functionality
async function toggleStar(id) {
  const msg = messages.find(m => m.id === id);
  if (!msg) return;
  msg.starred = !msg.starred;
  await chrome.storage.local.set({ [STORAGE_KEY]: messages });
  render();
}

// Jump to original
async function jumpToOriginal(note) {
  const tabs = await chrome.tabs.query({ url: 'https://chat.deepseek.com/*' });
  const noteConvoId = convoId(note.conversationUrl);
  let targetTab = tabs.find(t => convoId(t.url) === noteConvoId);

  if (targetTab) {
    await chrome.tabs.update(targetTab.id, { active: true });
    await chrome.windows.update(targetTab.windowId, { focused: true });
    try {
      await chrome.tabs.sendMessage(targetTab.id, {
        action: 'scrollToMessage',
        scrollRatio: note.scrollRatio ?? -1,
        contentPreview: note.searchText || note.content.slice(0, 100),
        selectionText: note.selectionText || null
      });
    } catch (e) {}
  } else if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true, url: note.conversationUrl });
    await chrome.windows.update(tab.windowId, { focused: true });
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'scrollToMessage',
          scrollRatio: note.scrollRatio ?? -1,
          contentPreview: note.searchText || note.content.slice(0, 100),
          userMessageText: note.userMessageText || null,
          selectionText: note.selectionText || null
        });
      } catch (e) {}
    }, 2000);
  } else {
    chrome.tabs.create({ url: note.conversationUrl });
  }
}

function createCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card' + (selected.has(note.id) ? ' selected' : '') + (note.starred ? ' starred' : '');
  card.dataset.id = note.id;

  const cb = selectMode ? `<input type="checkbox" class="note-checkbox" ${selected.has(note.id) ? 'checked' : ''}>` : '';
  const starClass = note.starred ? 'star-btn active' : 'star-btn';

  card.innerHTML = `
    <div class="note-header">
      ${cb}
      <button class="${starClass}" title="Star">⭐</button>
      <span class="note-role ${note.role}">${t(note.role)}</span>
      <span class="note-time">${formatTime(note.savedAt)}</span>
    </div>
    <div class="note-content">${highlight(note.content, searchQuery)}</div>
    <div class="note-actions">
      <button class="jump-btn" title="${t('jumpTo')}">↗</button>
      <button class="delete-btn">${t('delete')}</button>
    </div>
  `;

  card.querySelector('.star-btn').onclick = e => {
    e.stopPropagation();
    toggleStar(note.id);
  };

  card.querySelector('.jump-btn').onclick = e => {
    e.stopPropagation();
    jumpToOriginal(note);
  };

  card.querySelector('.delete-btn').onclick = e => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'deleteMessage', id: note.id }, loadNotes);
  };

  if (selectMode) {
    card.onclick = () => toggleSel(note.id);
  }

  return card;
}

function toggleSel(id) {
  selected.has(id) ? selected.delete(id) : selected.add(id);
  render();
}

function render() {
  const list = $('notesList');
  list.innerHTML = '';

  // Apply filters
  let filtered = [...messages];

  // Sort: starred first
  filtered.sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    return b.savedAt - a.savedAt;
  });

  // View filter
  if (view === 'current' && tabUrl) {
    const cid = convoId(tabUrl);
    filtered = filtered.filter(m => convoId(m.conversationUrl) === cid);
  } else if (view === 'starred') {
    filtered = filtered.filter(m => m.starred);
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m => m.content.toLowerCase().includes(q));
  }

  // Update UI
  const selBar = $('selectionActions');
  selBar.className = 'selection-bar' + (selectMode ? ' active' : '');
  $('selCount').textContent = `(${selected.size})`;
  $('clearSearch').style.display = searchQuery ? 'block' : 'none';
  $('selectAllBtn').textContent =
    filtered.length > 0 && filtered.every(m => selected.has(m.id)) ? t('deselectAll') : t('selectAll');

  if (!filtered.length) {
    const emptyMsg = searchQuery ? t('noResults') : t('emptyText');
    const emptyHint = searchQuery ? '' : t('emptyHint');
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${searchQuery ? '🔍' : '📝'}</div>
        <p>${emptyMsg}</p>
        ${emptyHint ? `<p class="hint">${emptyHint}</p>` : ''}
      </div>
    `;
    $('noteCount').textContent = '0 ' + t('notes');
    return;
  }

  // Group by conversation (unless starred view)
  if (view === 'starred') {
    filtered.forEach(n => list.appendChild(createCard(n)));
  } else {
    const groups = groupByConvo(filtered);
    Object.entries(groups).forEach(([cid, g]) => {
      const isCollapsed = collapsedConvos.has(cid);
      const grp = document.createElement('div');
      grp.className = 'convo-group' + (isCollapsed ? ' collapsed' : '');

      const name = convoDisplayName(g.notes, cid);
      const hdr = document.createElement('div');
      hdr.className = 'convo-header';
      hdr.innerHTML = `
        <div class="convo-label" title="${esc(g.url)}">
          <button class="convo-toggle" title="${t(isCollapsed ? 'expand' : 'collapse')}" aria-expanded="${!isCollapsed}">${isCollapsed ? '▸' : '▾'}</button>
          ${name ? `<span class="convo-title" title="${esc(name)}">${esc(name)}</span>` : ''}
          <span class="convo-id">${shortId(g.url)}</span>
        </div>
        <div class="convo-actions">
          <span class="count">${g.notes.length}</span>
          <button class="convo-btn" title="Copy">📋</button>
          <button class="convo-btn" title="Export">💾</button>
        </div>
      `;

      const toggle = hdr.querySelector('.convo-toggle');
      const label = hdr.querySelector('.convo-label');
      label.onclick = () => {
        let nowCollapsed;
        if (collapsedConvos.has(cid)) {
          collapsedConvos.delete(cid);
          nowCollapsed = false;
        } else {
          collapsedConvos.add(cid);
          nowCollapsed = true;
        }
        grp.classList.toggle('collapsed', nowCollapsed);
        toggle.textContent = nowCollapsed ? '▸' : '▾';
        toggle.setAttribute('aria-expanded', String(!nowCollapsed));
        toggle.title = t(nowCollapsed ? 'expand' : 'collapse');
      };

      const btns = hdr.querySelectorAll('.convo-btn');
      btns[0].onclick = () => copyText(toPlain(g.notes));
      btns[1].onclick = () => download(toMd(g.notes, convoDisplayName(g.notes, cid) || cid), `${convoFileBase(g.notes, cid)}.md`);

      grp.appendChild(hdr);
      g.notes.forEach(n => grp.appendChild(createCard(n)));
      list.appendChild(grp);
    });
  }

  $('noteCount').textContent = filtered.length + ' ' + (filtered.length === 1 ? t('note') : t('notes'));
}

async function loadNotes() {
  const r = await chrome.storage.local.get([STORAGE_KEY]);
  messages = r[STORAGE_KEY] || [];
  render();
}

async function loadSettings() {
  const r = await chrome.storage.local.get([SETTINGS_KEY]);
  lang = r[SETTINGS_KEY]?.lang || 'en';
  theme = r[SETTINGS_KEY]?.theme || 'dark';
  selectionPopup = r[SETTINGS_KEY]?.selectionPopup ?? true;
  applyTheme();
  updateAllText();
}

function saveSettings() {
  chrome.storage.local.set({ [SETTINGS_KEY]: { lang, theme, selectionPopup } });
}

function toggleSelPopup() {
  selectionPopup = !selectionPopup;
  saveSettings();
  applySelPopup();
}

function saveLang(l) {
  lang = l;
  saveSettings();
  updateAllText();
  render();
}

function applyTheme() {
  document.body.classList.toggle('light', theme === 'light');
  $('themeBtn').textContent = theme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveSettings();
}

async function refreshTabUrl() {
  let nextUrl = '';
  let nextTitle = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('chat.deepseek.com')) {
      nextUrl = tab.url;
      nextTitle = tab.title || '';
    }
  } catch {}
  if (nextUrl === tabUrl && nextTitle === tabTitle) return;
  tabUrl = nextUrl;
  tabTitle = nextTitle;
  $('currentUrl').textContent = tabUrl ? shortId(tabUrl) : '';
  $('currentUrl').title = tabUrl;
  render();
}

// Keep the "Current" view in sync when the conversation or active tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') refreshTabUrl();
});
chrome.tabs.onActivated.addListener(() => refreshTabUrl());

function toPlain(msgs) {
  return msgs.map(m => `[${t(m.role)}]\n${m.content}`).join('\n\n---\n\n');
}

function toMd(msgs, title) {
  let md = `# ${title || t('title')}\n\n`;
  msgs.forEach((m, i) => {
    const star = m.starred ? ' ⭐' : '';
    md += `### ${i + 1}. ${t(m.role)}${star}\n\n${m.content}\n\n---\n\n`;
  });
  return md;
}

function toJsonl(msgs, title) {
  return msgs.map((m, i) => JSON.stringify({
    index: i,
    role: m.role,
    content: m.content,
    starred: m.starred || false,
    conversationUrl: m.conversationUrl,
    savedAt: new Date(m.savedAt).toISOString(),
    source: title || 'DS Note'
  })).join('\n');
}

function download(content, name, mimeType = 'text/markdown') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
  a.download = name;
  a.click();
}

// Filename helpers — keep names unique and readable across all export paths
function slugify(s) {
  return (s || '')
    .replace(/[\x00-\x1f\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .replace(/[.\s]+$/, '');
}

function stamp(withTime) {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  return withTime ? `${day}-${p(d.getHours())}${p(d.getMinutes())}` : day;
}

// Strip DeepSeek's tab-title suffix and treat the bare product name as "no title"
function cleanTitle(s) {
  const t = (s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[|\-–—]\s*DeepSeek\s*$/i, '')
    .trim();
  return t && !/^deepseek$/i.test(t) ? t : null;
}

// Display name for a conversation: stored title, else the live tab title when
// this is the conversation currently open, else null (callers fall back to the id)
function convoDisplayName(notes, cid) {
  const stored = cleanTitle(notes.find(n => n.conversationTitle)?.conversationTitle);
  if (stored) return stored;
  if (tabUrl && cid !== 'unknown' && convoId(tabUrl) === cid) return cleanTitle(tabTitle);
  return null;
}

// Base filename (no extension) for a conversation's notes
function convoFileBase(notes, cid) {
  return `${slugify(convoDisplayName(notes, cid)) || cid.slice(0, 8)}-${stamp(false)}`;
}

function exportNotes(msgs, title, baseName) {
  if (exportFormat === 'jsonl') {
    download(toJsonl(msgs, title), `${baseName}.jsonl`, 'application/jsonl');
  } else {
    download(toMd(msgs, title), `${baseName}.md`, 'text/markdown');
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text);
  toast(t('copied'));
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function getFiltered() {
  if (view === 'current' && tabUrl) {
    const cid = convoId(tabUrl);
    return messages.filter(m => convoId(m.conversationUrl) === cid);
  }
  return messages;
}

function setView(v) {
  view = v;
  $('viewAllBtn').classList.toggle('active', v === 'all');
  $('viewCurrentBtn').classList.toggle('active', v === 'current');
  $('viewStarredBtn').classList.toggle('active', v === 'starred');
  render();
}

// Event handlers
$('themeBtn').onclick = toggleTheme;
$('selPopupBtn').onclick = toggleSelPopup;
$('langBtn').onclick = () => saveLang(lang === 'en' ? 'zh' : 'en');
$('viewAllBtn').onclick = () => setView('all');
$('viewCurrentBtn').onclick = () => setView('current');
$('viewStarredBtn').onclick = () => setView('starred');

$('searchInput').oninput = e => {
  searchQuery = e.target.value.trim();
  render();
};

$('clearSearch').onclick = () => {
  $('searchInput').value = '';
  searchQuery = '';
  render();
};

$('selectBtn').onclick = () => {
  selectMode = !selectMode;
  if (!selectMode) selected.clear();
  $('selectBtn').textContent = selectMode ? t('cancel') : t('select');
  render();
};

$('selectAllBtn').onclick = () => {
  const filtered = getFiltered();
  const allSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id));
  filtered.forEach(m => (allSelected ? selected.delete(m.id) : selected.add(m.id)));
  render();
};

$('copySelectedBtn').onclick = () => {
  if (!selected.size) return alert(t('noSelection'));
  copyText(toPlain(messages.filter(m => selected.has(m.id))));
};

$('exportSelectedBtn').onclick = () => {
  if (!selected.size) return alert(t('noSelection'));
  exportNotes(messages.filter(m => selected.has(m.id)), 'Selected', `ds-note-selected-${stamp(true)}`);
};

$('exportBtn').onclick = () => $('exportMenu').classList.toggle('hidden');

// Format toggle handlers
$('formatMd').onclick = () => {
  exportFormat = 'md';
  $('formatMd').classList.add('active');
  $('formatJsonl').classList.remove('active');
};

$('formatJsonl').onclick = () => {
  exportFormat = 'jsonl';
  $('formatJsonl').classList.add('active');
  $('formatMd').classList.remove('active');
};

$('exportAll').onclick = () => {
  if (!messages.length) return alert(t('noNotes'));
  exportNotes(messages, t('title'), `ds-note-all-${stamp(true)}`);
  $('exportMenu').classList.add('hidden');
};

$('exportCurrent').onclick = () => {
  const f = getFiltered();
  if (!f.length) return alert(t('noCurrent'));
  exportNotes(f, convoDisplayName(f, convoId(tabUrl)) || convoId(tabUrl), convoFileBase(f, convoId(tabUrl)));
  $('exportMenu').classList.add('hidden');
};

$('exportByConvo').onclick = () => {
  if (!messages.length) return alert(t('noNotes'));
  Object.entries(groupByConvo(messages)).forEach(([cid, g]) => {
    exportNotes(g.notes, convoDisplayName(g.notes, cid) || cid, convoFileBase(g.notes, cid));
  });
  $('exportMenu').classList.add('hidden');
};

$('copyAll').onclick = () => {
  if (!messages.length) return alert(t('noNotes'));
  copyText(toPlain(messages));
  $('exportMenu').classList.add('hidden');
};

$('copyCurrent').onclick = () => {
  const f = getFiltered();
  if (!f.length) return alert(t('noCurrent'));
  copyText(toPlain(f));
  $('exportMenu').classList.add('hidden');
};

$('clearBtn').onclick = () => {
  if (!confirm(t('clearConfirm'))) return;
  chrome.runtime.sendMessage({ action: 'clearAll' }, loadNotes);
};

document.onclick = e => {
  if (!$('exportBtn').contains(e.target) && !$('exportMenu').contains(e.target)) {
    $('exportMenu').classList.add('hidden');
  }
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    messages = changes[STORAGE_KEY].newValue || [];
    render();
  }
});

// Init
(async () => {
  await loadSettings();
  await refreshTabUrl();
  await loadNotes();
})();
