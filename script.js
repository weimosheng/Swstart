const DEFAULT_SHORTCUTS = [
  { name: '百度',       url: 'https://www.baidu.com',        color: '#2932e1' },
  { name: 'GitHub',     url: 'https://github.com',           color: '#333' },
  { name: 'Bilibili',   url: 'https://www.bilibili.com',     color: '#fb7299' },
  { name: '知乎',       url: 'https://www.zhihu.com',        color: '#0084ff' },
  { name: '微博',       url: 'https://weibo.com',            color: '#e6162d' },
  { name: '淘宝',       url: 'https://www.taobao.com',       color: '#ff5000' },
  { name: 'YouTube',    url: 'https://www.youtube.com',      color: '#ff0000' },
  { name: 'ChatGPT',    url: 'https://chat.openai.com',      color: '#10a37f' },
];

const ENGINES = {
  baidu:     { name: '百度',     url: 'https://www.baidu.com/s?wd=' },
  google:    { name: 'Google',  url: 'https://www.google.com/search?q=' },
  bing:      { name: 'Bing',    url: 'https://www.bing.com/search?q=' },
  duckduckgo:{ name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
};

let currentEngine = 'baidu';
let shortcuts = [];
let wallpaperState = { type: 'default', url: '', bingIndex: -1 };

const DEFAULT_SETTINGS = {
  clock24h: true,
  clockShowSeconds: true,
  clockShowDate: true,
  clockShowGreeting: true,
  searchFocusBlur: true,
  wallpaperDim: 55,
  showShortcuts: true,
};
let appSettings = { ...DEFAULT_SETTINGS };

document.addEventListener('DOMContentLoaded', () => {
  loadSettings(() => {
    renderShortcuts();
  });
  initClock();
  initSearch();
  initModal();
  initAddShortcut();
  initWallpaper();
  initDragLink();
  initSettingsPanel();
});

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const greetingEl = document.getElementById('greeting');

  if (appSettings.clock24h) {
    clockEl.textContent = appSettings.clockShowSeconds ? `${String(h).padStart(2, '0')}:${m}:${s}` : `${String(h).padStart(2, '0')}:${m}`;
  } else {
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    clockEl.textContent = appSettings.clockShowSeconds ? `${h}:${m}:${s} ${ampm}` : `${h}:${m} ${ampm}`;
  }

  if (appSettings.clockShowDate) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;
    dateEl.style.display = '';
  } else {
    dateEl.style.display = 'none';
  }

  if (appSettings.clockShowGreeting) {
    const hour = now.getHours();
    let greeting = '晚上好';
    if (hour < 6) greeting = '凌晨好';
    else if (hour < 9) greeting = '早上好';
    else if (hour < 12) greeting = '上午好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 18) greeting = '下午好';
    greetingEl.textContent = greeting;
    greetingEl.style.display = '';
  } else {
    greetingEl.style.display = 'none';
  }
}

function initSearch() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const trigger = document.getElementById('engineTrigger');
  const dropdown = document.getElementById('engineDropdown');
  const label = document.getElementById('engineLabel');

  chrome.storage.local.get('searchEngine', (data) => {
    if (data.searchEngine && ENGINES[data.searchEngine]) {
      currentEngine = data.searchEngine;
    }
    updateEngineUI();
    document.getElementById('settingSearchEngine').value = currentEngine;
  });

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.engine-dropdown-item');
    if (!item) return;

    currentEngine = item.dataset.engine;
    chrome.storage.local.set({ searchEngine: currentEngine });
    updateEngineUI();
    dropdown.classList.remove('show');
    input.focus();
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('engineSwitcher').contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });

  input.addEventListener('focus', () => {
    activateSearchFocus();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      deactivateSearchFocus();
    }, 200);
  });

  document.querySelectorAll('.engine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEngine = btn.dataset.engine;
      chrome.storage.local.set({ searchEngine: currentEngine });
      updateEngineUI();
      input.focus();
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    hideSuggestions();
    doSearch(query);
  });

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query) {
      input.classList.add('has-content');
    } else {
      input.classList.remove('has-content');
    }
    if (!query) {
      hideSuggestions();
      return;
    }
    debounceFetchSuggestions(query, currentEngine);
  });

  input.addEventListener('focus', () => {
    activateSearchFocus();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      deactivateSearchFocus();
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSuggestion(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Escape') {
      hideSuggestions();
      return;
    }
    if (e.key === 'Enter') {
      const activeItem = document.querySelector('.suggestion-item.active');
      if (activeItem) {
        e.preventDefault();
        const text = activeItem.dataset.text;
        input.value = text;
        hideSuggestions();
        doSearch(text);
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) {
      hideSuggestions();
    }
  });
}

