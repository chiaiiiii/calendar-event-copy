// ポップアップの操作とカレンダーページへのメッセージ送信を管理する

document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("date-input");
  const getBtn = document.getElementById("get-btn");
  const resultDiv = document.getElementById("result");
  const copyBtn = document.getElementById("copy-btn");
  const statusDiv = document.getElementById("status");

  // 今日の日付をデフォルト値にセット
  const today = new Date();
  dateInput.value = formatDate(today);

  getBtn.addEventListener("click", async () => {
    resultDiv.style.display = "none";
    copyBtn.style.display = "none";
    statusDiv.textContent = "取得中...";

    const selectedDate = dateInput.value;
    if (!selectedDate) {
      statusDiv.textContent = "日付を選択してください";
      return;
    }

    try {
      // Googleカレンダーのタブを探す
      const [tab] = await chrome.tabs.query({
        url: "https://calendar.google.com/*",
        active: false,
      });

      // アクティブタブも含めて探す
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const targetTab = isCalendarTab(activeTab) ? activeTab : tab;

      if (!targetTab) {
        statusDiv.textContent = "Googleカレンダーのタブが見つかりません。\nカレンダーを開いてから再試行してください。";
        return;
      }

      // content script が未注入の場合は動的に注入する
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          files: ["content.js"],
        });
      } catch (_) {
        // すでに注入済みの場合はエラーになるが無視
      }

      const response = await chrome.tabs.sendMessage(targetTab.id, {
        action: "getEvents",
        date: selectedDate,
      });

      if (!response || !response.events) {
        statusDiv.textContent = "予定の取得に失敗しました";
        return;
      }

      if (response.events.length === 0) {
        resultDiv.textContent = "この日の予定はありません";
        resultDiv.style.display = "block";
        statusDiv.textContent = "";
        return;
      }

      const text = response.events.map((e) => `・${e}`).join("\n");
      resultDiv.textContent = text;
      resultDiv.style.display = "block";
      copyBtn.style.display = "block";
      statusDiv.textContent = `${response.events.length}件の予定を取得しました`;

      // コピーボタン
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "コピーしました！";
        setTimeout(() => {
          copyBtn.textContent = "クリップボードにコピー";
        }, 2000);
      };
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "エラーが発生しました。カレンダーのページを開いているか確認してください。";
    }
  });
});

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isCalendarTab(tab) {
  return tab && tab.url && tab.url.startsWith("https://calendar.google.com/");
}
