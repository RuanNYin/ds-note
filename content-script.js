// DS Note - Content Script
// Shows save button when text is selected

(function() {
  'use strict';

  const SETTINGS_KEY = 'ds_notes_settings';
  const SAVE_BTN_ID = 'ds-notes-selection-btn';
  let lang = 'en';
  let selectionPopup = true; // show save/markdown bar on text selection
  let exportFormat = 'md'; // 'md' | 'jsonl' | 'zip' - used by both export buttons

  // i18n for content script
  const i18n = {
    en: {
      save: '📌 Save',
      saved: 'Saved!',
      saveFail: 'Failed to save',
      noContent: 'No content to save',
      exportAll: '📤 Export All',
      formatMd: '📄 Markdown',
      formatJsonl: '📋 JSONL',
      formatZip: '🗜 ZIP',
      select: '☑️ Select',
      cancel: '❌ Cancel',
      selected: '📤 Selected',
      scanning: '⏳...',
      noMessages: 'No messages to export',
      exported: 'Exported',
      messages: 'messages',
      noSelected: 'No messages selected',
      scanningConvo: 'Scanning conversation...',
      copied: 'Copied as Markdown!',
      copyFail: 'Copy failed',
      exportFailed: 'Export failed',
      zipFallback: 'Attachment bundling failed, exported Markdown only',
      formatLabel: 'Format'
    },
    zh: {
      save: '📌 保存',
      saved: '已保存！',
      saveFail: '保存失败',
      noContent: '无内容可保存',
      exportAll: '📤 导出全部',
      formatMd: '📄 Markdown',
      formatJsonl: '📋 JSONL',
      formatZip: '🗜 ZIP',
      select: '☑️ 选择',
      cancel: '❌ 取消',
      selected: '📤 已选',
      scanning: '⏳...',
      noMessages: '没有可导出的消息',
      exported: '已导出',
      messages: '条消息',
      noSelected: '未选择消息',
      scanningConvo: '正在扫描对话...',
      copied: '已复制为 Markdown！',
      copyFail: '复制失败',
      exportFailed: '导出失败',
      zipFallback: '附件打包失败，已仅导出 Markdown',
      formatLabel: '格式'
    }
  };

  function t(key) {
    return i18n[lang][key] || i18n.en[key] || key;
  }

  // Load language + selection popup settings
  async function loadSettings() {
    const r = await chrome.storage.local.get([SETTINGS_KEY]);
    const s = r[SETTINGS_KEY] || {};
    lang = s.lang || 'en';
    selectionPopup = s.selectionPopup !== false;
    updateAllText();
  }

  // React to setting changes from the side panel
  chrome.storage.onChanged.addListener((changes) => {
    const s = changes[SETTINGS_KEY]?.newValue;
    if (!s) return;
    if (s.lang) {
      lang = s.lang;
      updateAllText();
    }
    if ('selectionPopup' in s) {
      selectionPopup = s.selectionPopup !== false;
      if (!selectionPopup) hideButton();
    }
  });

  function updateAllText() {
    // Update selection bar buttons
    const selSaveBtn = document.getElementById(SAVE_BTN_ID);
    if (selSaveBtn) selSaveBtn.innerHTML = t('save');
    // Update export bar
    const exportAllBtn = document.getElementById('ds-export-all');
    const exportMdMenu = document.getElementById('ds-export-md');
    const exportJsonlMenu = document.getElementById('ds-export-jsonl');
    const toggleSelect = document.getElementById('ds-toggle-select');
    const exportSelected = document.getElementById('ds-export-selected');

    if (exportAllBtn) exportAllBtn.textContent = t('exportAll');
    if (exportMdMenu) exportMdMenu.textContent = t('formatMd');
    if (exportJsonlMenu) exportJsonlMenu.textContent = t('formatJsonl');
    const exportZipMenu = document.getElementById('ds-export-zip');
    if (exportZipMenu) exportZipMenu.textContent = t('formatZip');

    // Mark the format that both export buttons use
    const formatLabel = { md: t('formatMd'), jsonl: t('formatJsonl'), zip: t('formatZip') }[exportFormat];
    const formatShort = { md: 'MD', jsonl: 'JSONL', zip: 'ZIP' }[exportFormat];
    const dropdown = document.getElementById('ds-export-dropdown');
    if (dropdown) {
      dropdown.textContent = `▼ ${formatShort}`;
      dropdown.title = `${t('formatLabel')}: ${formatLabel}`;
    }
    [['ds-export-md', 'md'], ['ds-export-jsonl', 'jsonl'], ['ds-export-zip', 'zip']].forEach(([id, fmt]) => {
      const btn = document.getElementById(id);
      if (btn) btn.style.color = fmt === exportFormat ? '#7dd3fc' : '#ddd';
    });
    if (toggleSelect && !messageSelectMode) toggleSelect.textContent = t('select');
    if (toggleSelect && messageSelectMode) toggleSelect.textContent = t('cancel');
    if (exportSelected) exportSelected.textContent = `${t('selected')} (${selectedMessages.size})`;
  }

  loadSettings();

  const SELECTION_BAR_ID = 'ds-notes-selection-bar';

  function createSelectionBar() {
    const bar = document.createElement('div');
    bar.id = SELECTION_BAR_ID;
    bar.style.cssText = `
      position: fixed;
      display: none;
      gap: 4px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    const btnStyle = `
      padding: 6px 10px;
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.1s, opacity 0.2s;
    `;

    const saveBtn = document.createElement('button');
    saveBtn.id = SAVE_BTN_ID;
    saveBtn.innerHTML = t('save');
    saveBtn.style.cssText = btnStyle + 'background: #4CAF50;';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'ds-notes-copy-md-btn';
    copyBtn.innerHTML = '📋 Markdown';
    copyBtn.style.cssText = btnStyle + 'background: #2563eb;';

    [saveBtn, copyBtn].forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
    });

    saveBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      saveSelectedText();
    });

    copyBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      copySelectionAsMarkdown();
    });

    bar.appendChild(saveBtn);
    bar.appendChild(copyBtn);
    document.body.appendChild(bar);
    return bar;
  }

  function getMessageRole() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return 'assistant';

    // Find the .ds-message ancestor
    let node = selection.anchorNode;
    while (node) {
      if (node.nodeType === 1 && node.classList?.contains('ds-message')) {
        return getMessageRoleFromElement(node);
      }
      node = node.parentElement;
    }
    return 'assistant';
  }

  function getSelectionHtml() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return '';
    const container = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    return container;
  }

  function saveSelectedText() {
    const selection = window.getSelection();
    const plainText = selection.toString().trim();

    if (!plainText) return;

    // Find the .ds-message element containing the selection
    let messageEl = null;
    let node = selection.anchorNode;
    while (node) {
      if (node.nodeType === 1 && node.classList?.contains('ds-message')) {
        messageEl = node;
        break;
      }
      node = node.parentElement;
    }

    // Extract as markdown from HTML fragment
    const htmlFragment = getSelectionHtml();
    const content = htmlToMarkdown(htmlFragment) || plainText;

    const role = messageEl ? getMessageRoleFromElement(messageEl) : 'assistant';

    // Get scroll position ratio
    const scrollContainer = document.querySelector('.ds-virtual-list');
    let scrollRatio = -1;
    if (scrollContainer && messageEl) {
      const rect = messageEl.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const offsetInView = rect.top - containerRect.top;
      scrollRatio = (scrollContainer.scrollTop + offsetInView) / scrollContainer.scrollHeight;
    }

    // For AI replies, find preceding user message
    let userMessageText = null;
    if (role === 'assistant' && messageEl) {
      userMessageText = findPrecedingUserMessage(messageEl);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content,
      selectionText: (selectionTextFromDom(messageEl) || norm(plainText)).slice(0, 1000),
      searchText: messageEl?.innerText?.trim().slice(0, 150) || plainText.slice(0, 150),
      userMessageText: userMessageText,
      role: role,
      conversationUrl: window.location.href,
      conversationTitle: document.title || null,
      scrollRatio: scrollRatio,
      savedAt: Date.now()
    };

    chrome.runtime.sendMessage({
      action: 'saveMessage',
      message: message
    }, (response) => {
      if (response?.success) {
        showToast(t('saved'));
        hideButton();
        selection.removeAllRanges();
      } else {
        showToast(t('saveFail'), true);
      }
    });
  }

  function showToast(text, isError = false) {
    const existing = document.querySelector('.ds-notes-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ds-notes-toast';
    toast.textContent = text;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${isError ? '#ff4444' : '#4CAF50'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  let selectionBar = null;

  function showButton(x, y) {
    if (!selectionBar) {
      selectionBar = createSelectionBar();
    }

    const barWidth = 200;
    const barHeight = 32;
    let posX = x - barWidth / 2;
    let posY = y - barHeight - 10;

    posX = Math.max(10, Math.min(posX, window.innerWidth - barWidth - 10));
    posY = Math.max(10, posY);

    selectionBar.style.left = posX + 'px';
    selectionBar.style.top = posY + 'px';
    selectionBar.style.display = 'flex';
  }

  function hideButton() {
    if (selectionBar) {
      selectionBar.style.display = 'none';
    }
  }

  function handleSelectionChange() {
    if (!selectionPopup) {
      hideButton();
      return;
    }

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text || text.length < 3) {
      hideButton();
      return;
    }

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Show button above selection center
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    showButton(x, y);
  }

  function isSelectionBarClick(target) {
    return target.closest && target.closest(`#${SELECTION_BAR_ID}`);
  }

  // Listen for mouse up (end of selection)
  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      if (isSelectionBarClick(e.target)) return;
      handleSelectionChange();
    }, 10);
  });

  // Hide button when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (!isSelectionBarClick(e.target)) {
      hideButton();
    }
  });

  // Hide on scroll
  document.addEventListener('scroll', hideButton, true);

  // Hide on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideButton();
      window.getSelection().removeAllRanges();
    }
  });

  // === Save Button for Each Message ===
  const MSG_BTN_CLASS = 'ds-notes-msg-btn';
  const PROCESSED_ATTR = 'data-ds-notes-processed';

  function createMsgButton(emoji, title, bgColor, onClick) {
    const btn = document.createElement('button');
    btn.className = MSG_BTN_CLASS;
    btn.innerHTML = emoji;
    btn.title = title;
    btn.style.cssText = `
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: rgba(80, 80, 80, 0.3);
      color: #999;
      font-size: 13px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      transition: background 0.2s, transform 0.1s;
      opacity: 0.6;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = bgColor;
      btn.style.opacity = '1';
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(80, 80, 80, 0.3)';
      btn.style.opacity = '0.6';
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(btn);
    });

    return btn;
  }

  function createMsgSaveButton(messageEl) {
    const btn = createMsgButton('📌', 'Save to Notes', '#4CAF50', (b) => {
      saveMessageContent(messageEl, b);
    });
    btn.style.cssText += `
      position: absolute !important;
      bottom: 4px !important;
      right: 4px !important;
      z-index: 10;
    `;
    return btn;
  }

  async function copySelectionAsMarkdown() {
    const selection = window.getSelection();
    const plainText = selection.toString().trim();
    if (!plainText) return;

    const htmlFragment = getSelectionHtml();
    const content = htmlToMarkdown(htmlFragment) || plainText;

    try {
      await navigator.clipboard.writeText(content);
      showToast(t('copied'));
      hideButton();
      selection.removeAllRanges();
    } catch (e) {
      showToast(t('copyFail'), true);
    }
  }

  // Detect role by checking message content patterns
  function getMessageRoleFromElement(el) {
    // AI replies are rendered as markdown blocks; user messages are plain text
    // (sometimes with attachments). Counting how many messages share a parent
    // class is not a usable signal: as soon as the user sends more messages
    // than the assistant replies, every message gets tagged as the user's.
    if (el.querySelector('.ds-markdown')) return 'assistant';
    if (el.innerText?.includes('已思考')) return 'assistant';
    return 'user';
  }

  const FILE_CHIP_MARK = 'data-ds-file-chip';

  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
    return t;
  }

  // DeepSeek keeps the attachment metadata - including a signed download path -
  // in the React tree attached to the message nodes. Content scripts run in an
  // isolated world and cannot read those JS properties, so the background reads
  // them in the page's main world and hands back plain data. The chip itself
  // has no link and the <img> only points at a downscaled thumbnail.
  let attachmentMetaCache = new Map();

  async function refreshAttachmentMeta() {
    try {
      const res = await sendMessageWithTimeout({ action: 'attachmentMeta' }, 15000);
      if (res && res.success && Array.isArray(res.files)) {
        // MERGE, not replace: only the messages rendered right now are visible
        // to the fiber walk, and a long conversation renders its history in
        // chunks while the export scrolls
        for (const f of res.files) {
          if (f.fileName && !attachmentMetaCache.has(f.fileName)) {
            attachmentMetaCache.set(f.fileName, f);
          }
        }
      }
    } catch (e) {
      // page not reachable (or extension reloaded) - fall back to DOM only
      console.warn('[DS Note] attachment meta unavailable', e);
    }
    return attachmentMetaCache;
  }

  function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const num = i === 0 ? n : (n < 10 ? n.toFixed(2) : Math.round(n));
    return `${num} ${units[i]}`;
  }

  function findMeta(name) {
    const map = attachmentMetaCache;
    if (!map || !name) return null;
    if (map.has(name)) return map.get(name);
    for (const [key, value] of map) {
      if (key.endsWith(name) || name.endsWith(key)) return value;
    }
    return null;
  }

  // Attachments are only resolvable while their message is rendered, so the
  // markdown collected during the scroll may still hold plain names. Once the
  // whole conversation has been walked, put the links back in.
  function linkAttachments(text) {
    if (!text || !attachmentMetaCache.size) return text;
    let out = text.replace(/📎\s*(?!\[)([^\n]+?)\s*\(([^()\n]*)\)\s*$/gm, (full, name, meta) => {
      const key = name.trim();
      const info = findMeta(key);
      return info && info.url ? `📎 [${key}](${info.url}) (${meta})` : full;
    });
    out = out.replace(/!\[([^\]]*)\]\((https:\/\/files\.deepseeksvc\.com[^)]*)\)/g, (full, alt, url) => {
      const info = findMeta(alt.trim());
      return info && info.url ? `![${alt}](${info.url})` : full;
    });
    return out;
  }

  // DeepSeek renders uploaded/pasted files as a chip: a file icon plus two
  // sibling blocks - the file name and "TYPE 9.93KB". Without recognising it
  // the chip collapses into one glued run of text ("name.txtTXT 9.93KB") and
  // the attachment is lost. The chip's class names are build-hashed, so
  // detection is structural.
  function markFileChips(root) {
    for (const metaEl of root.querySelectorAll('div, span')) {
      const t = ownText(metaEl).replace(/\s+/g, ' ').trim();
      const m = t.match(/^([A-Za-z0-9]{1,5})\s+([\d.,]+\s*[KMGT]?B)$/);
      if (!m) continue;

      // The file name sits in the preceding sibling block
      let name = '';
      let prev = metaEl.previousElementSibling;
      while (prev && !name) {
        const pt = (prev.textContent || '').replace(/\s+/g, ' ').trim();
        if (pt && pt.length <= 200) name = pt;
        prev = prev.previousElementSibling;
      }
      if (!name) continue;

      const chip = metaEl.parentElement;
      const scope = chip && chip.parentElement ? chip.parentElement : chip;
      if (!scope || !scope.querySelector('svg, img')) continue;

      // Prefer the signed download path from the React tree; fall back to
      // whatever link the chip happens to contain
      const info = findMeta(name);
      const linkEl = info ? null : scope.querySelector('a[href], img[src*="files.deepseeksvc.com"]');
      const url = info ? info.url : (linkEl ? (linkEl.getAttribute('href') || linkEl.getAttribute('src') || '') : '');
      const size = info && info.size ? formatSize(info.size) : m[2].replace(/([KMGT]?B)$/i, ' $1');

      chip.setAttribute(FILE_CHIP_MARK, JSON.stringify({
        name,
        type: m[1].toUpperCase(),
        size,
        url
      }));
    }
  }

  function htmlToMarkdown(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);

    // Remove thinking/collapsed sections, and our own injected controls
    clone.querySelectorAll('.ds-thinking, .ds-collapse, .ds-notes-msg-btn, .ds-msg-checkbox').forEach(e => e.remove());

    // Recognise attachment chips before converting, so they become one
    // structured line instead of glued text
    markFileChips(clone);

    function convert(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';

      const tag = node.tagName.toLowerCase();

      const chipAttr = node.getAttribute(FILE_CHIP_MARK);
      if (chipAttr) {
        const chip = JSON.parse(chipAttr);
        let name = chip.name.replace(/[[\]]/g, '').trim();
        if (name.length > 80) name = name.slice(0, 80) + '…';
        const label = chip.url ? `[${name}](${chip.url})` : name;
        return `\n📎 ${label} (${chip.type}, ${chip.size})\n`;
      }

      // KaTeX math
      if (node.classList?.contains('katex')) {
        const ann = node.querySelector('annotation[encoding="application/x-tex"]');
        if (ann) {
          const isBlock = node.parentElement?.classList.contains('katex-display');
          return isBlock ? `$$${ann.textContent}$$` : `$${ann.textContent}$`;
        }
      }

      const children = Array.from(node.childNodes).map(convert).join('');

      switch (tag) {
        case 'h1': return `\n# ${children.trim()}\n\n`;
        case 'h2': return `\n## ${children.trim()}\n\n`;
        case 'h3': return `\n### ${children.trim()}\n\n`;
        case 'h4': return `\n#### ${children.trim()}\n\n`;
        case 'strong': case 'b': return `**${children}**`;
        case 'em': case 'i': return `*${children}*`;
        case 'del': case 's': return `~~${children}~~`;
        case 'code':
          if (node.parentElement?.tagName.toLowerCase() === 'pre') return children;
          return `\`${children}\``;
        case 'pre': {
          const codeEl = node.querySelector('code');
          const langClass = codeEl?.className?.match(/language-(\w+)/);
          const langStr = langClass ? langClass[1] : '';
          const codeText = codeEl ? codeEl.textContent : children;
          return `\n\`\`\`${langStr}\n${codeText.trimEnd()}\n\`\`\`\n\n`;
        }
        case 'a': {
          const href = node.getAttribute('href');
          return href ? `[${children}](${href})` : children;
        }
        case 'br': return '\n';
        case 'hr': return '\n---\n\n';
        case 'p': return `${children.trim()}\n\n`;
        case 'blockquote': {
          const lines = children.trim().split('\n').map(l => `> ${l}`).join('\n');
          return `\n${lines}\n\n`;
        }
        case 'ul': return `\n${children}\n`;
        case 'ol': return `\n${children}\n`;
        case 'li': {
          const parent = node.parentElement;
          const prefix = parent?.tagName.toLowerCase() === 'ol'
            ? `${Array.from(parent.children).indexOf(node) + 1}. `
            : '- ';
          return `${prefix}${children.trim()}\n`;
        }
        case 'table': {
          const rows = node.querySelectorAll('tr');
          if (!rows.length) return children;
          let md = '\n';
          rows.forEach((row, ri) => {
            const cells = row.querySelectorAll('th, td');
            const line = Array.from(cells).map(c => convert(c).trim()).join(' | ');
            md += `| ${line} |\n`;
            if (ri === 0) {
              md += `| ${Array.from(cells).map(() => '---').join(' | ')} |\n`;
            }
          });
          return md + '\n';
        }
        case 'th': case 'td': return children;
        case 'img': {
          const alt = node.getAttribute('alt') || '';
          const src = node.getAttribute('src') || '';
          // skip decorations (avatars, icons) - only real attachments have a
          // name or point at the attachment CDN
          const isAttachment = !!alt || src.includes('files.deepseeksvc');
          if (!isAttachment) return '';
          // the <img> usually points at a downscaled thumbnail - link the
          // original file when the attachment metadata knows about it
          const info = findMeta(alt);
          return `![${alt}](${info ? info.url : src})`;
        }
        case 'div': case 'span': case 'section': {
          // At the root of a user message the attachment and the typed prompt
          // can sit in separate nodes - keep them apart instead of gluing
          // them into one line
          if (node === clone && node.childNodes.length > 1) {
            return Array.from(node.childNodes)
              .map(convert)
              .map(s => s.trim())
              .filter(Boolean)
              .join('\n\n') + '\n\n';
          }
          return children;
        }
        default:
          return children;
      }
    }

    let result = convert(clone);
    // Clean up excessive newlines
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
  }

  // Backward compat alias
  const extractTextWithLatex = htmlToMarkdown;

  // Find the preceding user message for an AI reply
  function findPrecedingUserMessage(messageEl) {
    // Get all messages in DOM order
    const allMessages = Array.from(document.querySelectorAll('.ds-message'));
    const currentIndex = allMessages.indexOf(messageEl);
    if (currentIndex <= 0) return null;

    // Walk backwards to find user message
    for (let i = currentIndex - 1; i >= 0; i--) {
      const msg = allMessages[i];
      const role = getMessageRoleFromElement(msg);
      if (role === 'user') {
        // Get user message text (no markdown, just first div or innerText)
        const firstDiv = msg.querySelector('div');
        const text = firstDiv ? firstDiv.innerText : msg.innerText;
        return text?.trim().slice(0, 100);
      }
    }
    return null;
  }

  async function saveMessageContent(messageEl, btn) {
    await refreshAttachmentMeta();
    const markdowns = messageEl.querySelectorAll('.ds-markdown');
    const markdown = markdowns.length > 0 ? markdowns[markdowns.length - 1] : null;
    // User messages have no .ds-markdown; convert their body the same way so
    // attachments (images, file chips) are not dropped
    const content = linkAttachments(
      markdown ? htmlToMarkdown(markdown) : htmlToMarkdown(messageSource(messageEl))
    );
    // Keep raw text for search (without LaTeX conversion)
    const rawText = messageEl.innerText.trim();

    if (!content || content.length < 3) {
      showToast(t('noContent'), true);
      return;
    }

    // Get scroll position ratio for precise jump back
    const scrollContainer = document.querySelector('.ds-virtual-list');
    let scrollRatio = -1;
    if (scrollContainer) {
      const rect = messageEl.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const offsetInView = rect.top - containerRect.top;
      scrollRatio = (scrollContainer.scrollTop + offsetInView) / scrollContainer.scrollHeight;
    }

    const role = getMessageRoleFromElement(messageEl);

    // For AI replies, find preceding user message for timeline search
    let userMessageText = null;
    if (role === 'assistant') {
      userMessageText = findPrecedingUserMessage(messageEl);
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content,
      selectionText: null, // whole-message save: the note covers the entire message
      searchText: rawText.slice(0, 150),
      userMessageText: userMessageText, // For timeline search
      role: role,
      conversationUrl: window.location.href,
      conversationTitle: document.title || null,
      scrollRatio: scrollRatio,
      savedAt: Date.now()
    };

    chrome.runtime.sendMessage({
      action: 'saveMessage',
      message: message
    }, (response) => {
      if (response?.success) {
        showToast(t('saved'));
        btn.innerHTML = '✓';
        btn.style.background = '#4CAF50';
        btn.style.opacity = '1';
        setTimeout(() => {
          btn.innerHTML = '📌';
          btn.style.background = 'rgba(80, 80, 80, 0.3)';
          btn.style.opacity = '0.6';
        }, 1500);
      } else {
        showToast(t('saveFail'), true);
      }
    });
  }

  function addSaveButtonsToMessages() {
    const messageEls = document.querySelectorAll('.ds-message');

    messageEls.forEach(el => {
      if (el.hasAttribute(PROCESSED_ATTR)) return;
      if (el.querySelector(`.${MSG_BTN_CLASS}`)) return;

      const markdown = el.querySelector('.ds-markdown');
      // AI replies are markdown blocks, user messages are plain text - but the
      // user side is exactly where the attachments live, so save those too
      const content = markdown ? markdown.innerText.trim() : (el.innerText || '').trim();
      if (content.length < 10) return;

      el.setAttribute(PROCESSED_ATTR, 'true');
      el.style.setProperty('position', 'relative', 'important');
      el.appendChild(createMsgSaveButton(el));
    });
  }

  // Init message buttons
  function initMessageButtons() {
    setTimeout(addSaveButtonsToMessages, 1500);

    const observer = new MutationObserver(() => {
      clearTimeout(window.dsNotesMsgTimeout);
      window.dsNotesMsgTimeout = setTimeout(addSaveButtonsToMessages, 500);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  initMessageButtons();

  // === Export Toolbar (near input area) ===
  const EXPORT_BAR_ID = 'ds-notes-export-bar';

  function createExportBar() {
    if (document.getElementById(EXPORT_BAR_ID)) return;

    const bar = document.createElement('div');
    bar.id = EXPORT_BAR_ID;
    bar.innerHTML = `
      <div class="ds-export-group">
        <button id="ds-export-all"></button>
        <button id="ds-export-dropdown">▼</button>
        <div id="ds-export-menu" class="ds-dropdown-menu" style="display:none;">
          <button id="ds-export-md">📄 Markdown</button>
          <button id="ds-export-jsonl">📋 JSONL</button>
          <button id="ds-export-zip">🗜 ZIP</button>
        </div>
      </div>
      <button id="ds-toggle-select"></button>
      <button id="ds-export-selected" style="display:none;"></button>
    `;
    bar.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      gap: 6px;
      z-index: 99997;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    // Export group styles
    const exportGroup = bar.querySelector('.ds-export-group');
    exportGroup.style.cssText = `
      display: flex;
      position: relative;
    `;

    const btnStyle = `
      padding: 6px 10px;
      border: none;
      background: #333;
      color: #ddd;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s;
    `;

    // Main export button
    const exportBtn = bar.querySelector('#ds-export-all');
    exportBtn.style.cssText = btnStyle + `border-radius: 6px 0 0 6px;`;

    // Dropdown toggle
    const dropdownBtn = bar.querySelector('#ds-export-dropdown');
    dropdownBtn.style.cssText = btnStyle + `
      border-radius: 0 6px 6px 0;
      padding: 6px 8px;
      border-left: 1px solid #444;
      font-size: 10px;
      white-space: nowrap;
    `;

    // Dropdown menu
    const menu = bar.querySelector('#ds-export-menu');
    menu.style.cssText = `
      display: none;
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 4px;
      background: #2a2a2a;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      overflow: hidden;
      min-width: 120px;
    `;

    menu.querySelectorAll('button').forEach(btn => {
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: #ddd;
        font-size: 11px;
        text-align: left;
        cursor: pointer;
      `;
      btn.addEventListener('mouseenter', () => btn.style.background = '#3a3a3a');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    });

    // Other buttons
    const selectBtn = bar.querySelector('#ds-toggle-select');
    const exportSelBtn = bar.querySelector('#ds-export-selected');
    selectBtn.style.cssText = btnStyle + `border-radius: 6px;`;
    exportSelBtn.style.cssText = btnStyle + `border-radius: 6px; display: none;`;

    // Hover effects
    [exportBtn, dropdownBtn, selectBtn, exportSelBtn].forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = '#444');
      btn.addEventListener('mouseleave', () => {
        if (!btn.classList.contains('active-select')) btn.style.background = '#333';
      });
    });

    document.body.appendChild(bar);

    // Set button text (i18n)
    document.getElementById('ds-export-all').textContent = t('exportAll');
    document.getElementById('ds-export-md').textContent = t('formatMd');
    document.getElementById('ds-export-jsonl').textContent = t('formatJsonl');
    document.getElementById('ds-export-zip').textContent = t('formatZip');
    document.getElementById('ds-toggle-select').textContent = t('select');
    document.getElementById('ds-export-selected').textContent = `${t('selected')} (0)`;

    // Dropdown toggle
    let menuOpen = false;
    dropdownBtn.onclick = (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      menu.style.display = menuOpen ? 'block' : 'none';
    };

    // Close menu on outside click
    document.addEventListener('click', () => {
      menuOpen = false;
      menu.style.display = 'none';
    });

    // Event handlers
    document.getElementById('ds-export-all').onclick = () => exportAllConversation(exportFormat);
    document.getElementById('ds-export-md').onclick = () => { setExportFormat('md'); menu.style.display = 'none'; };
    document.getElementById('ds-export-jsonl').onclick = () => { setExportFormat('jsonl'); menu.style.display = 'none'; };
    document.getElementById('ds-export-zip').onclick = () => { setExportFormat('zip'); menu.style.display = 'none'; };
    document.getElementById('ds-export-selected').onclick = exportSelectedMessages;
    document.getElementById('ds-toggle-select').onclick = toggleMessageSelect;

    // reflect the current export format (and any language change)
    updateAllText();
  }

  let messageSelectMode = false;
  // Selected messages are keyed by a content fingerprint and stored with a
  // snapshot of their role/content. Index-based selection drifted whenever the
  // virtual list recycled DOM nodes, which exported the wrong messages.
  let selectedMessages = new Map();
  let checkboxObserver = null;

  const SEL_BG = 'rgba(59, 130, 246, 0.1)';

  // Element holding the message body. Our injected controls are siblings of it,
  // so the fingerprint stays free of them.
  function messageSource(el) {
    const markdowns = el.querySelectorAll('.ds-markdown');
    if (markdowns.length > 0) return markdowns[markdowns.length - 1];
    // User messages have no markdown block, and the typed prompt and the
    // attachment can sit in different nodes - convert the whole message
    // instead of guessing which child holds the text.
    return el;
  }

  // Cheap, stable identity of a message (independent of its DOM position)
  function messageKey(el) {
    const role = el.querySelector('.ds-markdown') ? 'assistant' : 'user';
    const text = messageSource(el).textContent || '';
    return `${role}|${text.slice(0, 80)}|${text.length}`;
  }

  function messageContent(el) {
    const markdowns = el.querySelectorAll('.ds-markdown');
    if (markdowns.length > 0) {
      return extractTextWithLatex(markdowns[markdowns.length - 1]);
    }
    const firstDiv = el.querySelector('div');
    return firstDiv ? extractTextWithLatex(firstDiv) : (el.innerText || '').trim();
  }

  function toggleMessageSelected(el, cb, checked) {
    const key = messageKey(el);
    if (checked) {
      const content = messageContent(el);
      if (!content || !content.trim()) {
        cb.checked = false;
        return;
      }
      selectedMessages.set(key, { role: getMessageRoleFromElement(el), content });
      el.style.background = SEL_BG;
    } else {
      selectedMessages.delete(key);
      el.style.background = '';
    }
    updateExportSelectedBtn();
  }

  async function toggleMessageSelect() {
    messageSelectMode = !messageSelectMode;
    const btn = document.getElementById('ds-toggle-select');
    const exportSelBtn = document.getElementById('ds-export-selected');

    if (messageSelectMode) {
      btn.textContent = t('cancel');
      btn.style.background = '#dc2626';
      btn.classList.add('active-select');
      exportSelBtn.style.display = 'block';
      // attachment urls must be known before the checkboxes snapshot content
      await refreshAttachmentMeta();
      // start with nothing selected - auto-picking the last message makes the
      // user undo it every time
      addMessageCheckboxes(false);
      startCheckboxObserver();
    } else {
      btn.textContent = t('select');
      btn.style.background = '#444';
      btn.classList.remove('active-select');
      exportSelBtn.style.display = 'none';
      selectedMessages.clear();
      removeMessageCheckboxes();
      stopCheckboxObserver();
    }
  }

  function addMessageCheckboxes(autoSelectLatest = false) {
    const containers = document.querySelectorAll('.ds-message');

    // Every message gets a checkbox, user messages included
    containers.forEach((el) => {
      if (el.querySelector('.ds-msg-checkbox')) return;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'ds-msg-checkbox';
      cb.style.cssText = `
        position: absolute;
        top: 8px;
        left: -24px;
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #3b82f6;
      `;

      cb.onchange = () => toggleMessageSelected(el, cb, cb.checked);

      el.style.setProperty('position', 'relative', 'important');
      el.insertBefore(cb, el.firstChild);
    });

    // Auto-select the latest answer
    if (autoSelectLatest && containers.length > 0) {
      let latest = null;
      for (const el of containers) {
        if (el.querySelector('.ds-markdown')) latest = el;
      }
      if (!latest) latest = containers[containers.length - 1];
      const cb = latest.querySelector('.ds-msg-checkbox');
      if (cb) {
        cb.checked = true;
        toggleMessageSelected(latest, cb, true);
      }
    }
  }

  function removeMessageCheckboxes() {
    document.querySelectorAll('.ds-msg-checkbox').forEach(cb => {
      cb.parentElement.style.background = '';
      cb.remove();
    });
  }

  // Newly rendered messages need a checkbox too — the virtual list only keeps
  // a window of messages in the DOM
  function startCheckboxObserver() {
    if (checkboxObserver) return;
    checkboxObserver = new MutationObserver(() => {
      clearTimeout(window.dsNotesCbTimeout);
      window.dsNotesCbTimeout = setTimeout(() => {
        if (messageSelectMode) addMessageCheckboxes(false);
      }, 300);
    });
    checkboxObserver.observe(document.body, { childList: true, subtree: true });
  }

  function stopCheckboxObserver() {
    if (checkboxObserver) {
      checkboxObserver.disconnect();
      checkboxObserver = null;
    }
    clearTimeout(window.dsNotesCbTimeout);
  }

  function updateExportSelectedBtn() {
    const btn = document.getElementById('ds-export-selected');
    btn.textContent = `${t('selected')} (${selectedMessages.size})`;
  }

  // Collect the selected messages in conversation order. The snapshot taken at
  // selection time is the source of truth, so messages whose DOM node was
  // recycled away by the virtual list are still exported.
  function extractSelectedMessages() {
    const messages = [];
    const used = new Set();

    document.querySelectorAll('.ds-message').forEach((el) => {
      const key = messageKey(el);
      const snap = selectedMessages.get(key);
      if (!snap || used.has(key)) return;
      used.add(key);
      messages.push(snap);
    });

    // Selected messages that are no longer rendered
    for (const [key, snap] of selectedMessages) {
      if (!used.has(key)) messages.push(snap);
    }

    return messages;
  }

  // DeepSeek sometimes renders the same attachment twice inside one message
  // (e.g. a hidden preview copy) - keep one line per attachment
  function dedupeAttachments(text) {
    if (!text) return text;
    const seen = new Set();
    return text.split('\n').filter(line => {
      const isAttachment = line.includes('📎') || line.startsWith('![');
      if (!isAttachment) return true;
      const key = line.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join('\n');
  }

  function messagesToMd(messages, title) {
    let md = `# ${title}\n\nExported: ${new Date().toLocaleString()}\n\n---\n\n`;
    const body = (m) => dedupeAttachments(linkAttachments(m.content));
    // Group each prompt with the reply that belongs to it, so a round reads
    // as one exchange instead of two unrelated sections
    let round = 0;
    let i = 0;
    while (i < messages.length) {
      round++;
      md += `## Round ${round}\n\n`;
      md += `### ${messages[i].role.toUpperCase()}\n\n${body(messages[i])}\n\n`;
      i++;
      while (i < messages.length && messages[i].role === 'assistant') {
        md += `### ${messages[i].role.toUpperCase()}\n\n${body(messages[i])}\n\n`;
        i++;
      }
      md += `---\n\n`;
    }
    return md;
  }

  function messagesToJsonl(messages, title) {
    const lines = messages.map((m, i) => JSON.stringify({
      index: i,
      role: m.role,
      content: m.content,
      source: title,
      exportedAt: new Date().toISOString()
    }));
    return lines.join('\n');
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

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // revoke late: large bundles can be cancelled if the URL dies too early
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // The background worker may be asleep or wedged - never let an export hang
  // forever, otherwise the user only sees a button that does nothing.
  function sendMessageWithTimeout(message, timeout = 60000) {
    return Promise.race([
      chrome.runtime.sendMessage(message),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('background timeout')), timeout)
      )
    ]);
  }

  // ZIP export: the markdown plus the attachments it references, bundled
  // locally so the export stays usable offline
  async function downloadZip(md, baseName) {
    const res = await sendMessageWithTimeout({ action: 'buildZip', md, baseName });
    if (!res?.success) throw new Error(res?.error || 'ZIP export failed');
    const bin = atob(res.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    downloadFile(bytes, res.filename, 'application/zip');
  }

  async function scrollAndCollectAll() {
    await refreshAttachmentMeta();
    const scrollContainer = document.querySelector('.ds-virtual-list');
    if (!scrollContainer) {
      showToast(t('noMessages'), true);
      return null;
    }

    const allMessages = new Map(); // Use map to dedupe by content
    let lastCount = 0;
    let stableCount = 0;

    showToast(t('scanningConvo'));

    // Scroll to top first. The virtual list needs a moment to swap the
    // bottom-most messages out for the top ones - collecting before that
    // renders puts the tail of the conversation at the top of the export.
    scrollContainer.scrollTop = 0;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (scrollContainer.scrollTop <= 0 && i >= 4) break;
      scrollContainer.scrollTop = 0;
    }
    await new Promise(r => setTimeout(r, 600));

    // Scroll down gradually
    const scrollStep = 800;
    const maxIterations = 500;
    let lastScrollTop = -1;

    for (let i = 0; i < maxIterations; i++) {
      // Collect current visible messages
      document.querySelectorAll('.ds-message').forEach(el => {
        const markdowns = el.querySelectorAll('.ds-markdown');
        let content = '';

        if (markdowns.length > 0) {
          // AI: take last markdown (main response)
          content = extractTextWithLatex(markdowns[markdowns.length - 1]);
        } else {
          // User: convert the whole message, the prompt and the attachment
          // may live in different nodes
          content = extractTextWithLatex(messageSource(el));
        }

        if (content.length < 3) return;

        // Dedupe on the whole message, not its first 100 characters: two
        // prompts that only differ further down (same attachment, different
        // question) must both survive, while the same message seen twice
        // during the scroll still collapses
        const role = getMessageRoleFromElement(el);
        const key = `${role}|${content}`;
        if (!allMessages.has(key)) {
          allMessages.set(key, { role, content });
        }
      });

      // Check if scroll position stopped changing (reached bottom)
      if (scrollContainer.scrollTop === lastScrollTop) {
        stableCount++;
        if (stableCount >= 3) break;
      } else {
        stableCount = 0;
        lastScrollTop = scrollContainer.scrollTop;
      }

      // Scroll down
      scrollContainer.scrollTop += scrollStep;
      // The virtual list only keeps a window of messages mounted, so the
      // attachment metadata has to be read as the history scrolls past
      if (i % 8 === 0) await refreshAttachmentMeta();
      await new Promise(r => setTimeout(r, 150));
    }

    // last chance: whatever is rendered at the end of the walk
    await refreshAttachmentMeta();

    return Array.from(allMessages.values());
  }

  // The format chosen in the dropdown applies to both export buttons
  function setExportFormat(fmt) {
    exportFormat = fmt;
    updateAllText();
  }

  async function exportAllConversation(format = 'md') {
    const btnId = format === 'jsonl' ? 'ds-export-jsonl' : format === 'zip' ? 'ds-export-zip' : 'ds-export-all';
    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.textContent = t('scanning');
    btn.disabled = true;

    try {
      const messages = await scrollAndCollectAll();

      if (!messages || !messages.length) {
        showToast(t('noMessages'), true);
        return;
      }

      const title = document.title || 'DeepSeek Conversation';
      const base = `${slugify(title) || 'deepseek'}-${stamp(true)}`;
      const md = messagesToMd(messages, title);

      if (format === 'zip') {
        try {
          await downloadZip(md, base);
        } catch (e) {
          // bundling the attachments failed - deliver the conversation anyway
          console.warn('[DS Note] zip export failed', e);
          downloadFile(md, `${base}.md`, 'text/markdown');
          showToast(t('zipFallback'), true);
          return;
        }
      } else if (format === 'jsonl') {
        const jsonl = messagesToJsonl(messages, title);
        downloadFile(jsonl, `${base}.jsonl`, 'application/jsonl');
      } else {
        downloadFile(md, `${base}.md`, 'text/markdown');
      }

      showToast(`${t('exported')} ${messages.length} ${t('messages')}`);
    } catch (e) {
      console.error('[DS Note] export failed', e);
      showToast(`${t('exportFailed')}: ${e && e.message ? e.message : e}`, true);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  function exportSelectedMessages() {
    if (!selectedMessages.size) {
      showToast(t('noSelected'), true);
      return;
    }
    const messages = extractSelectedMessages();
    const title = 'Selected Messages';
    const base = `${slugify(document.title) || 'deepseek'}-selected-${stamp(true)}`;
    const md = messagesToMd(messages, title);

    if (exportFormat === 'zip') {
      downloadZip(md, base)
        .then(() => showToast(`${t('exported')} ${messages.length} ${t('messages')}`))
        .catch(e => {
          console.warn('[DS Note] zip export failed', e);
          downloadFile(md, `${base}.md`, 'text/markdown');
          showToast(t('zipFallback'), true);
        });
    } else if (exportFormat === 'jsonl') {
      downloadFile(messagesToJsonl(messages, title), `${base}.jsonl`, 'application/jsonl');
      showToast(`${t('exported')} ${messages.length} ${t('messages')}`);
    } else {
      downloadFile(md, `${base}.md`, 'text/markdown');
      showToast(`${t('exported')} ${messages.length} ${t('messages')}`);
    }

    // Exit select mode
    toggleMessageSelect();
  }

  function initExportBar() {
    setTimeout(() => {
      const hasMessages = document.querySelector('.ds-message, .ds-markdown');
      if (hasMessages) createExportBar();
    }, 2000);

    const observer = new MutationObserver(() => {
      const hasMessages = document.querySelector('.ds-message, .ds-markdown');
      if (hasMessages && !document.getElementById(EXPORT_BAR_ID)) {
        createExportBar();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  initExportBar();

  // === Scroll to Message (Jump to Original) ===

  // Find right-side timeline's virtual list (actual scroll container)
  function findTimelineContainer() {
    const scrollAreas = document.querySelectorAll('.ds-scroll-area');
    for (const el of scrollAreas) {
      const rect = el.getBoundingClientRect();
      // Right side timeline: left > 400, width 100-350
      if (rect.left > 400 && rect.width < 350 && rect.width > 100) {
        // Return the inner ds-virtual-list which is the actual scroll container
        const virtualList = el.querySelector('.ds-virtual-list');
        return virtualList || el;
      }
    }
    return null;
  }

  // Search timeline for matching entry (in current view)
  function findTimelineEntry(timeline, searchText) {
    const normalizedSearch = searchText.replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase();
    if (normalizedSearch.length < 5) return null;

    // Get all timeline entries - they have children with text
    const allDivs = timeline.querySelectorAll('div');
    const entries = [];

    for (const div of allDivs) {
      // Skip leaves (no children)
      if (div.children.length === 0) continue;
      // Must have a text-only child
      const textChild = Array.from(div.children).find(c =>
        c.children.length === 0 && c.innerText?.trim().length > 5
      );
      if (textChild) {
        entries.push(div);
      }
    }

    // Find matching entry
    for (const entry of entries) {
      const text = (entry.innerText || '').replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase();
      if (!text) continue;

      // Match
      if (normalizedSearch.includes(text.slice(0, 15)) ||
          text.includes(normalizedSearch.slice(0, 15))) {
        return entry;
      }
    }

    return null;
  }

  // Scroll timeline and search for entry
  async function scrollTimelineAndClick(searchText, scrollRatio) {
    const timeline = findTimelineContainer();
    if (!timeline) return false;

    // First: scroll timeline to approximate position based on scrollRatio
    if (scrollRatio >= 0 && scrollRatio <= 1) {
      const targetPos = scrollRatio * timeline.scrollHeight;
      timeline.scrollTop = targetPos;
      await sleep(200);
    }

    // Search in current view
    let entry = findTimelineEntry(timeline, searchText);
    if (entry) {
      entry.click();
      return true;
    }

    // Search nearby: scroll up/down in timeline
    const originalPos = timeline.scrollTop;
    const searchOffsets = [-100, 100, -200, 200, -400, 400, -800, 800];

    for (const offset of searchOffsets) {
      timeline.scrollTop = Math.max(0, originalPos + offset);
      await sleep(100);
      entry = findTimelineEntry(timeline, searchText);
      if (entry) {
        entry.click();
        return true;
      }
    }

    // Full timeline search from top
    timeline.scrollTop = 0;
    await sleep(150);

    const maxScroll = timeline.scrollHeight;
    for (let pos = 0; pos < maxScroll; pos += 200) {
      timeline.scrollTop = pos;
      await sleep(80);
      entry = findTimelineEntry(timeline, searchText);
      if (entry) {
        entry.click();
        return true;
      }
    }

    return false;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'dsnoteAttachmentMeta') {
      // The side panel needs the current attachment urls: notes saved before
      // this feature existed have no links in them
      refreshAttachmentMeta().then(() => {
        sendResponse({
          success: true,
          files: Array.from(attachmentMetaCache.values())
        });
      });
      return true;
    }

    if (request.action === 'scrollToMessage') {
      const { scrollRatio, contentPreview, userMessageText, selectionText } = request;

      (async () => {
        // For AI replies, use userMessageText for timeline search
        // For user messages, use contentPreview
        const timelineSearch = userMessageText || (contentPreview || '').slice(0, 50);
        const searchText = (contentPreview || '').slice(0, 50);

        // Method 1: Scroll timeline and click matching entry
        const clicked = await scrollTimelineAndClick(timelineSearch, scrollRatio);

        if (clicked) {
          await sleep(400);
          // Find and highlight the message in main view
          const cleanSearch = searchText.slice(0, 30).replace(/[^\w\u4e00-\u9fff\s]/g, '').trim();
          const found = findMessageByText(cleanSearch);
          if (found) {
            focusNote(found, selectionText);
          }
          sendResponse({ success: true });
          return;
        }

        // Method 2: Fallback - scroll main container
        const scrollContainer = document.querySelector('.ds-virtual-list');
        if (!scrollContainer) {
          sendResponse({ success: false });
          return;
        }

        const cleanSearch = searchText.slice(0, 30).replace(/[^\w\u4e00-\u9fff\s]/g, '').trim();
        let found = null;

        if (scrollRatio >= 0 && scrollRatio <= 1) {
          const targetPos = scrollRatio * scrollContainer.scrollHeight;
          scrollContainer.scrollTop = targetPos;
          await sleep(300);
          found = findMessageByText(cleanSearch);
        }

        if (found) {
          focusNote(found, selectionText);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
      })();

      return true;
    }
    // other actions are handled elsewhere (background / side panel): do not
    // hold the message channel open
    return false;
  });

  function findMessageByText(searchText) {
    if (!searchText || searchText.length < 5) return null;
    const messages = document.querySelectorAll('.ds-message');
    for (const msg of messages) {
      // Normalize text for comparison
      const msgText = (msg.innerText || '').replace(/[^\w\u4e00-\u9fff\s]/g, '');
      if (msgText.includes(searchText)) {
        return msg;
      }
    }
    return null;
  }

  // === Highlight the noted text after jumping back ===
  const HL_HOLD_MS = 1200;
  const HL_NAMES = ['ds-notes-light', 'ds-notes-dark'];
  let hlTimers = [];

  function supportsHighlightApi() {
    return typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';
  }

  // Detect the page theme from the body background luminance
  function isDarkPage() {
    const bg = getComputedStyle(document.body).backgroundColor || '';
    const m = bg.match(/[\d.]+/g);
    if (!m || m.length < 3) return true;
    const [r, g, b] = m.slice(0, 3).map(Number);
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }

  function clearHighlight() {
    hlTimers.forEach(clearTimeout);
    hlTimers = [];
    if (supportsHighlightApi()) HL_NAMES.forEach(n => CSS.highlights.delete(n));
    document.querySelectorAll('.ds-notes-hl-fallback').forEach(el => {
      el.style.backgroundColor = el.dataset.dsHlBg || '';
      el.classList.remove('ds-notes-hl-fallback');
      delete el.dataset.dsHlBg;
    });
  }

  function showHighlight(target) {
    clearHighlight();
    if (target instanceof Range && supportsHighlightApi()) {
      const name = isDarkPage() ? 'ds-notes-dark' : 'ds-notes-light';
      CSS.highlights.set(name, new Highlight(target));
    } else if (target instanceof Element) {
      target.dataset.dsHlBg = target.style.backgroundColor || '';
      target.style.backgroundColor = isDarkPage() ? '#92400e' : '#fde68a';
      target.classList.add('ds-notes-hl-fallback');
    }
    hlTimers.push(setTimeout(clearHighlight, HL_HOLD_MS));
  }

  // Locate `needle` inside `root` as a Range, without mutating the DOM
  const BLOCK_DISPLAYS = new Set([
    'block', 'flow-root', 'list-item', 'table', 'table-row', 'table-row-group',
    'table-header-group', 'table-footer-group', 'table-cell', 'table-caption',
    'flex', 'grid'
  ]);

  // Nearest block-level ancestor of a text node (cached per parent element)
  function blockAncestor(node, root, cache) {
    const parent = node.parentElement;
    if (!parent) return root;
    const cached = cache.get(parent);
    if (cached) return cached;
    let el = parent;
    let found = root;
    while (el && el !== root) {
      if (BLOCK_DISPLAYS.has(getComputedStyle(el).display)) { found = el; break; }
      el = el.parentElement;
    }
    cache.set(parent, found);
    return found;
  }

  const norm = s => (s || '').replace(/\s+/g, ' ').trim();

  // Flatten `root`'s text into one string with a separator at every block
  // boundary, plus a map from string index -> { node, offset }.
  // Both the saved selection text and the jump-time search use this, so they
  // stay consistent even when the DOM holds duplicated or hidden nodes
  // (KaTeX renders each formula twice) or <br> (which adds no text node).
  function flattenText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const blocks = new Map();
    let combined = '';
    const map = []; // map[i] -> { node, offset } for combined[i]
    let block = null;
    let lastNode = null;
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      const b = blockAncestor(node, root, blocks);
      if (block !== null && b !== block) {
        combined += '\n';
        map.push({ node: lastNode, offset: lastNode.nodeValue.length });
      }
      block = b;
      lastNode = node;
      for (let i = 0; i < node.nodeValue.length; i++) {
        combined += node.nodeValue[i];
        map.push({ node, offset: i });
      }
    }
    return { combined, map, lastNode };
  }

  // Read the note's selection text from the DOM using the same flattening as
  // jump time, instead of Selection.toString() (whose rendering differs).
  function selectionTextFromDom(messageEl) {
    const sel = window.getSelection();
    if (!messageEl || !sel || !sel.rangeCount) return null;
    const { combined, map } = flattenText(messageEl);
    if (!combined) return null;

    const nodeStart = new Map();
    for (let i = 0; i < map.length; i++) {
      if (!nodeStart.has(map[i].node)) nodeStart.set(map[i].node, i - map[i].offset);
    }
    const toIndex = (n, off) => {
      const start = nodeStart.get(n);
      return start === undefined ? -1 : start + off;
    };

    const range = sel.getRangeAt(0);
    const a = toIndex(range.startContainer, range.startOffset);
    const b = toIndex(range.endContainer, range.endOffset);
    if (a < 0 || b < 0 || b <= a) return null;
    return norm(combined.slice(a, b));
  }

  function findTextRange(root, needle) {
    const target = norm(needle);
    if (target.length < 2) return null;

    const { combined, map, lastNode } = flattenText(root);
    if (!combined) return null;

    // Whitespace-normalized view of `combined`, plus a map back into it
    let normText = '';
    const normMap = [];
    let prevSpace = false;
    for (let i = 0; i < combined.length; i++) {
      const ch = combined[i];
      if (/\s/.test(ch)) {
        if (prevSpace) continue;
        prevSpace = true;
        normText += ' ';
      } else {
        prevSpace = false;
        normText += ch;
      }
      normMap.push(i);
    }

    let hit = normText.indexOf(target);
    let hitLen = target.length;
    if (hit === -1) {
      // The full string did not match; shrink to the longest matching prefix so
      // we still highlight a meaningful leading chunk rather than a fragment.
      let k = Math.floor(target.length * 0.75);
      while (k > 5) {
        hit = normText.indexOf(target.slice(0, k));
        if (hit !== -1) { hitLen = k; break; }
        k = Math.floor(k * 0.75);
      }
      if (hit === -1) return null;
    }

    const start = map[normMap[hit]];
    const endIdx = normMap[hit + hitLen - 1] + 1;
    const end = map[endIdx] || { node: lastNode, offset: lastNode.nodeValue.length };
    if (!start || !end) return null;

    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      return range;
    } catch (e) {
      return null;
    }
  }

  // Center the given range within the conversation scroll container
  function scrollToRange(range) {
    const container = document.querySelector('.ds-virtual-list');
    if (!container) {
      range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const rect = range.getBoundingClientRect();
    const crect = container.getBoundingClientRect();
    const top = container.scrollTop + (rect.top - crect.top) - (crect.height - rect.height) / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  // Bring the noted text into view and flash-highlight just that text
  function focusNote(messageEl, selectionText) {
    const range = selectionText ? findTextRange(messageEl, selectionText) : null;
    if (range) {
      scrollToRange(range);
      showHighlight(range);
    } else {
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showHighlight(messageEl);
    }
  }

  // Drop the highlight as soon as the page is hidden, so a throttled timer
  // can never leave it stuck on screen
  document.addEventListener('visibilitychange', clearHighlight);

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  console.log('[DS Note] Selection mode loaded');
})();