function doSearch(query) {
  if (/^(https?:\/\/|www\.)/.test(query) || /^[\w-]+(\.[\w-]+)+/.test(query)) {
    const url = query.startsWith('http') ? query : 'https://' + query;
    window.location.href = url;
  } else {
    window.location.href = ENGINES[currentEngine].url + encodeURIComponent(query);
  }
}

let suggestTimer = null;
let currentSuggestions = [];
let activeSuggestionIndex = -1;

function debounceFetchSuggestions(query, engine) {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => {
    fetchSuggestions(query, engine);
  }, 200);
}

function fetchSuggestions(query, engine) {
  const supportedEngines = ['baidu', 'bing', 'google'];
  const eng = supportedEngines.includes(engine) ? engine : 'baidu';

  chrome.runtime.sendMessage({ type: 'fetchSuggestions', query, engine: eng }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      return;
    }
    currentSuggestions = response.suggestions || [];
    activeSuggestionIndex = -1;
    renderSuggestions(query, currentSuggestions);
  });
}

function renderSuggestions(query, suggestions) {
  const container = document.getElementById('suggestions');

  if (!suggestions || suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  container.innerHTML = '';

  suggestions.forEach((text, index) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.dataset.text = text;
    item.dataset.index = index;

    const highlighted = highlightMatch(text, query);

    item.innerHTML = `
      <span class="suggestion-icon">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="suggestion-text">${highlighted}</span>
      <span class="suggestion-fill">↵</span>
    `;

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const input = document.getElementById('searchInput');
      input.value = text;
      hideSuggestions();
      doSearch(text);
    });

    item.addEventListener('mouseenter', () => {
      setActiveSuggestion(index);
    });

    container.appendChild(item);
  });

  container.classList.add('show');
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, idx));
  const match = escapeHtml(text.slice(idx, idx + query.length));
  const after = escapeHtml(text.slice(idx + query.length));
  return `${before}<em>${match}</em>${after}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function navigateSuggestion(direction) {
  const items = document.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  activeSuggestionIndex += direction;
  if (activeSuggestionIndex < 0) activeSuggestionIndex = items.length - 1;
  if (activeSuggestionIndex >= items.length) activeSuggestionIndex = 0;

  setActiveSuggestion(activeSuggestionIndex);

  const input = document.getElementById('searchInput');
  input.value = items[activeSuggestionIndex].dataset.text;
}

function setActiveSuggestion(index) {
  const items = document.querySelectorAll('.suggestion-item');
  items.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });
  activeSuggestionIndex = index;
}

function hideSuggestions() {
  const container = document.getElementById('suggestions');
  container.classList.remove('show');
  container.innerHTML = '';
  currentSuggestions = [];
  activeSuggestionIndex = -1;
}

function activateSearchFocus() {
  const input = document.getElementById('searchInput');
  const container = document.querySelector('.container');
  const overlay = document.getElementById('searchFocusOverlay');

  container.classList.add('search-active');
  if (appSettings.searchFocusBlur) {
    overlay.classList.add('active');
    document.body.classList.add('search-active');
  }
  if (input.value.trim()) {
    input.classList.add('has-content');
  }
}

function deactivateSearchFocus() {
  const input = document.getElementById('searchInput');
  const container = document.querySelector('.container');
  const overlay = document.getElementById('searchFocusOverlay');

  input.classList.remove('has-content');
  container.classList.remove('search-active');
  overlay.classList.remove('active');
  document.body.classList.remove('search-active');
}

function updateEngineUI() {
  const label = document.getElementById('engineLabel');
  document.querySelectorAll('.engine-dropdown-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.engine === currentEngine);
  });
  if (label && ENGINES[currentEngine]) {
    label.textContent = ENGINES[currentEngine].name;
  }
  requestAnimationFrame(() => {
    const switcher = document.getElementById('engineSwitcher');
    const input = document.getElementById('searchInput');
    if (switcher && input) {
      const switcherWidth = switcher.offsetWidth;
      input.style.paddingLeft = (switcherWidth + 16) + 'px';
    }
  });
}

function loadSettings(cb) {
  chrome.storage.local.get(['shortcuts', 'appSettings', 'searchEngine'], (data) => {
    shortcuts = data.shortcuts || [...DEFAULT_SHORTCUTS];
    if (data.appSettings) {
      appSettings = { ...DEFAULT_SETTINGS, ...data.appSettings };
    }
    if (data.searchEngine && ENGINES[data.searchEngine]) {
      currentEngine = data.searchEngine;
    }
    applyShortcutsVisibility();
    if (cb) cb();
  });
}

function saveShortcuts(cb) {
  chrome.storage.local.set({ shortcuts }, cb);
}

function renderShortcuts() {
  const grid = document.getElementById('shortcutsGrid');
  grid.innerHTML = '';

  shortcuts.forEach((item, index) => {
    const el = document.createElement('a');
    el.className = 'shortcut-item';
    el.href = item.url;
    el.target = '_self';

    const initial = item.name.charAt(0).toUpperCase();

    let iconHtml = '';
    let iconStyle = '';
    if (item.iconUrl) {
      iconHtml = `<img src="${item.iconUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="icon-letter" style="display:none">${initial}</span>`;
      iconStyle = 'background: transparent';
    } else {
      iconHtml = initial;
      iconStyle = `background: ${item.color}`;
    }

    el.innerHTML = `
      <div class="shortcut-icon" style="${iconStyle}">${iconHtml}</div>
      <span class="shortcut-name">${item.name}</span>
    `;

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showShortcutMenu(e, index);
    });

    const nameEl = el.querySelector('.shortcut-name');
    let tooltipTimer = null;
    let tooltipEl = null;

    el.addEventListener('mouseenter', () => {
      tooltipTimer = setTimeout(() => {
        if (nameEl.scrollWidth > nameEl.clientWidth) {
          tooltipEl = document.createElement('div');
          tooltipEl.className = 'shortcut-tooltip';
          tooltipEl.textContent = item.name;
          el.appendChild(tooltipEl);
          requestAnimationFrame(() => {
            tooltipEl.classList.add('show');
          });
        }
      }, 500);
    });

    el.addEventListener('mouseleave', () => {
      clearTimeout(tooltipTimer);
      if (tooltipEl) {
        tooltipEl.classList.remove('show');
        setTimeout(() => {
          if (tooltipEl && tooltipEl.parentNode) {
            tooltipEl.remove();
          }
          tooltipEl = null;
        }, 200);
      }
    });

    grid.appendChild(el);
  });
}

