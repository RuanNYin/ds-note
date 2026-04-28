// DeepSeek Notes - Background Service Worker

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

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;

  if (action === 'saveMessage') {
    addMessage(request.message)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (action === 'deleteMessage') {
    deleteMessage(request.id)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (action === 'getMessages') {
    getMessages()
      .then(messages => sendResponse({ success: true, messages }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (action === 'clearAll') {
    clearAllMessages()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
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

console.log('[DeepSeek Notes] Service worker loaded');
