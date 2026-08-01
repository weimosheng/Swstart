const BING_API = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('bingDailyWallpaper', { delayInMinutes: 1, periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bingDailyWallpaper') {
    updateBingDailyWallpaper();
  }
});

function updateBingDailyWallpaper() {
  chrome.storage.local.get('autoBingDaily', (data) => {
    if (!data.autoBingDaily) return;
    fetch(BING_API)
      .then(res => res.json())
      .then(result => {
        const images = result.images || [];
        if (images.length === 0) return;
        const img = images[0];
        const wp = {
          url: 'https://www.bing.com' + img.url,
          title: img.title || '',
          copyright: img.copyright || '',
        };
        const today = new Date().toISOString().slice(0, 10);
        chrome.storage.local.set({
          bingDailyWallpaper: wp,
          bingDailyDate: today,
          wallpaper: { type: 'bing', url: wp.url, bingIndex: 0 },
        });
      })
      .catch(() => {});
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetchBingWallpapers') {
    fetch(BING_API)
      .then(res => res.json())
      .then(data => {
        const wallpapers = (data.images || []).map(img => ({
          url: 'https://www.bing.com' + img.url,
          title: img.title || '',
          copyright: img.copyright || '',
        }));
        sendResponse({ success: true, wallpapers });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === 'fetchSuggestions') {
    const { query, engine } = message;
    if (!query) {
      sendResponse({ success: true, suggestions: [] });
      return;
    }

    const apis = {
      baidu: `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&cb=`,
      bing: `https://api.bing.com/qsonhs.aspx?type=1&q=${encodeURIComponent(query)}`,
      google: `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`,
    };

    const apiUrl = apis[engine] || apis.baidu;

    if (engine === 'baidu') {
      fetch(apiUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          const text = new TextDecoder('gbk').decode(buffer);
          const match = text.match(/s:\[(.*?)\]/);
          let suggestions = [];
          if (match) {
            suggestions = JSON.parse('[' + match[1] + ']');
          }
          sendResponse({ success: true, suggestions: suggestions.slice(0, 8) });
        })
        .catch(err => {
          sendResponse({ success: false, suggestions: [], error: err.message });
        });
      return true;
    }

    fetch(apiUrl)
      .then(res => res.text())
      .then(text => {
        let suggestions = [];

        if (engine === 'bing') {
          try {
            const data = JSON.parse(text);
            const results = data?.AS?.Results?.[0]?.Suggests;
            if (results) {
              suggestions = results.map(r => r.Txt);
            }
          } catch (e) {}
        } else if (engine === 'google') {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length >= 2) {
              suggestions = data[1];
            }
          } catch (e) {}
        }

        sendResponse({ success: true, suggestions: suggestions.slice(0, 8) });
      })
      .catch(err => {
        sendResponse({ success: false, suggestions: [], error: err.message });
      });
    return true;
  }

  if (message.type === 'fetchPageTitle') {
    const { url } = message;
    if (!url) {
      sendResponse({ success: false, error: '缺少URL' });
      return;
    }

    const altUrl = url.startsWith('https://') ? url.replace('https://', 'http://') : url.replace('http://', 'https://');

    fetchTitle(url)
      .then(title => sendResponse({ success: true, title }))
      .catch(() => {
        fetchTitle(altUrl)
          .then(title => sendResponse({ success: true, title }))
          .catch(() => {
            try {
              sendResponse({ success: true, title: new URL(url).hostname });
            } catch (e) {
              sendResponse({ success: false, error: '无法获取标题' });
            }
          });
      });
    return true;
  }

  if (message.type === 'fetchFavicon') {
    const { url } = message;
    if (!url) {
      sendResponse({ success: false, error: '缺少URL' });
      return;
    }

    let origin;
    try {
      origin = new URL(url).origin;
    } catch (e) {
      sendResponse({ success: false, error: '无效URL' });
      return;
    }

    const altOrigin = origin.startsWith('https://') ? origin.replace('https://', 'http://') : origin.replace('http://', 'https://');

    fetchFaviconFromHtml(origin)
      .then(faviconUrl => sendResponse({ success: true, faviconUrl }))
      .catch(() => {
        fetchFaviconFromHtml(altOrigin)
          .then(faviconUrl => sendResponse({ success: true, faviconUrl }))
          .catch(() => {
            sendResponse({ success: true, faviconUrl: origin + '/favicon.ico' });
          });
      });
    return true;
  }
});

function fetchTitle(url) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000) })
    .then(res => {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/')) {
        throw new Error('非HTML页面');
      }
      return res.text();
    })
    .then(html => {
      const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      let title = match ? match[1].trim() : '';
      if (!title) throw new Error('无标题');
      const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
      title = title.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => entities[m]);
      return title;
    });
}

function fetchFaviconFromHtml(origin) {
  return fetch(origin + '/', { redirect: 'follow', signal: AbortSignal.timeout(5000) })
    .then(res => {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/')) {
        throw new Error('非HTML页面');
      }
      return res.text();
    })
    .then(html => {
      const patterns = [
        /<link[^>]+rel\s*=\s*["'](?:shortcut\s+icon|icon)["'][^>]*>/gi,
        /<link[^>]+rel\s*=\s*["']apple-touch-icon["'][^>]*>/gi,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const hrefMatch = match[0].match(/href\s*=\s*["']([^"']+)["']/i);
          if (hrefMatch) {
            let iconUrl = hrefMatch[1];
            if (iconUrl.startsWith('//')) iconUrl = 'https:' + iconUrl;
            else if (iconUrl.startsWith('/')) iconUrl = origin + iconUrl;
            else if (!iconUrl.startsWith('http')) iconUrl = origin + '/' + iconUrl;
            return iconUrl;
          }
        }
      }

      throw new Error('未找到图标链接');
    });
}