let modalMode = 'add';
let editIndex = -1;

function initModal() {
  const overlay = document.getElementById('modalOverlay');
  const cancel = document.getElementById('modalCancel');
  const confirm = document.getElementById('modalConfirm');
  const fetchTitleBtn = document.getElementById('fetchTitleBtn');
  const fetchIconBtn = document.getElementById('fetchIconBtn');
  const iconUrlInput = document.getElementById('shortcutIconUrl');

  cancel.addEventListener('click', () => closeModal());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  confirm.addEventListener('click', () => {
    const name = document.getElementById('shortcutName').value.trim();
    let url = document.getElementById('shortcutUrl').value.trim();
    const iconUrl = iconUrlInput.value.trim();

    if (!name || !url) return;

    if (!url.startsWith('http')) url = 'http://' + url;

    if (modalMode === 'edit' && editIndex >= 0) {
      const item = shortcuts[editIndex];
      shortcuts[editIndex] = { ...item, name, url };
      if (iconUrl) shortcuts[editIndex].iconUrl = iconUrl;
      else delete shortcuts[editIndex].iconUrl;
    } else {
      const hue = Math.floor(Math.random() * 360);
      const color = `hsl(${hue}, 65%, 55%)`;
      const shortcut = { name, url, color };
      if (iconUrl) shortcut.iconUrl = iconUrl;
      shortcuts.push(shortcut);
    }

    saveShortcuts(() => {
      renderShortcuts();
      closeModal();
    });
  });

  fetchTitleBtn.addEventListener('click', () => {
    let url = document.getElementById('shortcutUrl').value.trim();
    if (!url || url === 'http://' || url === 'https://') return;
    if (!url.startsWith('http')) url = 'http://' + url;

    const originalText = fetchTitleBtn.textContent;
    fetchTitleBtn.textContent = '获取中...';
    fetchTitleBtn.classList.add('loading');
    chrome.runtime.sendMessage({ type: 'fetchPageTitle', url }, (response) => {
      fetchTitleBtn.classList.remove('loading');
      fetchTitleBtn.textContent = originalText;
      if (chrome.runtime.lastError || !response || !response.success) {
        return;
      }
      if (response.title) {
        document.getElementById('shortcutName').value = response.title;
        updateIconPreview();
      }
    });
  });

  fetchIconBtn.addEventListener('click', () => {
    let url = document.getElementById('shortcutUrl').value.trim();
    if (!url || url === 'http://' || url === 'https://') {
      fetchIconBtn.textContent = '请先输入网址';
      setTimeout(() => { fetchIconBtn.textContent = '获取图标'; }, 1500);
      return;
    }
    if (!url.startsWith('http')) url = 'http://' + url;

    fetchIconBtn.textContent = '获取中...';
    fetchIconBtn.classList.add('loading');

    let handled = false;
    const timer = setTimeout(() => {
      if (!handled) {
        handled = true;
        fetchIconBtn.classList.remove('loading');
        fetchIconBtn.textContent = '获取图标';
      }
    }, 8000);

    chrome.runtime.sendMessage({ type: 'fetchFavicon', url }, (response) => {
      if (handled) return;
      clearTimeout(timer);
      handled = true;
      fetchIconBtn.classList.remove('loading');
      fetchIconBtn.textContent = '获取图标';

      if (chrome.runtime.lastError || !response || !response.success) {
        return;
      }
      if (response.faviconUrl) {
        const img = new Image();
        img.onload = () => {
          iconUrlInput.value = response.faviconUrl;
          updateIconPreview();
        };
        img.onerror = () => {};
        img.src = response.faviconUrl;
      }
    });
  });

  iconUrlInput.addEventListener('input', () => {
    updateIconPreview();
  });

  document.getElementById('shortcutName').addEventListener('input', () => {
    updateIconPreview();
  });

  document.getElementById('shortcutUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm.click();
  });
  document.getElementById('shortcutName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('shortcutUrl').focus();
  });

  const urlInput = document.getElementById('shortcutUrl');
  urlInput.addEventListener('focus', () => {
    const val = urlInput.value.trim();
    if (!val) {
      urlInput.value = 'http://';
      setTimeout(() => {
        urlInput.setSelectionRange(urlInput.value.length, urlInput.value.length);
      }, 0);
    }
  });
  urlInput.addEventListener('blur', () => {
    const val = urlInput.value.trim();
    if (val === 'http://' || val === 'https://') {
      urlInput.value = '';
    }
  });
}

