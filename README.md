# DeepSeek Notes

A Chrome extension to save, organize, and navigate messages from DeepSeek conversations.

一个用于保存、管理和快速定位 DeepSeek 对话消息的 Chrome 扩展。

---

## Features / 功能

- **Save Messages / 保存消息** - Click the pin icon on any message, or highlight text and save
- **Side Panel / 侧边栏** - View all saved notes in a convenient sidebar
- **Jump to Original / 跳转原文** - Click to navigate back to the original message in conversation
- **Timeline Navigation / 时间轴导航** - Uses DeepSeek's native timeline for precise jumping in long conversations
- **Search & Filter / 搜索过滤** - Search notes, filter by current conversation or starred
- **Star Notes / 收藏笔记** - Mark important notes with stars
- **Export / 导出** - Export notes as Markdown or JSONL
- **Dark/Light Theme / 深色/浅色主题** - Matches your preference
- **Bilingual / 双语支持** - English and Chinese interface

## Installation / 安装

1. Download or clone this repository / 下载或克隆此仓库
2. Open Chrome and go to `chrome://extensions` / 打开 Chrome 进入扩展管理页面
3. Enable "Developer mode" (toggle in top right) / 启用"开发者模式"
4. Click "Load unpacked" / 点击"加载已解压的扩展程序"
5. Select the `deepseek-notes` folder / 选择 `deepseek-notes` 文件夹

## Usage / 使用

1. Go to [chat.deepseek.com](https://chat.deepseek.com)
2. **Save entire message**: Hover over any message and click 📌
3. **Save selected text**: Highlight text and click the save button that appears
4. Click the extension icon to open the notes panel / 点击扩展图标打开笔记面板
5. Click ↗ on any note to jump back to the original message / 点击 ↗ 跳转到原消息

---

1. 访问 [chat.deepseek.com](https://chat.deepseek.com)
2. **保存整条消息**：鼠标悬停在消息上，点击 📌
3. **保存选中文本**：选中文字后点击弹出的保存按钮
4. 点击扩展图标打开侧边栏
5. 点击笔记上的 ↗ 可跳转回原始消息位置

## File Structure / 文件结构

```
deepseek-notes/
├── manifest.json       # Extension configuration
├── background.js       # Service worker for storage
├── content-script.js   # Save buttons & jump logic
├── icons/              # Extension icons
├── sidepanel/          # Notes panel UI
│   ├── sidepanel.html
│   ├── sidepanel.js
│   └── sidepanel.css
└── styles/
    └── content.css     # Injected styles
```

## Notes / 说明

- Data is stored locally in your browser (`chrome.storage.local`)
- No external servers or data collection / 无外部服务器，不收集数据
- Works only on chat.deepseek.com / 仅在 chat.deepseek.com 上工作
- Side panel only appears on DeepSeek tabs / 侧边栏仅在 DeepSeek 标签页显示

## License / 许可

MIT
