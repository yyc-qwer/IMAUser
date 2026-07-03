// popup.js - IMAU Schedule Importer

(function() {
  "use strict";

  var statusEl = document.getElementById("status");
  var previewEl = document.getElementById("preview");
  var extractBtn = document.getElementById("extractBtn");
  var copyBtn = document.getElementById("copyBtn");
  var pushBtn = document.getElementById("pushBtn");
  var customExtractBtn = document.getElementById("customExtractBtn");

  var extractedData = null;

  function setStatus(type, msg) {
    statusEl.className = "status " + type;
    statusEl.textContent = msg;
  }

  function showPreview(data) {
    previewEl.style.display = "block";
    previewEl.textContent = JSON.stringify(data, null, 2);
    copyBtn.disabled = false;
    if (pushBtn) pushBtn.disabled = false;
  }

  function hidePreview() {
    previewEl.style.display = "none";
    copyBtn.disabled = true;
    if (pushBtn) pushBtn.disabled = true;
    extractedData = null;
  }

  async function extract(selectors) {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabs[0];

      if (!tab || !tab.url) {
        setStatus("error", "\u65e0\u6cd5\u83b7\u53d6\u5f53\u524d\u6807\u7b7e\u9875\u4fe1\u606f");
        return;
      }

      if (!/imau\.edu\.cn/.test(tab.url) && !tab.url.startsWith("file://")) {
        setStatus("error", "\u8bf7\u5148\u5728 imau.edu.cn \u5b66\u6821\u9875\u9762\u6253\u5f00\u6b64\u63d2\u4ef6\n\n\u5f53\u524d: " + tab.url);
        return;
      }

      setStatus("info", "\u6b63\u5728\u63d0\u53d6\u6570\u636e...");
      hidePreview();

      try {
        var pingResp = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
        if (!pingResp || !pingResp.pong) {
          throw new Error("content script not responding");
        }
      } catch (pingErr) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        await new Promise(function(r) { setTimeout(r, 200); });
      }

      var response = await chrome.tabs.sendMessage(tab.id, {
        action: "extract",
        selectors: selectors || null
      });

      if (!response) {
        setStatus("error", "\u672a\u6536\u5230\u54cd\u5e94\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5");
        return;
      }

      if (!response.success) {
        setStatus("error", "\u63d0\u53d6\u5931\u8d25: " + (response.error || "\u672a\u77e5\u9519\u8bef"));
        return;
      }

      if (response.data && response.data.length > 0) {
        extractedData = response.data;
        setStatus("success", "\u6210\u529f\u63d0\u53d6 " + response.data.length + " \u6761\u65e5\u7a0b\u6570\u636e");
        showPreview(response.data);
      } else {
        setStatus("error", "\u672a\u63d0\u53d6\u5230\u6570\u636e\uff0c\u8bf7\u786e\u8ba4\u9875\u9762\u5df2\u52a0\u8f7d\u5b8c\u6bd5\uff0c\u6216\u5c1d\u8bd5\u81ea\u5b9a\u4e49\u9009\u62e9\u5668");
      }
    } catch (err) {
      console.error("[IMAU Importer]", err);
      setStatus("error", "\u63d0\u53d6\u5931\u8d25: " + err.message + "\n\n\u8bf7\u5237\u65b0\u5b66\u6821\u9875\u9762\u540e\u91cd\u8bd5\u3002");
    }
  }

  // ===== Push to schedule-app =====
  // Strategy: write to chrome.storage.local AND open the schedule-app tab.
  // The schedule-app web page can't read chrome.storage, so we also encode
  // the data in the URL fragment as a fallback bridge.

  var SCHEDULE_APP_URL = "https://imauser.pages.dev";

  async function pushToSchedule() {
    if (!extractedData || extractedData.length === 0) return;

    setStatus("info", "\u6b63\u5728\u5199\u5165\u65e5\u7a0b\u770b\u677f...");

    try {
      // 1. Write to chrome.storage (keeps working if schedule-app is loaded as extension)
      var existing = await chrome.storage.local.get("imau_import_queue");
      var queue = existing.imau_import_queue || [];
      var now = new Date().toISOString();
      for (var i = 0; i < extractedData.length; i++) {
        var item = extractedData[i];
        queue.push({
          title: item.title,
          course: item.course,
          type: item.type,
          endDate: item.endDate,
          source: "school",
          importedAt: now
        });
      }
      await chrome.storage.local.set({ imau_import_queue: queue });

      // 2. Open (or focus) schedule-app tab with data in URL hash
      var encoded = encodeURIComponent(JSON.stringify(extractedData));
      var targetUrl = SCHEDULE_APP_URL + "#import=" + encoded;

      // Find existing schedule-app tab
      var allTabs = await chrome.tabs.query({});
      var existingTab = null;
      for (var j = 0; j < allTabs.length; j++) {
        if (allTabs[j].url && allTabs[j].url.indexOf("localhost:5173") !== -1) {
          existingTab = allTabs[j];
          break;
        }
      }

      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
      } else {
        await chrome.tabs.create({ url: targetUrl });
      }

      setStatus("success", "\u5df2\u5c06 " + extractedData.length + " \u6761\u6570\u636e\u63a8\u9001\u81f3\u65e5\u7a0b\u770b\u677f\uff01");
    } catch (err) {
      setStatus("error", "\u63a8\u9001\u5931\u8d25: " + err.message);
    }
  }

  // ===== Button bindings =====

  extractBtn.addEventListener("click", function() {
    extract(null);
  });

  customExtractBtn.addEventListener("click", function() {
    var rowSel = document.getElementById("rowSelector").value.trim();
    var titleSel = document.getElementById("titleSelector").value.trim();
    var dateSel = document.getElementById("dateSelector").value.trim();
    var typeSel = document.getElementById("typeSelector").value.trim();

    if (!rowSel || !titleSel) {
      setStatus("error", "\u8bf7\u81f3\u5c11\u586b\u5199\u884c\u9009\u62e9\u5668\u548c\u6807\u9898\u9009\u62e9\u5668");
      return;
    }

    extract({
      row: rowSel,
      title: titleSel,
      date: dateSel,
      type: typeSel
    });
  });

  copyBtn.addEventListener("click", async function() {
    if (!extractedData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
      setStatus("success", "\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f\uff01\u5207\u6362\u5230\u65e5\u7a0b\u7ba1\u7406\u5e94\u7528\u70b9\u51fb\u201c\u526a\u8d34\u677f\u5bfc\u5165\u201d\u5373\u53ef\u3002");
    } catch (err) {
      setStatus("error", "\u590d\u5236\u5931\u8d25: " + err.message);
    }
  });

  if (pushBtn) {
    pushBtn.addEventListener("click", pushToSchedule);
  }

  console.log("[IMAU Importer] Popup loaded");
})();