function updateIconPreview() {
  const preview = document.getElementById('iconPreview');
  const letter = document.getElementById('iconLetter');
  const iconUrl = document.getElementById('shortcutIconUrl').value.trim();
  const name = document.getElementById('shortcutName').value.trim();

  if (iconUrl) {
    preview.innerHTML = `<img src="${iconUrl}" alt="" onerror="this.style.display='none';this.parentElement.querySelector('.icon-letter-fallback').style.display='flex'"><span class="icon-letter-fallback" style="display:none;font-size:18px;font-weight:600;color:var(--text-secondary)">${name ? name.charAt(0).toUpperCase() : '?'}</span>`;
  } else {
    preview.innerHTML = `<span style="font-size:18px;font-weight:600;color:var(--text-secondary)">${name ? name.charAt(0).toUpperCase() : '?'}</span>`;
  }
}

function openModal() {
  modalMode = 'add';
  editIndex = -1;
  document.getElementById('shortcutName').value = '';
  document.getElementById('shortcutUrl').value = '';
  document.getElementById('shortcutIconUrl').value = '';
  document.querySelector('.modal-title').textContent = '添加快捷方式';
  document.getElementById('modalConfirm').textContent = '添加';
  updateIconPreview();
  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('shortcutName').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function initAddShortcut() {
  document.getElementById('addShortcutBtn').addEventListener('click', openModal);
}

// ========== 壁纸功能 ==========
function initWallpaper() {
  const panel = document.getElementById('wallpaperPanel');
  const settingsBtn = document.getElementById('wallpaperSettingsBtn');
  const closeBtn = document.getElementById('wallpaperPanelClose');
  const resetBtn = document.getElementById('wallpaperResetBtn');

  settingsBtn.addEventListener('click', () => {
    panel.classList.add('open');
    loadBingWallpapers();
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  resetBtn.addEventListener('click', () => {
    wallpaperState = { type: 'default', url: '', bingIndex: -1 };
    saveWallpaperState();
    applyWallpaper();
    clearBingSelection();
    clearCustomPreview();
    clearUrlPreview();
  });

  initWallpaperTabs();
  initCustomUpload();
  initUrlWallpaper();
  initAutoBingDaily();

  chrome.storage.local.get('wallpaper', (data) => {
    if (data.wallpaper) {
      wallpaperState = data.wallpaper;
    }
    applyWallpaper();
    checkBingDailyOnLoad();
  });
}

function initWallpaperTabs() {
  document.querySelectorAll('.wallpaper-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wallpaper-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.wallpaper-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const tabId = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
      document.getElementById(tabId).classList.add('active');
    });
  });
}

