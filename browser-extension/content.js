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

  // ==================== 新增：爬课表（你下午验证过的） ====================
  function extractCourseTable() {
    var courses = [];
    var allTables = document.querySelectorAll("table");
    var table = allTables[4]; // 你验证过，第4个是课表
    if (!table) return courses;

    var rows = table.querySelectorAll("tr");
    var weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var cells = row.querySelectorAll("th, td");
      if (cells.length === 0) continue;

      var period = cells[0].textContent.trim();
      if (!period) continue;

      for (var j = 1; j < cells.length; j++) {
        var cell = cells[j];
        var html = cell.innerHTML
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ');
        
        var blocks = html.split(/<br\s*\/?>/i);
        var cleanBlocks = [];
        for (var b = 0; b < blocks.length; b++) {
          var text = blocks[b].replace(/<wbr\s*\/?>/gi, '').trim();
          if (text && text !== '&nbsp;' && text !== ' ') {
            cleanBlocks.push(text);
          }
        }

        if (cleanBlocks.length === 0) continue;

        var groupSize = 5;
        for (var g = 0; g < cleanBlocks.length; g += groupSize) {
          if (g + groupSize > cleanBlocks.length) break;
          var courseName = cleanBlocks[g];
          var location = cleanBlocks[g + 1];
          var teacher = cleanBlocks[g + 2];
          var classTime = cleanBlocks[g + 3];
          var classType = cleanBlocks[g + 4];

          var weekday = weekDays[j - 1] || "未知";
          courses.push({
            weekday: weekday,
            period: period,
            courseName: courseName,
            location: location,
            teacher: teacher,
            classTime: classTime,
            classType: classType,
            source: "school"
          });
        }
      }
    }
    console.log("[IMAU] 课表抓取完成，共 " + courses.length + " 门课程");
    return courses;
  }

  // ==================== 修改后的入口：课表 + 作业 ====================
  function autoExtract() {
    var allItems = [];
    
    // 1. 抓课表（把课表数据加到 allItems 里，并打上标签）
    var courses = extractCourseTable();
    for (var i = 0; i < courses.length; i++) {
      courses[i].type = "课程";
      allItems.push(courses[i]);
    }

    // 2. 抓作业（保留原有逻辑，如果你的学校没有这些id，注释掉即可）
    var homeworkDiv = document.getElementById("homeworkTask");
    var testDiv = document.getElementById("testTask");
    if (homeworkDiv) allItems = allItems.concat(extractTaskList(homeworkDiv, "作业"));
    if (testDiv) allItems = allItems.concat(extractTaskList(testDiv, "测试"));

    console.log("[IMAU] 总抓取 " + allItems.length + " 条数据（含课表）");
    return allItems;
  }
})();