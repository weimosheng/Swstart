# 笙维起始页 (Shengwei Start)

一个简洁美观的 Edge 浏览器新标签页起始页扩展，基于 Manifest V3 开发。

## 功能

- **时钟与问候** — 实时显示时间、日期和时段问候
- **多搜索引擎** — 支持百度、Google、Bing、DuckDuckGo，点击输入框左侧切换
- **搜索联想** — 输入时自动获取关键词建议，支持键盘导航
- **快捷导航** — 自定义常用网站快捷方式，支持拖拽链接添加
  - 自动获取网页标题和网站图标
  - 右键菜单编辑/删除
  - 悬停显示完整名称
- **壁纸自定义**
  - Bing 每日壁纸（最近 8 张可选）
  - 本地图片上传（支持拖拽）
  - 远程链接壁纸
  - 一键恢复默认
- **沉浸式搜索** — 聚焦输入框时背景模糊放大，快捷导航淡出

## 安装

### 从源码安装

1. 克隆仓库
   ```bash
   git clone https://github.com/your-username/EdgeHomepageExtension.git
   ```
2. 打开 Edge，访问 `edge://extensions/`
3. 开启「开发人员模式」
4. 点击「加载解压缩的扩展」，选择项目目录

### 从 ZIP 安装

1. 下载最新的 [Release](../../releases) 中的 ZIP 文件
2. 解压到任意目录
3. 按上述步骤加载扩展

## 项目结构

```
├── manifest.json      # 扩展清单（Manifest V3）
├── background.js      # Service Worker（API 请求中转）
├── newtab.html        # 新标签页 HTML
├── style.css          # 样式
├── script.js          # 前端逻辑
└── icons/             # 扩展图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 技术说明

- **Manifest V3** — 使用 Service Worker 处理跨域请求（Bing 壁纸 API、搜索联想 API、网页标题/图标获取），绕过 CORS 限制
- **Bing 壁纸** — 通过 `HPImageArchive.aspx` API 获取，按 URL 匹配选中状态，避免每日刷新后索引错位
- **搜索联想** — 百度（GBK 编码解析）、Bing、Google 三个引擎支持，200ms 防抖
- **网站图标** — 直接从目标网站 HTML 解析 `<link rel="icon">` 标签，回退 `/favicon.ico`，自动尝试 http/https 协议切换
- **所有数据**@ — 通过 `chrome.storage.local` 持久化，刷新后自动恢复

## 许可

MIT License
