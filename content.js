// Googleカレンダーのページから指定日の予定タイトルを取得する
// popup.js からメッセージで呼び出される

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "getEvents") return;

  const events = extractEvents();
  sendResponse({ events });
  return true;
});

function extractEvents() {
  const results = [];
  const seen = new Set();

  // aria-label を持つ全イベントチップを取得
  const candidates = document.querySelectorAll('[data-eventchip], [data-eventid]');

  candidates.forEach((el) => {
    const title = getTitleFromElement(el);
    if (title && !seen.has(title)) {
      seen.add(title);
      results.push(title);
    }
  });

  // 上記で取れない場合、role="button" の aria-label から取得
  if (results.length === 0) {
    document.querySelectorAll('[role="button"]').forEach((el) => {
      const label = el.getAttribute("aria-label") || "";
      if (!label || label.length > 100) return;

      const title = label.split(/[,、\n]/)[0].trim();
      if (title && title.length > 1 && !seen.has(title)) {
        seen.add(title);
        results.push(title);
      }
    });
  }

  return results;
}

function getTitleFromElement(el) {
  // aria-label の先頭（コンマや改行の前）がタイトル
  const label = el.getAttribute("aria-label") || "";
  if (label) {
    const title = label.split(/[,、\n]/)[0].trim();
    if (title && title.length > 1) return title;
  }

  // テキストコンテンツから取得
  const text = el.textContent?.trim();
  if (text && text.length > 1 && text.length < 80) return text;

  return null;
}
