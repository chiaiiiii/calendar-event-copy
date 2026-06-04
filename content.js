(() => {
  if (window.__calendarEventCopyInjectedV11) return;
  window.__calendarEventCopyInjectedV11 = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ ok: true, version: "1.1" });
      return true;
    }

    if (request.action !== "getEvents") return false;

    try {
      const result = extractEvents();
      sendResponse(result);
    } catch (error) {
      sendResponse({ events: [], error: error?.message || String(error) });
    }
    return true;
  });

  function extractEvents() {
    const results = [];
    const seen = new Set();
    const debug = {
      candidateCount: 0,
      parsedCount: 0,
      samples: [],
    };

    const candidates = collectCandidateElements();
    debug.candidateCount = candidates.length;

    for (const el of candidates) {
      const raw = getElementText(el);
      if (!raw) continue;
      if (debug.samples.length < 8) debug.samples.push(raw.slice(0, 120));
      if (isUIElement(raw)) continue;
      if (!isEventLike(raw)) continue;

      const title = cleanupTitle(extractTitle(raw));
      if (!title) continue;
      if (isUIElement(title)) continue;
      if (seen.has(title)) continue;

      seen.add(title);
      results.push(title);
    }

    debug.parsedCount = results.length;
    return { events: results, debug };
  }

  function collectCandidateElements() {
    const selector = [
      "[data-eventid]",
      "[data-eventchip]",
      "[role='button'][aria-label]",
      "[role='button']",
    ].join(",");

    const all = Array.from(document.querySelectorAll(selector));

    // 親子で同じ予定を拾うことがあるので、同じ表示テキストのものは軽く間引く。
    const seenKeys = new Set();
    const unique = [];

    for (const el of all) {
      const raw = getElementText(el);
      if (!raw) continue;
      const key = raw.replace(/\s+/g, " ").trim();
      if (!key) continue;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      unique.push(el);
    }

    return unique;
  }

  function getElementText(el) {
    const aria = el.getAttribute("aria-label") || "";
    const text = el.innerText || el.textContent || "";
    return normalizeText(`${aria}\n${text}`);
  }

  function normalizeText(text) {
    return String(text)
      .replace(/ /g, " ")
      .replace(/[　]+/g, " ")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isEventLike(text) {
    return hasJapaneseTime(text) || /[「『"][^」』"]+[」』"]/.test(text);
  }

  function hasJapaneseTime(text) {
    return /(?:午前|午後)\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時(?:\d{1,2}分?)?))?(?:\s*[～〜\-–]\s*(?:午前|午後)?\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時(?:\d{1,2}分?)?))?)?/.test(text);
  }

  function extractTitle(text) {
    const normalized = normalizeText(text);

    // 1. aria-label の想定形式: 午前9:30～午前10時、「タイトル」、Ai Higuchi、...
    const quoted = normalized.match(/[「『"]([^」』"]+)[」』"]/);
    if (quoted?.[1]) return quoted[1];

    const lines = normalized
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    // 2. 画面表示形式: タイトル\n午前11時～午後12時
    for (const line of lines) {
      if (isUIElement(line)) continue;
      if (isTimeOnlyLine(line)) continue;

      const beforeTime = line.split(/(?:午前|午後)\s*\d{1,2}/)[0]
        .replace(/[、,\s]+$/g, "")
        .trim();
      if (beforeTime && beforeTime.length >= 2) return beforeTime;

      if (!hasJapaneseTime(line) && line.length >= 2) return line;
    }

    // 3. aria-label で引用符がない形式: 午前9:30～午前10時、タイトル、参加者...
    const afterTime = normalized.match(/(?:午前|午後)\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時(?:\d{1,2}分?)?))?(?:\s*[～〜\-–]\s*(?:午前|午後)?\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時(?:\d{1,2}分?)?))?)?[\s、,]+(.+)/);
    if (afterTime?.[1]) {
      return afterTime[1].split(/[、,\n]/)[0];
    }

    return null;
  }

  function isTimeOnlyLine(line) {
    const removed = line
      .replace(/(?:午前|午後)\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時(?:\d{1,2}分?)?))?(?:\s*[～〜\-–]\s*(?:午前|午後)?\s*\d{1,2}(?:(?:[:：]\d{1,2})|(?:時(?:\d{1,2}分?)?))?)?/g, "")
      .replace(/[、,\s]/g, "")
      .trim();
    return removed.length === 0;
  }

  function cleanupTitle(title) {
    if (!title) return null;

    const cleaned = normalizeText(title)
      .replace(/^[・•\-\s]+/, "")
      .replace(/[、,\s]+$/g, "")
      .trim();

    if (cleaned.length < 2) return null;
    if (cleaned.length > 120) return null;
    if (/^(?:午前|午後)\s*\d/.test(cleaned)) return null;
    if (/^GMT[+＋-]/i.test(cleaned)) return null;

    return cleaned;
  }

  function isUIElement(text) {
    const uiPatterns = [
      "勤務場所を追加",
      "場所を追加",
      "予定を追加",
      "タスクを追加",
      "新しい予定",
      "もっと見る",
      "今日",
      "戻る",
      "進む",
      "検索",
      "設定",
      "作成",
      "カレンダー",
      "ゲスト",
      "ユーザーを検索",
      "その他の分析情報",
    ];
    return uiPatterns.some((pattern) => text.includes(pattern));
  }
})();