function applyWallpaper() {
  const layer = document.querySelector('.wallpaper-layer');
  if (!layer) return;

  layer.style.setProperty('--wallpaper-dim', appSettings.wallpaperDim / 100);

  if (wallpaperState.type === 'default' || !wallpaperState.url) {
    layer.classList.remove('visible');
    layer.style.backgroundImage = '';
    document.body.classList.remove('has-wallpaper');
  } else {
    layer.style.backgroundImage = `url("${wallpaperState.url}")`;
    layer.classList.add('visible');
    document.body.classList.add('has-wallpaper');
  }
}

function saveWallpaperState() {
  chrome.storage.local.set({ wallpaper: wallpaperState });
}

// ========== Bing 每日壁纸 ==========
let bingWallpapers = [];

function loadBingWallpapers() {
  const grid = document.getElementById('bingGrid');
  const loading = document.getElementById('bingLoading');

  if (bingWallpapers.length > 0) {
    renderBingGrid();
    return;
  }

  loading.style.display = 'block';
  loading.textContent = '加载中...';
  grid.innerHTML = '';

  let handled = false;

  const timeout = setTimeout(() => {
    if (!handled) {
      handled = true;
      loading.textContent = '后台脚本未响应，请重新加载扩展';
    }
  }, 8000);

  try {
    chrome.runtime.sendMessage({ type: 'fetchBingWallpapers' }, (response) => {
      if (handled) return;
      clearTimeout(timeout);
      handled = true;

      if (chrome.runtime.lastError) {
        loading.textContent = '后台脚本错误：' + chrome.runtime.lastError.message;
        return;
      }
      if (!response || !response.success) {
        loading.textContent = '加载失败：' + (response?.error || '未知错误');
        return;
      }

      bingWallpapers = response.wallpapers;
      if (bingWallpapers.length === 0) {
        loading.textContent = '暂无壁纸数据';
        return;
      }
      loading.style.display = 'none';
      renderBingGrid();
    });
  } catch (e) {
    clearTimeout(timeout);
    handled = true;
    loading.textContent = '消息发送失败，请重新加载扩展';
  }
}

function renderBingGrid() {
  const grid = document.getElementById('bingGrid');
  grid.innerHTML = '';

  const selectedUrl = (wallpaperState.type === 'bing') ? wallpaperState.url : '';

  bingWallpapers.forEach((wp, index) => {
    const item = document.createElement('div');
    item.className = 'bing-item';
    if (selectedUrl && wp.url === selectedUrl) {
      item.classList.add('selected');
      wallpaperState.bingIndex = index;
    }

    item.innerHTML = `
      <img src="${wp.url}" alt="${wp.title}" loading="lazy">
      <div class="bing-item-title">${wp.title}</div>
      <div class="bing-item-check">✓</div>
    `;

    item.addEventListener('click', () => {
      document.querySelectorAll('.bing-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');

      wallpaperState = { type: 'bing', url: wp.url, bingIndex: index };
      saveWallpaperState();
      applyWallpaper();
    });

    grid.appendChild(item);
  });
}

function clearBingSelection() {
  document.querySelectorAll('.bing-item').forEach(i => i.classList.remove('selected'));
}

// ========== 每日自动切换必应壁纸 ==========
function initAutoBingDaily() {
  const toggle = document.getElementById('autoBingDailyToggle');
  if (!toggle) return;

  chrome.storage.local.get('autoBingDaily', (data) => {
    toggle.checked = !!data.autoBingDaily;
  });

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ autoBingDaily: enabled });
    if (enabled) {
      checkBingDailyOnLoad();
    }
  });
}

