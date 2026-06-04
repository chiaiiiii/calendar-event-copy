document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("date-input");
  const getBtn = document.getElementById("get-btn");
  const resultDiv = document.getElementById("result");
  const copyBtn = document.getElementById("copy-btn");
  const statusDiv = document.getElementById("status");

  dateInput.value = formatDate(new Date());

  getBtn.addEventListener("click", async () => {
    resetUi();
    const selectedDate = dateInput.value;
    if (!selectedDate) {
      statusDiv.textContent = "日付を選択してください";
      return;
    }

    getBtn.disabled = true;
    statusDiv.textContent = "取得中...";

    try {
      const targetTab = await findCalendarTab();
      if (!targetTab) {
        statusDiv.textContent = "Googleカレンダーのタブが見つかりません。\nカレンダーを開いてから再試行してください。";
        return;
      }

      await ensureContentScript(targetTab.id);

      const response = await chrome.tabs.sendMessage(targetTab.id, {
        action: "getEvents",
        date: selectedDate,
      });

      if (!response) {
        statusDiv.textContent = "予定の取得に失敗しました。";
        return;
      }

      if (response.error) {
        statusDiv.textContent = `エラーが発生しました：${response.error}`;
        return;
      }

      const events = Array.isArray(response.events) ? response.events : [];

      if (events.length === 0) {
        resultDiv.textContent = "この日の予定はありません";
        resultDiv.style.display = "block";
        const candidateCount = response.debug?.candidateCount ?? 0;
        statusDiv.textContent = candidateCount > 0
          ? `予定候補は${candidateCount}件見つかりましたが、タイトルとして抽出できませんでした。\nGoogleカレンダーを「日」表示にして、対象日を画面に表示した状態で再試行してください。`
          : "予定候補が見つかりませんでした。Googleカレンダーを「日」表示にして、対象日を画面に表示した状態で再試行してください。";
        console.log("Calendar copy debug:", response.debug);
        return;
      }

      const text = events.map((e) => `・${e}`).join("\n");
      resultDiv.textContent = text;
      resultDiv.style.display = "block";
      copyBtn.style.display = "block";
      statusDiv.textContent = `${events.length}件の予定を取得しました`;

      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "コピーしました！";
        setTimeout(() => {
          copyBtn.textContent = "クリップボードにコピー";
        }, 2000);
      };
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "エラーが発生しました。拡張機能を再読み込みして、Googleカレンダーを開いた状態で再試行してください。";
    } finally {
      getBtn.disabled = false;
    }
  });

  function resetUi() {
    resultDiv.style.display = "none";
    resultDiv.textContent = "";
    copyBtn.style.display = "none";
    copyBtn.textContent = "クリップボードにコピー";
    copyBtn.onclick = null;
    statusDiv.textContent = "";
  }
});

async function findCalendarTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isCalendarTab(activeTab)) return activeTab;

  const tabs = await chrome.tabs.query({ url: "https://calendar.google.com/*" });
  return tabs[0] || null;
}

async function ensureContentScript(tabId) {
  const injected = await chrome.tabs.sendMessage(tabId, { action: "ping" }).catch(() => null);
  if (injected?.ok) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });

  // 注入直後の保険。通常は不要だが、環境差で listener 登録前に送信されるのを避ける。
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isCalendarTab(tab) {
  return Boolean(tab?.url?.startsWith("https://calendar.google.com/"));
}
