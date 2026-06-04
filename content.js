chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "getEvents") return;

  const events = extractEvents();
  sendResponse({ events });
  return true;
});

function extractEvents() {
  const results = [];
  const seen = new Set();

  // aria-label がイベント形式（時刻を含む）かどうか判定
  const isEventLabel = (label) => /[午前午後]\d+[時:時]\d*/.test(label);

  // role="button" を持つ全要素からイベントのみ絞り込む
  document.querySelectorAll('[role="button"][aria-label], [data-eventchip], [data-eventid]').forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    if (!label) return;
    if (!isEventLabel(label)) return;

    const title = extractTitle(label);
    if (title && !seen.has(title)) {
      seen.add(title);
      results.push(title);
    }
  });

  return results;
}

function extractTitle(label) {
  // パターン1: 「タイトル」形式
  const quoted = label.match(/[「"](.+?)[」"]/);
  if (quoted) return quoted[1].trim();

  // パターン2: 時刻の後にタイトルが来る形式（例: "午前9:30 FDEコセンスアップデート"）
  const afterTime = label.match(/[午前午後]\d+[時:]\d*[^\s]*\s+(.+)/);
  if (afterTime) return afterTime[1].split(/[,、]/)[0].trim();

  // パターン3: ラベル全体が短ければタイトルとみなす
  const clean = label.trim();
  if (clean.length > 1 && clean.length < 60 && !/^\d/.test(clean)) return clean;

  return null;
}

function isUIElement(label) {
  const uiPatterns = ["勤務場所を追加", "場所を追加", "予定を追加", "タスクを追加", "新しい予定", "もっと見る", "他"];
  return uiPatterns.some((p) => label.includes(p));
}
