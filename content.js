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
    const label = el.getAttribute("aria-label") || "";
    if (isUIElement(label)) return;

    const title = getTitleFromElement(el);
    if (title && !seen.has(title)) {
      seen.add(title);
      results.push(title);
    }
  });

  return results;
}

function getTitleFromElement(el) {
  const label = el.getAttribute("aria-label") || "";
  if (label) {
    // 「タイトル」形式から抽出（例: 午前9:30～午前10時、「FDEコセンスアップデート」、...）
    const quoted = label.match(/[「"](.+?)[」"]/);
    if (quoted) return quoted[1].trim();
  }

  return null;
}

function isUIElement(label) {
  // イベントではないUI要素を除外
  const uiPatterns = ["勤務場所を追加", "場所を追加", "予定を追加", "タスクを追加"];
  return uiPatterns.some((p) => label.includes(p));
}
