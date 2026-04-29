// DS Note - Content Script
// Shows save button when text is selected

(function() {
  'use strict';

  const SETTINGS_KEY = 'ds_notes_settings';
  const SAVE_BTN_ID = 'ds-notes-selection-btn';
  let lang = 'en';

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
      copyFail: 'Copy failed'
    },
    zh: {
      save: '📌 保存',
      saved: '已保存！',
      saveFail: '保存失败',
      noContent: '无内容可保存',
      exportAll: '📤 导出全部',
      formatMd: '📄 Markdown',
      formatJsonl: '📋 JSONL',
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
      copyFail: '复制失败'
    }
  };

  function t(key) {
    return i18n[lang][key] || i18n.en[key] || key;
  }

  // Load language setting
  async function loadLang() {
    const r = await chrome.storage.local.get([SETTINGS_KEY]);
    lang = r[SETTINGS_KEY]?.lang || 'en';
    updateAllText();
  }

  // Listen for language changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_KEY]?.newValue?.lang) {
      lang = changes[SETTINGS_KEY].newValue.lang;
      updateAllText();
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
    if (toggleSelect && !messageSelectMode) toggleSelect.textContent = t('select');
    if (toggleSelect && messageSelectMode) toggleSelect.textContent = t('cancel');
    if (exportSelected) exportSelected.textContent = `${t('selected')} (${selectedMsgIds.size})`;
  }

  loadLang();

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
      searchText: messageEl?.innerText?.trim().slice(0, 150) || plainText.slice(0, 150),
      userMessageText: userMessageText,
      role: role,
      conversationUrl: window.location.href,
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
    // AI messages typically have "已思考" or multiple .ds-markdown sections
    const hasThinking = el.innerText?.includes('已思考');
    const markdowns = el.querySelectorAll('.ds-markdown');

    if (hasThinking || markdowns.length > 1) {
      return 'assistant';
    }

    // Check parent class - collect all unique parent classes
    const allMsgs = document.querySelectorAll('.ds-message');
    const parentClasses = new Map();

    for (const msg of allMsgs) {
      const pc = msg.parentElement?.className?.split(' ')[0];
      if (pc) {
        parentClasses.set(pc, (parentClasses.get(pc) || 0) + 1);
      }
    }

    // If we have two parent classes, the less common one is likely user (fewer user messages typically)
    const myParentClass = el.parentElement?.className?.split(' ')[0];

    if (parentClasses.size === 2) {
      const entries = Array.from(parentClasses.entries());
      // User messages are typically fewer, or check content
      const [class1, count1] = entries[0];
      const [class2, count2] = entries[1];

      // If this message's parent is the less common class, likely user
      if (myParentClass === class1 && count1 < count2) return 'user';
      if (myParentClass === class2 && count2 < count1) return 'user';

      // Fallback: check if has .ds-markdown (AI has it, user might not)
      if (!el.querySelector('.ds-markdown')) return 'user';
    }

    // Default based on .ds-markdown presence
    return el.querySelector('.ds-markdown') ? 'assistant' : 'user';
  }

  function htmlToMarkdown(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);

    // Remove thinking/collapsed sections
    clone.querySelectorAll('.ds-thinking, .ds-collapse').forEach(e => e.remove());

    function convert(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';

      const tag = node.tagName.toLowerCase();

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
          return `![${alt}](${src})`;
        }
        case 'div': case 'span': case 'section':
          return children;
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

  function saveMessageContent(messageEl, btn) {
    const markdowns = messageEl.querySelectorAll('.ds-markdown');
    const markdown = markdowns.length > 0 ? markdowns[markdowns.length - 1] : null;
    const content = markdown ? htmlToMarkdown(markdown) : messageEl.innerText.trim();
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
      searchText: rawText.slice(0, 150),
      userMessageText: userMessageText, // For timeline search
      role: role,
      conversationUrl: window.location.href,
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

      const markdown = el.querySelector('.ds-markdown');
      if (!markdown) return;

      const content = markdown.innerText.trim();
      if (content.length < 10) return;

      if (el.querySelector(`.${MSG_BTN_CLASS}`)) return;

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
      padding: 6px 6px;
      border-left: 1px solid #444;
      font-size: 9px;
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
    document.getElementById('ds-export-all').onclick = () => exportAllConversation('md');
    document.getElementById('ds-export-md').onclick = () => { exportAllConversation('md'); menu.style.display = 'none'; };
    document.getElementById('ds-export-jsonl').onclick = () => { exportAllConversation('jsonl'); menu.style.display = 'none'; };
    document.getElementById('ds-export-selected').onclick = exportSelectedMessages;
    document.getElementById('ds-toggle-select').onclick = toggleMessageSelect;
  }

  let messageSelectMode = false;
  let selectedMsgIds = new Set();

  function toggleMessageSelect() {
    messageSelectMode = !messageSelectMode;
    const btn = document.getElementById('ds-toggle-select');
    const exportSelBtn = document.getElementById('ds-export-selected');

    if (messageSelectMode) {
      btn.textContent = t('cancel');
      btn.style.background = '#dc2626';
      btn.classList.add('active-select');
      exportSelBtn.style.display = 'block';
      addMessageCheckboxes(true); // Auto-select latest
    } else {
      btn.textContent = t('select');
      btn.style.background = '#444';
      btn.classList.remove('active-select');
      exportSelBtn.style.display = 'none';
      selectedMsgIds.clear();
      removeMessageCheckboxes();
    }
  }

  function addMessageCheckboxes(autoSelectLatest = false) {
    const containers = document.querySelectorAll('.ds-message');
    const validContainers = [];

    containers.forEach((el, idx) => {
      if (el.querySelector('.ds-msg-checkbox')) return;
      const markdown = el.querySelector('.ds-markdown');
      if (!markdown) return;

      validContainers.push({ el, idx });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'ds-msg-checkbox';
      cb.dataset.idx = idx;
      cb.style.cssText = `
        position: absolute;
        top: 8px;
        left: -24px;
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #3b82f6;
      `;

      cb.onchange = () => {
        if (cb.checked) {
          selectedMsgIds.add(idx);
          el.style.background = 'rgba(59, 130, 246, 0.1)';
        } else {
          selectedMsgIds.delete(idx);
          el.style.background = '';
        }
        updateExportSelectedBtn();
      };

      el.style.setProperty('position', 'relative', 'important');
      el.insertBefore(cb, el.firstChild);
    });

    // Auto-select latest message
    if (autoSelectLatest && validContainers.length > 0) {
      const latest = validContainers[validContainers.length - 1];
      const cb = latest.el.querySelector('.ds-msg-checkbox');
      if (cb) {
        cb.checked = true;
        selectedMsgIds.add(latest.idx);
        latest.el.style.background = 'rgba(59, 130, 246, 0.1)';
        updateExportSelectedBtn();
      }
    }
  }

  function removeMessageCheckboxes() {
    document.querySelectorAll('.ds-msg-checkbox').forEach(cb => {
      cb.parentElement.style.background = '';
      cb.remove();
    });
  }

  function updateExportSelectedBtn() {
    const btn = document.getElementById('ds-export-selected');
    btn.textContent = `${t('selected')} (${selectedMsgIds.size})`;
  }

  function extractConversation(onlySelected = false) {
    const msgEls = document.querySelectorAll('.ds-message');
    const messages = [];
    const seen = new Set();

    // Detect user class by first message's parent (user always starts)
    let userParentClass = null;
    if (msgEls.length > 0) {
      const firstParent = msgEls[0].parentElement;
      if (firstParent) {
        userParentClass = firstParent.className?.split(' ')[0];
      }
    }

    msgEls.forEach((el, idx) => {
      if (onlySelected && !selectedMsgIds.has(idx)) return;

      // Determine role by parent class
      let role = 'assistant';
      const parent = el.parentElement;
      if (parent && userParentClass) {
        const parentFirstClass = parent.className?.split(' ')[0];
        if (parentFirstClass === userParentClass) {
          role = 'user';
        }
      }

      let content = '';

      // AI messages: multiple .ds-markdown, take the LAST one (main response, not thinking)
      const markdowns = el.querySelectorAll('.ds-markdown');
      if (markdowns.length > 0) {
        content = extractTextWithLatex(markdowns[markdowns.length - 1]);
      } else {
        // User messages: no .ds-markdown, get text from first div or element itself
        const firstDiv = el.querySelector('div');
        content = firstDiv ? extractTextWithLatex(firstDiv) : el.innerText.trim();
      }

      if (!content || content.length < 3) return;

      // Dedupe by content prefix
      const key = content.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);

      messages.push({ role, content });
    });

    return messages;
  }

  function messagesToMd(messages, title) {
    let md = `# ${title}\n\nExported: ${new Date().toLocaleString()}\n\n---\n\n`;
    messages.forEach((m, i) => {
      md += `## ${i + 1}. ${m.role.toUpperCase()}\n\n${m.content}\n\n---\n\n`;
    });
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

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function scrollAndCollectAll() {
    const scrollContainer = document.querySelector('.ds-virtual-list');
    if (!scrollContainer) {
      showToast(t('noMessages'), true);
      return null;
    }

    const allMessages = new Map(); // Use map to dedupe by content
    let lastCount = 0;
    let stableCount = 0;

    showToast(t('scanningConvo'));

    // Scroll to top first
    scrollContainer.scrollTop = 0;
    await new Promise(r => setTimeout(r, 500));

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
          // User: take first div
          const firstDiv = el.querySelector('div');
          content = firstDiv ? extractTextWithLatex(firstDiv) : el.innerText.trim();
        }

        if (content.length < 3) return;

        const key = content.slice(0, 100);
        if (!allMessages.has(key)) {
          const role = getMessageRoleFromElement(el);
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
      await new Promise(r => setTimeout(r, 150));
    }

    return Array.from(allMessages.values());
  }

  async function exportAllConversation(format = 'md') {
    const btnId = format === 'jsonl' ? 'ds-export-jsonl' : 'ds-export-all';
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
      const dateStr = new Date().toISOString().slice(0,10);

      if (format === 'jsonl') {
        const jsonl = messagesToJsonl(messages, title);
        downloadFile(jsonl, `deepseek-${dateStr}.jsonl`, 'application/jsonl');
      } else {
        const md = messagesToMd(messages, title);
        downloadFile(md, `deepseek-${dateStr}.md`, 'text/markdown');
      }

      showToast(`${t('exported')} ${messages.length} ${t('messages')}`);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  function exportSelectedMessages() {
    if (!selectedMsgIds.size) {
      showToast(t('noSelected'), true);
      return;
    }
    const messages = extractConversation(true);
    const md = messagesToMd(messages, 'Selected Messages');
    downloadFile(md, `deepseek-selected-${new Date().toISOString().slice(0,10)}.md`, 'text/markdown');
    showToast(`${t('exported')} ${messages.length} ${t('messages')}`);

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
    if (request.action === 'scrollToMessage') {
      const { scrollRatio, contentPreview, userMessageText } = request;

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
            highlightElement(found);
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
          found.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightElement(found);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
      })();

      return true;
    }
    return true;
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

  function highlightElement(el) {
    const originalBg = el.style.backgroundColor;
    el.style.backgroundColor = '#f59e0b';
    el.style.transition = 'background-color 0.3s';
    setTimeout(() => {
      el.style.backgroundColor = originalBg;
    }, 2000);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  console.log('[DS Note] Selection mode loaded');
})();
