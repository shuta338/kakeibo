(function () {
  "use strict";

  var STORAGE_KEY = "adfree-kakeibo-entries-v1";
  var CATEGORY_STORAGE_KEY = "adfree-kakeibo-categories-v1";
  var DEFAULT_CATEGORIES = [
    { name: "食費", icon: "🍴" },
    { name: "交際費", icon: "🤝" },
    { name: "日用品", icon: "📝" },
    { name: "衣類", icon: "👕" },
    { name: "美容室", icon: "💇" },
    { name: "医療費", icon: "🏥" },
    { name: "本", icon: "📖" },
    { name: "風俗", icon: "🚕" },
    { name: "その他", icon: "🔧" }
  ];

  var state = {
    entries: loadEntries(),
    categories: loadCategories(),
    selectedMonth: startOfMonth(new Date()),
    viewMode: "month",
    selectedCategory: "",
    returnPanel: "dashboardPanel",
    scrollTimer: 0,
    dashboardColumns: []
  };

  var elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    elements = {
      entryForm: document.getElementById("entryForm"),
      entryId: document.getElementById("entryId"),
      dateInput: document.getElementById("dateInput"),
      datePreview: document.getElementById("datePreview"),
      amountInput: document.getElementById("amountInput"),
      categoryInput: document.getElementById("categoryInput"),
      memoInput: document.getElementById("memoInput"),
      saveButton: document.getElementById("saveButton"),
      cancelEditButton: document.getElementById("cancelEditButton"),
      closeInputButton: document.getElementById("closeInputButton"),
      addEntryButton: document.getElementById("addEntryButton"),
      backToDashboardButton: document.getElementById("backToDashboardButton"),
      yearLabel: document.getElementById("yearLabel"),
      monthLabel: document.getElementById("monthLabel"),
      prevMonth: document.getElementById("prevMonth"),
      nextMonth: document.getElementById("nextMonth"),
      ledgerTable: document.getElementById("ledgerTable"),
      ledgerFixedColumn: document.getElementById("ledgerFixedColumn"),
      ledgerMonthScroll: document.getElementById("ledgerMonthScroll"),
      ledgerMonthGrid: document.getElementById("ledgerMonthGrid"),
      categoryDetailTitle: document.getElementById("categoryDetailTitle"),
      categoryDetailTotal: document.getElementById("categoryDetailTotal"),
      categoryDetailList: document.getElementById("categoryDetailList"),
      entryList: document.getElementById("entryList"),
      categoryList: document.getElementById("categoryList"),
      entryCount: document.getElementById("entryCount"),
      exportButton: document.getElementById("exportButton")
    };

    elements.dateInput.value = toDateInputValue(new Date());
    updateDatePreview();
    refreshCategories();
    bindEvents();
    render();
    registerServiceWorker();
  }

  function bindEvents() {
    elements.entryForm.addEventListener("submit", saveEntry);
    elements.dateInput.addEventListener("change", updateDatePreview);
    elements.dateInput.addEventListener("input", updateDatePreview);
    elements.cancelEditButton.addEventListener("click", resetForm);
    elements.closeInputButton.addEventListener("click", closeInputPanel);
    elements.addEntryButton.addEventListener("click", function () {
      openInputPanel(getActivePanelId() === "categoryDetailPanel" ? state.selectedCategory : "");
    });
    elements.backToDashboardButton.addEventListener("click", function () {
      activateTab("dashboardPanel");
    });
    elements.prevMonth.addEventListener("click", function () {
      moveMonth(-1);
    });
    elements.nextMonth.addEventListener("click", function () {
      moveMonth(1);
    });
    elements.ledgerMonthScroll.addEventListener("scroll", syncMonthFromScroll);
    elements.monthLabel.addEventListener("click", function () {
      state.selectedMonth = startOfMonth(new Date());
      state.viewMode = "month";
      render();
    });
    elements.exportButton.addEventListener("click", exportCsv);

    document.querySelectorAll(".tab-button").forEach(function (button) {
      button.addEventListener("click", function () {
        activateTab(button.dataset.tab);
      });
    });
  }

  function saveEntry(event) {
    event.preventDefault();

    var amount = Number(elements.amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      elements.amountInput.focus();
      return;
    }

    var entry = {
      id: elements.entryId.value || createId(),
      type: "expense",
      date: elements.dateInput.value,
      amount: Math.round(amount),
      category: elements.categoryInput.value,
      memo: elements.memoInput.value.trim()
    };

    var existingIndex = state.entries.findIndex(function (item) {
      return item.id === entry.id;
    });

    if (existingIndex >= 0) {
      state.entries[existingIndex] = entry;
    } else {
      state.entries.push(entry);
    }

    state.selectedMonth = startOfMonth(new Date(entry.date + "T00:00:00"));
    state.viewMode = "month";
    persist();
    var returnPanel = state.returnPanel;
    resetForm();
    render();
    activateTab(returnPanel);
  }

  function editEntry(id) {
    var entry = state.entries.find(function (item) {
      return item.id === id;
    });
    if (!entry) return;

    elements.entryId.value = entry.id;
    refreshCategories();
    elements.dateInput.value = entry.date;
    updateDatePreview();
    elements.amountInput.value = entry.amount;
    elements.categoryInput.value = entry.category;
    elements.memoInput.value = entry.memo || "";
    elements.saveButton.textContent = "更新";
    elements.cancelEditButton.hidden = false;
    state.returnPanel = getActivePanelId();
    activateTab("inputPanel");
    elements.amountInput.focus();
  }

  function deleteEntry(id) {
    var entry = state.entries.find(function (item) {
      return item.id === id;
    });
    if (!entry) return;

    var label = entry.category + " " + formatCurrency(entry.amount);
    if (!window.confirm(label + " を削除しますか？")) return;

    state.entries = state.entries.filter(function (item) {
      return item.id !== id;
    });
    persist();
    render();
  }

  function resetForm() {
    elements.entryId.value = "";
    elements.amountInput.value = "";
    elements.memoInput.value = "";
    elements.dateInput.value = toDateInputValue(new Date());
    updateDatePreview();
    refreshCategories();
    elements.saveButton.textContent = "追加";
    elements.cancelEditButton.hidden = true;
  }

  function closeInputPanel() {
    var returnPanel = state.returnPanel || "dashboardPanel";
    resetForm();
    activateTab(returnPanel);
  }

  function updateDatePreview() {
    var dateParts = getDateParts(elements.dateInput.value);
    elements.datePreview.textContent = dateParts.fullDate + " " + dateParts.weekdayText;
  }

  function render() {
    var visibleEntries = getVisibleEntries();

    elements.yearLabel.textContent = state.selectedMonth.getFullYear();
    elements.monthLabel.textContent = state.viewMode === "year" ? "年間合計" : (state.selectedMonth.getMonth() + 1) + "月";
    elements.entryCount.textContent = visibleEntries.length + "件";

    renderDashboard();
    renderCategoryDetail(visibleEntries);
    renderEntries(visibleEntries);
    renderCategories(visibleEntries);
  }

  function renderDashboard() {
    var columns = getDashboardColumns();
    state.dashboardColumns = columns;
    var categoryNames = state.categories.map(function (category) {
      return category.name;
    });

    columns.forEach(function (column) {
      var columnTotals = getColumnCategoryTotals(column);
      Object.keys(columnTotals).forEach(function (category) {
        if (categoryNames.indexOf(category) === -1) {
          categoryNames.push(category);
        }
      });
    });

    elements.ledgerFixedColumn.innerHTML = "";
    elements.ledgerMonthGrid.innerHTML = "";
    elements.ledgerMonthGrid.style.gridTemplateColumns = "repeat(" + columns.length + ", 50%)";
    elements.ledgerTable.style.setProperty("--ledger-row-count", String(categoryNames.length + 3));

    elements.ledgerFixedColumn.appendChild(createFixedCell("支　出", "ledger-fixed-cell ledger-total-label"));
    categoryNames.forEach(function (categoryName) {
      var category = state.categories.find(function (item) {
        return item.name === categoryName;
      }) || { name: categoryName, icon: "・" };

      var label = document.createElement("button");
      label.className = "ledger-fixed-cell ledger-category-label";
      label.type = "button";
      label.textContent = category.icon + " " + category.name;
      label.addEventListener("click", function () {
        renameCategory(category.name);
      });
      elements.ledgerFixedColumn.appendChild(label);
    });

    var addButton = document.createElement("button");
    addButton.className = "ledger-fixed-cell ledger-add-label";
    addButton.type = "button";
    addButton.textContent = "＋ 費目を追加";
    addButton.addEventListener("click", addCategory);
    elements.ledgerFixedColumn.appendChild(addButton);
    elements.ledgerFixedColumn.appendChild(createFixedCell("支出", "ledger-fixed-cell ledger-footer-label"));

    columns.forEach(function (column) {
      var columnEntries = getEntriesForColumn(column);
      var columnTotals = getColumnCategoryTotals(column);
      var total = columnEntries.reduce(function (sum, entry) {
        return sum + entry.amount;
      }, 0);

      elements.ledgerMonthGrid.appendChild(createMonthHeaderCell(column));
      categoryNames.forEach(function (categoryName) {
        var amount = document.createElement("button");
        amount.className = "ledger-month-cell ledger-amount-cell";
        amount.type = "button";
        amount.textContent = formatNumber(columnTotals[categoryName] || 0);
        amount.addEventListener("click", function () {
          selectColumn(column);
          state.selectedCategory = categoryName;
          renderCategoryDetail(getVisibleEntries());
          activateTab("categoryDetailPanel");
        });
        elements.ledgerMonthGrid.appendChild(amount);
      });

      elements.ledgerMonthGrid.appendChild(createMonthSpacerCell());
      elements.ledgerMonthGrid.appendChild(createMonthTotalCell(total));
    });

    window.requestAnimationFrame(function () {
      scrollDashboardToSelected(columns);
    });
  }

  function createFixedCell(text, className) {
    var cell = document.createElement("div");
    cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function createMonthHeaderCell(column) {
    var cell = document.createElement("button");
    cell.className = "ledger-month-cell ledger-month-head";
    cell.type = "button";
    cell.textContent = getColumnLabel(column);
    cell.addEventListener("click", function () {
      selectColumn(column);
      render();
    });
    return cell;
  }

  function createMonthSpacerCell() {
    var cell = document.createElement("div");
    cell.className = "ledger-month-cell ledger-add-spacer";
    return cell;
  }

  function createMonthTotalCell(total) {
    var cell = document.createElement("div");
    cell.className = "ledger-month-cell ledger-total-amount negative";
    cell.textContent = "-" + formatNumber(total);
    return cell;
  }

  function getColumnCategoryTotals(column) {
    var totals = {};
    getEntriesForColumn(column).forEach(function (entry) {
      totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
    });
    return totals;
  }

  function getEntriesForColumn(column) {
    return state.entries.filter(function (entry) {
      var date = new Date(entry.date + "T00:00:00");
      if (entry.type !== "expense" || date.getFullYear() !== column.year) return false;
      return column.type === "year" || date.getMonth() === column.month;
    });
  }

  function getDashboardColumns() {
    var columns = [];
    var start = new Date(state.selectedMonth.getFullYear(), state.selectedMonth.getMonth() - 12, 1);
    for (var index = 0; index < 27; index += 1) {
      var date = new Date(start.getFullYear(), start.getMonth() + index, 1);
      columns.push({ type: "month", year: date.getFullYear(), month: date.getMonth() });
      if (date.getMonth() === 11) {
        columns.push({ type: "year", year: date.getFullYear(), month: 11 });
      }
    }
    return columns;
  }

  function getColumnLabel(column) {
    return column.type === "year" ? column.year + "年" : (column.month + 1) + "月";
  }

  function selectColumn(column) {
    state.selectedMonth = new Date(column.year, column.month, 1);
    state.viewMode = column.type === "year" ? "year" : "month";
    elements.yearLabel.textContent = state.selectedMonth.getFullYear();
    elements.monthLabel.textContent = state.viewMode === "year" ? "年間合計" : (state.selectedMonth.getMonth() + 1) + "月";
  }

  function scrollDashboardToSelected(columns) {
    if (!elements.ledgerMonthScroll.clientWidth) return;
    var selectedIndex = columns.findIndex(function (column) {
      return column.year === state.selectedMonth.getFullYear() &&
        column.month === state.selectedMonth.getMonth() &&
        ((state.viewMode === "year" && column.type === "year") || (state.viewMode === "month" && column.type === "month"));
    });
    if (selectedIndex < 0) return;

    var columnWidth = elements.ledgerMonthScroll.clientWidth / 2;
    elements.ledgerMonthScroll.scrollLeft = selectedIndex * columnWidth;
  }

  function syncMonthFromScroll() {
    window.clearTimeout(state.scrollTimer);
    state.scrollTimer = window.setTimeout(function () {
      var columns = state.dashboardColumns;
      var columnWidth = elements.ledgerMonthScroll.clientWidth / 2;
      if (!columnWidth || !columns.length) return;

      var centerX = elements.ledgerMonthScroll.scrollLeft + (elements.ledgerMonthScroll.clientWidth / 2);
      var index = Math.max(0, Math.min(
        columns.length - 1,
        Math.floor(centerX / columnWidth)
      ));
      selectColumn(columns[index]);
    }, 140);
  }

  function renderCategoryDetail(entries) {
    var firstCategory = state.categories[0] ? state.categories[0].name : "";
    var categoryName = state.selectedCategory || firstCategory;
    var rows = entries
      .filter(function (entry) {
        return entry.category === categoryName;
      })
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      });
    var total = rows.reduce(function (sum, entry) {
      return sum + entry.amount;
    }, 0);

    elements.categoryDetailTitle.textContent = categoryName;
    elements.categoryDetailTotal.textContent = formatNumber(total);
    elements.categoryDetailList.innerHTML = "";

    if (!rows.length) {
      elements.categoryDetailList.appendChild(createEmpty("この費目の記録はありません"));
      return;
    }

    rows.forEach(function (entry) {
      elements.categoryDetailList.appendChild(createDetailRow(entry));
    });

    elements.categoryDetailList.appendChild(createDetailTotalRow(categoryName, total));
  }

  function createDetailTotalRow(categoryName, total) {
    var row = document.createElement("div");
    row.className = "detail-total-row";

    var label = document.createElement("span");
    label.textContent = categoryName + " 合計";

    var amount = document.createElement("strong");
    amount.textContent = formatNumber(total);

    row.appendChild(label);
    row.appendChild(amount);
    return row;
  }

  function renderEntries(entries) {
    elements.entryList.innerHTML = "";

    if (!entries.length) {
      elements.entryList.appendChild(createEmpty("この月の記録はありません"));
      return;
    }

    entries
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      })
      .forEach(function (entry) {
        var row = document.createElement("article");
        row.className = "entry-row";

        var main = document.createElement("div");
        main.className = "entry-main";

        var title = document.createElement("div");
        title.className = "entry-title";
        var category = document.createElement("strong");
        category.textContent = entry.category;
        title.appendChild(category);

        var meta = document.createElement("div");
        meta.className = "entry-meta";
        meta.textContent = formatDate(entry.date) + (entry.memo ? "・" + entry.memo : "");

        var actions = document.createElement("div");
        actions.className = "row-actions";
        actions.appendChild(actionButton("編集", function () {
          editEntry(entry.id);
        }));
        actions.appendChild(actionButton("削除", function () {
          deleteEntry(entry.id);
        }));

        main.appendChild(title);
        main.appendChild(meta);
        main.appendChild(actions);

        var amount = document.createElement("div");
        amount.className = "amount expense";
        amount.textContent = formatNumber(entry.amount);

        row.appendChild(main);
        row.appendChild(amount);
        elements.entryList.appendChild(row);
      });
  }

  function createDetailRow(entry) {
    var row = document.createElement("article");
    row.className = "entry-row";

    var main = document.createElement("div");
    main.className = "entry-main";

    var title = document.createElement("div");
    title.className = "entry-title";
    var date = document.createElement("strong");
    date.textContent = formatFullDate(entry.date);
    title.appendChild(date);

    var meta = document.createElement("div");
    meta.className = "entry-meta";
    meta.textContent = entry.memo || "メモなし";

    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(actionButton("編集", function () {
      editEntry(entry.id);
    }));
    actions.appendChild(actionButton("削除", function () {
      deleteEntry(entry.id);
    }));

    main.appendChild(title);
    main.appendChild(meta);
    main.appendChild(actions);

    var amount = document.createElement("div");
    amount.className = "amount expense";
    amount.textContent = formatNumber(entry.amount);

    row.appendChild(main);
    row.appendChild(amount);
    return row;
  }

  function renderCategories(entries) {
    elements.categoryList.innerHTML = "";

    if (!entries.length) {
      elements.categoryList.appendChild(createEmpty("支出カテゴリの集計はありません"));
      return;
    }

    var totals = {};
    entries.forEach(function (entry) {
      totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
    });

    var max = Math.max.apply(null, Object.keys(totals).map(function (key) {
      return totals[key];
    }));

    Object.keys(totals)
      .sort(function (a, b) {
        return totals[b] - totals[a];
      })
      .forEach(function (category) {
        var row = document.createElement("div");
        row.className = "entry-row category-row";

        var main = document.createElement("div");
        main.className = "entry-main";

        var title = document.createElement("div");
        title.className = "entry-title";
        var label = document.createElement("strong");
        label.textContent = category;
        title.appendChild(label);

        var track = document.createElement("div");
        track.className = "bar-track";
        var fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = Math.max(5, Math.round((totals[category] / max) * 100)) + "%";
        track.appendChild(fill);

        main.appendChild(title);
        main.appendChild(track);

        var amount = document.createElement("div");
        amount.className = "amount expense";
        amount.textContent = formatCurrency(totals[category]);

        row.appendChild(main);
        row.appendChild(amount);
        elements.categoryList.appendChild(row);
      });
  }

  function actionButton(label, onClick) {
    var button = document.createElement("button");
    button.className = "mini-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function createEmpty(text) {
    var node = document.createElement("div");
    node.className = "empty";
    node.textContent = text;
    return node;
  }

  function refreshCategories() {
    var current = elements.categoryInput.value;
    elements.categoryInput.innerHTML = "";

    state.categories.forEach(function (category) {
      var option = document.createElement("option");
      option.value = category.name;
      option.textContent = category.icon + " " + category.name;
      elements.categoryInput.appendChild(option);
    });

    if (state.categories.some(function (category) { return category.name === current; })) {
      elements.categoryInput.value = current;
    }
  }

  function renameCategory(oldName) {
    var newName = window.prompt("費目名を変更", oldName);
    if (newName === null) return;

    newName = cleanCategoryName(newName);
    if (!newName || newName === oldName) return;

    if (state.categories.some(function (category) { return category.name === newName; })) {
      window.alert("同じ名前の費目があります。");
      return;
    }

    state.categories = state.categories.map(function (category) {
      return category.name === oldName ? { name: newName, icon: category.icon } : category;
    });
    state.entries = state.entries.map(function (entry) {
      if (entry.category !== oldName) return entry;
      return Object.assign({}, entry, { category: newName });
    });
    if (state.selectedCategory === oldName) {
      state.selectedCategory = newName;
    }

    persist();
    persistCategories();
    refreshCategories();
    render();
  }

  function addCategory() {
    var name = window.prompt("追加する費目名");
    if (name === null) return;

    name = cleanCategoryName(name);
    if (!name) return;

    if (state.categories.some(function (category) { return category.name === name; })) {
      window.alert("同じ名前の費目があります。");
      return;
    }

    state.categories.push({ name: name, icon: "・" });
    state.selectedCategory = name;
    persistCategories();
    refreshCategories();
    render();
  }

  function cleanCategoryName(name) {
    return String(name).trim().replace(/\s+/g, " ").slice(0, 20);
  }

  function getVisibleEntries() {
    var year = state.selectedMonth.getFullYear();
    var month = state.selectedMonth.getMonth();
    return state.entries.filter(function (entry) {
      var date = new Date(entry.date + "T00:00:00");
      if (entry.type !== "expense" || date.getFullYear() !== year) return false;
      return state.viewMode === "year" || date.getMonth() === month;
    });
  }

  function moveMonth(offset) {
    var year = state.selectedMonth.getFullYear();
    var month = state.selectedMonth.getMonth();

    if (state.viewMode === "year") {
      state.viewMode = "month";
      state.selectedMonth = offset > 0 ? new Date(year + 1, 0, 1) : new Date(year, 11, 1);
      render();
      return;
    }

    if (offset > 0 && month === 11) {
      state.viewMode = "year";
      render();
      return;
    }

    state.selectedMonth = new Date(
      year,
      month + offset,
      1
    );
    state.viewMode = "month";
    render();
  }

  function activateTab(panelId) {
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === panelId);
    });
    document.querySelectorAll(".tab-button").forEach(function (button) {
      button.classList.toggle("active", button.dataset.tab === panelId);
    });
    elements.addEntryButton.hidden = panelId === "inputPanel";
  }

  function openInputPanel(categoryName) {
    state.returnPanel = getActivePanelId();
    resetForm();
    if (categoryName) {
      elements.categoryInput.value = categoryName;
    }
    activateTab("inputPanel");
    elements.amountInput.focus();
  }

  function getActivePanelId() {
    var activePanel = document.querySelector(".tab-panel.active");
    return activePanel ? activePanel.id : "dashboardPanel";
  }

  function exportCsv() {
    var entries = getVisibleEntries().slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });

    var rows = [["日付", "カテゴリ", "金額", "メモ"]].concat(entries.map(function (entry) {
      return [
        entry.date,
        entry.category,
        entry.amount,
        entry.memo || ""
      ];
    }));

    var csv = rows.map(function (row) {
      return row.map(escapeCsv).join(",");
    }).join("\r\n");

    var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = state.viewMode === "year"
      ? "kakeibo-" + state.selectedMonth.getFullYear() + "-year.csv"
      : "kakeibo-" + state.selectedMonth.getFullYear() + "-" + pad(state.selectedMonth.getMonth() + 1) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function escapeCsv(value) {
    var text = String(value).replace(/"/g, '""');
    return /[",\r\n]/.test(text) ? '"' + text + '"' : text;
  }

  function loadEntries() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function loadCategories() {
    try {
      var raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
      return normalizeCategories(parsed);
    } catch (error) {
      return DEFAULT_CATEGORIES.slice();
    }
  }

  function normalizeCategories(categories) {
    var result = [];
    categories.forEach(function (category) {
      var item = typeof category === "string" ? { name: category, icon: "・" } : category;
      var name = cleanCategoryName(item.name || "");
      if (!name || result.some(function (existing) { return existing.name === name; })) return;
      result.push({ name: name, icon: item.icon || "・" });
    });
    return result.length ? result : DEFAULT_CATEGORIES.slice();
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  }

  function persistCategories() {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(state.categories));
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function toDateInputValue(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function formatMonth(date) {
    return date.getFullYear() + "年" + (date.getMonth() + 1) + "月";
  }

  function formatDate(value) {
    var date = new Date(value + "T00:00:00");
    return (date.getMonth() + 1) + "/" + date.getDate();
  }

  function formatFullDate(value) {
    var date = new Date(value + "T00:00:00");
    return date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate();
  }

  function formatDateWithWeekday(value) {
    var dateParts = getDateParts(value);
    return dateParts.fullDate + " " + dateParts.weekday;
  }

  function getDateParts(value) {
    if (!value) return { fullDate: "", weekday: "", weekdayText: "" };
    var date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) return { fullDate: "", weekday: "", weekdayText: "" };

    var weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return {
      fullDate: date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日",
      weekday: weekdays[date.getDay()],
      weekdayText: "(" + weekdays[date.getDay()] + ")"
    };
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP", {
      maximumFractionDigits: 0
    }).format(value);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
