// 注入済みチェック用フラグ（二重登録防止）
if (!window.__calendarCopyInjected) {
  window.__calendarCopyInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ ok: true });
      return true;
    }
    if (request.action !== "getEvents") return;

    const result = extractEvents(request.date);
    sendResponse(result);
    return true;
  });
}

function extractEvents(requestedDate) {
  // カレンダーが表示している日付を取得（URLのdパラメータから）
  const urlParams = new URLSearchParams(window.location.search);
  const calDate = urlParams.get("d") || "";
  // requestedDate は "YYYY-MM-DD"、calDate は "YYYYMMDD" 形式
  const normalizedCalDate = calDate.replace(/-/g, "");
  const normalizedRequested = requestedDate ? requestedDate.replace(/-/g, "") : "";

  if (normalizedRequested && normalizedCalDate && normalizedRequested !== normalizedCalDate) {
    return { events: [], dateMismatch: true };
  }

  const results = [];
  const seen = new Set();

  document.querySelectorAll('[role="button"][aria-label], [data-eventchip], [data-eventid]').forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    if (!label) return;
    if (isUIElement(label)) return;
    if (!isEventLabel(label)) return;

    const title = extractTitle(label);
    if (title && !seen.has(title)) {
      seen.add(title);
      results.push(title);
    }
  });

  return { events: results };
}

function isEventLabel(label) {
  return /(?:午前|午後)\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時\d{0,2}分?))?/.test(label);
}

function extractTitle(label) {
  // パターン1: 「タイトル」形式
  const quoted = label.match(/[「"](.+?)[」"]/);
  if (quoted) return quoted[1].trim();

  // パターン2: 時刻の後にタイトルが来る形式
  const afterTime = label.match(/(?:午前|午後)\s*\d{1,2}[時:：][^\s、,]*[\s、,]+(.+)/);
  if (afterTime) return afterTime[1].split(/[,、]/)[0].trim();

  return null;
}

function isUIElement(label) {
  const uiPatterns = ["勤務場所を追加", "場所を追加", "予定を追加", "タスクを追加", "新しい予定", "もっと見る", "他"];
  return uiPatterns.some((p) => label.includes(p));
}