function checkBingDailyOnLoad() {
  chrome.storage.local.get('autoBingDaily', (data) => {
    if (!data.autoBingDaily) return;
    try {
      chrome.runtime.sendMessage({ type: 'checkBingDaily' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.needUpdate && response.wallpaper) {
          wallpaperState = { type: 'bing', url: response.wallpaper.url, bingIndex: 0 };
          saveWallpaperState();
          applyWallpaper();
        }
      });
    } catch (e) {}
  });
}

// ========== 自定义壁纸上传 ==========
function initCustomUpload() {
  const area = document.getElementById('customUploadArea');
  const fileInput = document.getElementById('customFileInput');

  area.addEventListener('click', () => fileInput.click());

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });

  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });

  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleCustomFile(file);
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleCustomFile(file);
    fileInput.value = '';
  });
}

function handleCustomFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;

    const preview = document.getElementById('customPreview');
    preview.innerHTML = `<img src="${dataUrl}" alt="预览">`;

    wallpaperState = { type: 'custom', url: dataUrl, bingIndex: -1 };
    saveWallpaperState();
    applyWallpaper();
  };
  reader.readAsDataURL(file);
}

function clearCustomPreview() {
  document.getElementById('customPreview').innerHTML = '';
}

// ========== 远程链接壁纸 ==========
function initUrlWallpaper() {
  const input = document.getElementById('wallpaperUrlInput');
  const applyBtn = document.getElementById('urlApplyBtn');

  chrome.storage.local.get('wallpaper', (data) => {
    if (data.wallpaper && data.wallpaper.type === 'url') {
      input.value = data.wallpaper.url;
    }
  });

  applyBtn.addEventListener('click', () => {
    const url = input.value.trim();
    if (!url) return;

    const preview = document.getElementById('urlPreview');
    preview.innerHTML = '<div class="bing-loading">加载中...</div>';

    const img = new Image();
    img.onload = () => {
      preview.innerHTML = `<img src="${url}" alt="预览">`;
      wallpaperState = { type: 'url', url: url, bingIndex: -1 };
      saveWallpaperState();
      applyWallpaper();
    };
    img.onerror = () => {
      preview.innerHTML = '<div class="bing-loading" style="color:#ff6b6b">图片加载失败，请检查链接</div>';
    };
    img.src = url;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyBtn.click();
  });
}

function clearUrlPreview() {
  document.getElementById('urlPreview').innerHTML = '';
  document.getElementById('wallpaperUrlInput').value = '';
}

// ========== 拖拽链接添加快捷方式 ==========
function initDragLink() {
  const hint = document.getElementById('dragHint');
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    const url = getDragUrl(e);
    if (!url) return;
    dragCounter++;
    hint.classList.add('show');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      hint.classList.remove('show');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    hint.classList.remove('show');

    const url = getDragUrl(e);
    if (!url) return;

    openModalWithUrl(url);
  });
}

function getDragUrl(e) {
  const text = e.dataTransfer.getData('text/plain') || '';
  const urlData = e.dataTransfer.getData('text/uri-list') || '';
  const candidate = urlData || text;
  if (/^https?:\/\//.test(candidate)) return candidate;
  if (/^www\./.test(candidate)) return 'https://' + candidate;
  return '';
}

function openModalWithUrl(url) {
  openModal();
  document.getElementById('shortcutUrl').value = url;

  chrome.runtime.sendMessage({ type: 'fetchPageTitle', url }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      return;
    }
    if (response.title) {
      document.getElementById('shortcutName').value = response.title;
    }
  });
}

// ========== 快捷导航右键菜单 ==========
let shortcutMenuEl = null;

function showShortcutMenu(e, index) {
  e.preventDefault();
  e.stopPropagation();
  hideShortcutMenu();

  const menu = document.createElement('div');
  menu.className = 'shortcut-context-menu';
  menu.innerHTML = `
    <div class="shortcut-menu-item" data-action="edit">编辑</div>
    <div class="shortcut-menu-item" data-action="delete">删除</div>
  `;

  document.body.appendChild(menu);

  const x = Math.min(e.clientX, window.innerWidth - 120);
  const y = Math.min(e.clientY, window.innerHeight - 80);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  shortcutMenuEl = menu;

  menu.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const action = ev.target.closest('.shortcut-menu-item')?.dataset.action;
    if (action === 'edit') {
      openEditModal(index);
    } else if (action === 'delete') {
      shortcuts.splice(index, 1);
      saveShortcuts(() => renderShortcuts());
    }
    hideShortcutMenu();
  });
}

