// Googleカレンダーのページから指定日の予定タイトルを取得する
// popup.js からメッセージで呼び出される

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "getEvents") return;

  const targetDate = new Date(request.date + "T00:00:00");
  const events = extractEvents(targetDate);
  sendResponse({ events });
  return true;
});

function extractEvents(targetDate) {
  const results = [];
  const seen = new Set();

  // 月表示・週表示・日表示のいずれでも動作するよう複数セレクタで取得
  const selectors = [
    // 月表示の予定
    '[data-eventid]',
    // 週表示・日表示の予定チップ
    '[data-eventchip]',
    // 共通のaria-labelつき要素
    'div[role="button"][data-eventid]',
  ];

  // aria-label から日時とタイトルを読み取る
  const allChips = document.querySelectorAll(
    '[data-eventid], [data-eventchip]'
  );

  allChips.forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    const title = extractTitle(el, label);
    if (!title) return;

    // 日付が一致するか確認
    if (!isTargetDate(el, label, targetDate)) return;

    if (!seen.has(title)) {
      seen.add(title);
      results.push(title);
    }
  });

  // 取得できなかった場合は表示中のテキストから補完
  if (results.length === 0) {
    return extractByVisibleText(targetDate);
  }

  return results;
}

function extractTitle(el, ariaLabel) {
  // aria-label の先頭部分がタイトルになっていることが多い
  if (ariaLabel) {
    // 例: "朝会, 10時00分 〜 10時30分" → "朝会"
    const match = ariaLabel.match(/^([^,、\n]+)/);
    if (match) return match[1].trim();
  }

  // テキストコンテンツから取得
  const titleEl =
    el.querySelector('[data-eventid] .KF4T6b') ||
    el.querySelector('.mxG3lb') ||
    el.querySelector('[role="heading"]');
  if (titleEl) return titleEl.textContent.trim();

  return null;
}

function isTargetDate(el, ariaLabel, targetDate) {
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth() + 1;
  const d = targetDate.getDate();

  // aria-label に日付情報が含まれる場合
  if (ariaLabel) {
    const datePatterns = [
      // 例: "2024年6月4日"
      new RegExp(`${y}年${m}月${d}日`),
      // 例: "6月4日"
      new RegExp(`${m}月${d}日`),
    ];
    if (datePatterns.some((p) => p.test(ariaLabel))) return true;
  }

  // data-datestring 属性で判定
  const dateStr = el.getAttribute("data-datestring") ||
    el.closest("[data-datestring]")?.getAttribute("data-datestring");
  if (dateStr) {
    const elDate = new Date(dateStr + "T00:00:00");
    return elDate.toDateString() === targetDate.toDateString();
  }

  // 親要素の日付セルで判定
  const dayCell = el.closest('[data-date]');
  if (dayCell) {
    const cellDate = new Date(dayCell.getAttribute("data-date") + "T00:00:00");
    return cellDate.toDateString() === targetDate.toDateString();
  }

  return false;
}

function extractByVisibleText(targetDate) {
  // フォールバック: 現在表示中の日表示から全予定を取得
  const results = [];
  const seen = new Set();

  // 日表示モードのイベントタイトル
  document.querySelectorAll('[role="button"]').forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    if (!label) return;

    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();

    const hasDate =
      label.includes(`${y}年${m}月${d}日`) ||
      label.includes(`${m}月${d}日`);
    if (!hasDate) return;

    const match = label.match(/^([^,、\n]+)/);
    if (!match) return;

    const title = match[1].trim();
    if (title && !seen.has(title)) {
      seen.add(title);
      results.push(title);
    }
  });

  return results;
}
