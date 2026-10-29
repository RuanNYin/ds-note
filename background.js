// DS Note - Background Service Worker

const STORAGE_KEY = 'ds_saved_messages';

// Storage helpers
async function getMessages() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || [];
}

async function saveMessages(messages) {
  await chrome.storage.local.set({ [STORAGE_KEY]: messages });
}

async function addMessage(message) {
  const messages = await getMessages();
  messages.unshift(message); // Add to beginning
  await saveMessages(messages);
  return true;
}

async function deleteMessage(id) {
  const messages = await getMessages();
  const filtered = messages.filter(m => m.id !== id);
  await saveMessages(filtered);
  return true;
}

async function clearAllMessages() {
  await saveMessages([]);
  return true;
}

// === Attachment bundling + ZIP export ===

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Minimal ZIP writer (stored entries, no compression) - keeps the extension
// dependency-free
function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);   // local file header
    lv.setUint16(4, 20, true);           // version needed
    lv.setUint16(6, 0x0800, true);       // UTF-8 names
    lv.setUint16(8, 0, true);            // method: stored
    lv.setUint16(10, 0, true);           // time
    lv.setUint16(12, 0x21, true);        // date (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    parts.push(local, data);
    central.push({ name, crc, size: data.length, offset });
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + 46 + c.name.length, 0);
  const cd = new Uint8Array(centralSize);
  const cv = new DataView(cd.buffer);
  let p = 0;
  for (const c of central) {
    cv.setUint32(p, 0x02014b50, true);   // central file header
    cv.setUint16(p + 4, 20, true);
    cv.setUint16(p + 6, 20, true);
    cv.setUint16(p + 8, 0x0800, true);
    cv.setUint16(p + 10, 0, true);
    cv.setUint16(p + 12, 0, true);
    cv.setUint16(p + 14, 0x21, true);
    cv.setUint32(p + 16, c.crc, true);
    cv.setUint32(p + 20, c.size, true);
    cv.setUint32(p + 24, c.size, true);
    cv.setUint16(p + 28, c.name.length, true);
    cv.setUint16(p + 30, 0, true);
    cv.setUint16(p + 32, 0, true);
    cv.setUint16(p + 34, 0, true);
    cv.setUint16(p + 36, 0, true);
    cv.setUint32(p + 38, 0, true);
    cv.setUint32(p + 42, c.offset, true);
    cd.set(c.name, p + 46);
    p += 46 + c.name.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);     // end of central directory
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...parts, cd, eocd], { type: 'application/zip' });
}

function sanitizeFileName(name) {
  return (name || 'attachment')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/^\.+/, '')
    .trim() || 'attachment';
}

// Download every remote attachment referenced by the markdown and rewrite the
// links to the bundled copies. Links that cannot be fetched are left as they
// are, so the export never loses content.
async function bundleAttachments(md) {
  const LINK_RE = /(!?\[[^\]]*\])\((https:\/\/files\.deepseeksvc\.com[^)]*)\)/g;
  const hits = [];
  let m;
  while ((m = LINK_RE.exec(md))) hits.push({ label: m[1], url: m[2] });
  if (!hits.length) return { md, files: [] };

  const files = [];
  const byUrl = new Map();
  for (const h of hits) {
    if (byUrl.has(h.url)) continue;
    try {
      const res = await fetch(h.url);
      if (!res.ok) continue;
      const data = new Uint8Array(await res.arrayBuffer());
      if (!data.length) continue;
      const label = h.label.replace(/^!?\[|\]$/g, '').trim();
      let name = sanitizeFileName(label);
      let n = 1;
      while (files.some(f => f.name === name)) name = `${n++}-${name}`;
      byUrl.set(h.url, name);
      files.push({ name, data });
    } catch (e) {
      // leave the remote link in place
    }
  }

  let out = md;
  for (const [url, name] of byUrl) {
    out = out.split(url).join(`assets/${name}`);
  }
  return { md: out, files };
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Build a zip holding the markdown plus every attachment it references.
async function buildAttachmentZip(md, baseName) {
  const bundled = await bundleAttachments(md);
  const zipName = sanitizeFileName(baseName) + '.md';
  const zip = buildZip([
    { name: zipName, data: new TextEncoder().encode(bundled.md) },
    ...bundled.files.map(f => ({ name: `assets/${f.name}`, data: f.data }))
  ]);
  const buf = new Uint8Array(await zip.arrayBuffer());
  return {
    base64: bytesToBase64(buf),
    filename: sanitizeFileName(baseName) + '.zip',
    bundledCount: bundled.files.length
  };
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;

  // Every branch must answer exactly once - a listener that returns without
  // responding leaves the caller waiting forever.
  const respond = (payload) => {
    try {
      sendResponse(payload);
    } catch (e) {
      console.error('[DS Note] sendResponse failed', action, e);
    }
  };

  try {
    if (action === 'saveMessage') {
      addMessage(request.message)
        .then(() => respond({ success: true }))
        .catch(err => respond({ success: false, error: String(err && err.message || err) }));
      return true; // Keep channel open for async response
    }

    if (action === 'deleteMessage') {
      deleteMessage(request.id)
        .then(() => respond({ success: true }))
        .catch(err => respond({ success: false, error: String(err && err.message || err) }));
      return true;
    }

    if (action === 'getMessages') {
      getMessages()
        .then(messages => respond({ success: true, messages }))
        .catch(err => respond({ success: false, error: String(err && err.message || err) }));
      return true;
    }

    if (action === 'clearAll') {
      clearAllMessages()
        .then(() => respond({ success: true }))
        .catch(err => respond({ success: false, error: String(err && err.message || err) }));
      return true;
    }

    if (action === 'buildZip') {
      buildAttachmentZip(request.md, request.baseName || 'export')
        .then(zip => respond({ success: true, ...zip }))
        .catch(err => respond({ success: false, error: String(err && err.message || err) }));
      return true;
    }

    respond({ success: false, error: `unknown action: ${action}` });
  } catch (e) {
    console.error('[DS Note] message handler crashed', action, e);
    respond({ success: false, error: String(e && e.message || e) });
  }
});

// Enable/disable side panel based on URL
function updateSidePanelForTab(tabId, url) {
  const isDeepSeek = url?.includes('chat.deepseek.com');
  chrome.sidePanel.setOptions({
    tabId,
    path: 'sidepanel/sidepanel.html',
    enabled: isDeepSeek
  });
}

// Listen for URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateSidePanelForTab(tabId, tab.url);
  }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateSidePanelForTab(activeInfo.tabId, tab.url);
  } catch (e) {
    // Tab might not exist
  }
});

// Open side panel when clicking extension icon (only works on enabled tabs)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('[DS Note] Service worker loaded');