function hideShortcutMenu() {
  if (shortcutMenuEl) {
    shortcutMenuEl.remove();
    shortcutMenuEl = null;
  }
}

document.addEventListener('click', hideShortcutMenu);
document.addEventListener('contextmenu', (e) => {
  if (shortcutMenuEl && !shortcutMenuEl.contains(e.target)) {
    hideShortcutMenu();
  }
});

function openEditModal(index) {
  const item = shortcuts[index];
  if (!item) return;

  modalMode = 'edit';
  editIndex = index;

  document.getElementById('shortcutName').value = item.name;
  document.getElementById('shortcutUrl').value = item.url;
  document.getElementById('shortcutIconUrl').value = item.iconUrl || '';
  document.querySelector('.modal-title').textContent = '编辑快捷方式';
  document.getElementById('modalConfirm').textContent = '保存';
  updateIconPreview();
  document.getElementById('modalOverlay').classList.add('show');

  setTimeout(() => document.getElementById('shortcutName').focus(), 100);
}

// ========== 设置面板 ==========
function initSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('generalSettingsBtn');
  const closeBtn = document.getElementById('settingsPanelClose');

  btn.addEventListener('click', () => {
    panel.classList.add('open');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  chrome.storage.local.get('appSettings', (data) => {
    if (data.appSettings) {
      appSettings = { ...DEFAULT_SETTINGS, ...data.appSettings };
    }
    applyAllSettings();
    bindSettingsEvents();
  });
}

function applyAllSettings() {
  document.getElementById('settingClock24h').checked = appSettings.clock24h;
  document.getElementById('settingClockSeconds').checked = appSettings.clockShowSeconds;
  document.getElementById('settingClockDate').checked = appSettings.clockShowDate;
  document.getElementById('settingClockGreeting').checked = appSettings.clockShowGreeting;
  document.getElementById('settingSearchBlur').checked = appSettings.searchFocusBlur;
  document.getElementById('settingWallpaperDim').value = appSettings.wallpaperDim;
  document.getElementById('settingWallpaperDimValue').textContent = appSettings.wallpaperDim + '%';
  document.getElementById('settingShowShortcuts').checked = appSettings.showShortcuts;
  document.getElementById('settingSearchEngine').value = currentEngine;

  updateClock();
  applyWallpaper();
  applyShortcutsVisibility();
}

function applyShortcutsVisibility() {
  const section = document.querySelector('.shortcuts-section');
  if (section) {
    section.style.display = appSettings.showShortcuts ? '' : 'none';
  }
}

function bindSettingsEvents() {
  const save = () => {
    chrome.storage.local.set({ appSettings });
  };

  document.getElementById('settingClock24h').addEventListener('change', (e) => {
    appSettings.clock24h = e.target.checked;
    save();
    updateClock();
  });

  document.getElementById('settingClockSeconds').addEventListener('change', (e) => {
    appSettings.clockShowSeconds = e.target.checked;
    save();
    updateClock();
  });

  document.getElementById('settingClockDate').addEventListener('change', (e) => {
    appSettings.clockShowDate = e.target.checked;
    save();
    updateClock();
  });

  document.getElementById('settingClockGreeting').addEventListener('change', (e) => {
    appSettings.clockShowGreeting = e.target.checked;
    save();
    updateClock();
  });

  document.getElementById('settingSearchEngine').addEventListener('change', (e) => {
    currentEngine = e.target.value;
    chrome.storage.local.set({ searchEngine: currentEngine });
    updateEngineUI();
  });

  document.getElementById('settingSearchBlur').addEventListener('change', (e) => {
    appSettings.searchFocusBlur = e.target.checked;
    save();
  });

  document.getElementById('settingWallpaperDim').addEventListener('input', (e) => {
    appSettings.wallpaperDim = parseInt(e.target.value);
    document.getElementById('settingWallpaperDimValue').textContent = appSettings.wallpaperDim + '%';
    save();
    applyWallpaper();
  });

  document.getElementById('settingShowShortcuts').addEventListener('change', (e) => {
    appSettings.showShortcuts = e.target.checked;
    save();
    applyShortcutsVisibility();
  });
}
