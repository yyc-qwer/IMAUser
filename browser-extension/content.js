(function() {
  "use strict";
  console.log("[IMAU] Content script loaded");

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extract") {
      try {
        var data = autoExtract();
        sendResponse({ success: true, data: data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
    if (request.action === "ping") {
      sendResponse({ pong: true, url: window.location.href });
      return true;
    }
  });

  function parseDate(text) {
    text = (text || "").trim();
    var m = text.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) {
      return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    }
    return text;
  }

  function extractTaskList(taskDiv, type) {
    var items = [];
    if (!taskDiv) return items;
    var lis = taskDiv.querySelectorAll("ul li");
    for (var i = 0; i < lis.length; i++) {
      var li = lis[i];
      if (li.classList.contains("noneData")) continue;
      var h6 = li.querySelector("h6");
      if (!h6) continue;
      var title = h6.getAttribute("title") || h6.textContent.trim();
      var spans = li.querySelectorAll("p span");
      var endDateRaw = spans.length > 0 ? spans[0].textContent.trim() : "";
      var course = spans.length > 1 ? (spans[1].getAttribute("title") || spans[1].textContent.trim()) : "";
      items.push({
        title: title,
        endDate: parseDate(endDateRaw),
        course: course,
        type: type,
        source: "school"
      });
    }
    return items;
  }

  function autoExtract() {
    var allItems = [];
    var homeworkDiv = document.getElementById("homeworkTask");
    var testDiv = document.getElementById("testTask");
    allItems = allItems.concat(extractTaskList(homeworkDiv, "\u4f5c\u4e1a"));
    allItems = allItems.concat(extractTaskList(testDiv, "\u6d4b\u8bd5"));
    console.log("[IMAU] Extracted " + allItems.length + " items");
    return allItems;
  }
})();
