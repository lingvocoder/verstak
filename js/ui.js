// =====================================================================
//  ui.js — ИНТЕРФЕЙС: связывает функции из core.js со страницей.
//
//  Схема одна для всех вкладок:
//    пользователь что-то меняет → срабатывает событие → renderAll()
//    → каждая render-функция читает поля, зовёт функцию ядра
//      и рисует результат в таблицу.
//
//  Порядок в файле: элементы страницы → помощники → сборка таблиц
//  → вкладки → обработчики событий → запуск.
// =====================================================================

// ---------- элементы страницы: находим один раз и дальше берём отсюда ----------

const byId = id => document.getElementById(id);

const els = {
  version: byId("version"),
  // общий текст
  textA: byId("text-a"),
  clearButton: byId("clear-text"),
  wordCount: byId("word-count"),
  sampleButtons: document.querySelectorAll("[data-sample]"),
  // вкладки
  tabButtons: document.querySelectorAll("[role=tab]"),
  tabPanels: document.querySelectorAll("[role=tabpanel]"),
  // «Частоты»
  useStopWords: byId("use-stop-words"),
  topN: byId("top-n"),
  stopWords: byId("stop-words"),
  freqStats: byId("freq-stats"),
  freqTable: byId("freq-table"),
  freqCode: byId("code-freq"),
  // «Конкорданс»
  query: byId("kwic-query"),
  asPrefix: byId("kwic-prefix"),
  contextWidth: byId("kwic-width"),
  kwicStatus: byId("kwic-status"),
  kwicTable: byId("kwic-table"),
  kwicCode: byId("code-kwic"),
  // «Стилометрия»
  textB: byId("text-b"),
  cliches: byId("cliches"),
  styleTable: byId("style-table"),
  styleCode: byId("code-style"),
  // «Длины слов»
  lenTable: byId("len-table"),
  lenCode: byId("code-len"),
};

// ---------- помощники ----------

// Число с запятой: 0.8625 → «0,86». Если считать не из чего (NaN, Infinity) — прочерк.
function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits).replace(".", ",");
}

// Экранирование: если в тексте есть < или &, браузер не должен принять их за разметку.
// Любой текст пользователя попадает в innerHTML только через эту функцию.
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, char => HTML_ESCAPES[char]);
}

// Стоп-слова из поля → множество (как set() в Python): проверка «есть ли слово» быстрая
function readStopWords() {
  return new Set(tokenize(els.stopWords.value));
}

// Клише из поля: по одному на строку, без пустых строк, маленькими буквами
function readCliches() {
  return els.cliches.value
    .split("\n")
    .map(line => line.trim().toLowerCase())
    .filter(line => line !== "");
}

// Подсветка кода. Одна регулярка, четыре вида кусков (номер группы → класс):
// 1 — комментарий до конца строки, 2 — строка в кавычках,
// 3 — имя функции прямо перед «(», 4 — скобки и знаки препинания.
// Слева направо: на каждой позиции побеждает первая подходящая группа,
// поэтому «//» внутри строки и апостроф в комментарии разбор не ломают.
const CODE_TOKEN = /(\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([\p{L}_$][\p{L}\p{N}_$]*)(?=\()|([()[\]{}.,;])/gu;
const CODE_CLASSES = [null, "code__comment", "code__string", "code__function", "code__punct"];

// Одна строка кода → HTML. Каждый кусок экранируем отдельно и только потом оборачиваем в span:
// если экранировать всю строку заранее, " станет &quot; и регулярка будет резать сущности.
function highlightLine(code) {
  let html = "";
  let last = 0;
  for (const match of code.matchAll(CODE_TOKEN)) {
    // обычный текст между подсвеченными кусками
    html += escapeHtml(code.slice(last, match.index));
    const group = CODE_CLASSES.findIndex((name, i) => i > 0 && match[i] !== undefined);
    html += `<span class="${CODE_CLASSES[group]}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(code.slice(last));
}

// Исходный текст функции → блок «Показать код».
// Каждая строка — отдельный блок со своим отступом (--indent): если строка не влезает
// в ширину телефона, её продолжение встаёт под её же начало, а не к левому краю.
function showCode(pre, source) {
  pre.innerHTML = source
    .split("\n")
    .map(line => {
      const code = line.trimStart();
      const indent = line.length - code.length;
      // пустой строке нужен хотя бы пробел, иначе у неё не будет высоты
      return `<span class="code-line" style="--indent: ${indent}ch">${highlightLine(code) || " "}</span>`;
    })
    .join("");
}

// ---------- сборка таблиц ----------
// Содержимое ячеек — уже готовый HTML: текст пользователя экранируем до того, как передать сюда.

function cell(content, className) {
  const classAttr = className ? ` class="${className}"` : "";
  return `<td${classAttr}>${content}</td>`;
}

function headerCell(content, className) {
  const classAttr = className ? ` class="${className}"` : "";
  return `<th${classAttr}>${content}</th>`;
}

function row(cells) {
  return `<tr>${cells.join("")}</tr>`;
}

// Заполнить таблицу: строка заголовков (может не быть) + строки данных.
// Если данных нет и задан emptyText — одна серая строка с этим текстом.
function fillTable(table, headerRow, bodyRows, emptyText) {
  if (bodyRows.length === 0 && emptyText) {
    table.innerHTML = row([cell(emptyText, "table__empty")]);
    return;
  }
  table.innerHTML = (headerRow || "") + bodyRows.join("");
}

// ---------- вкладка «Частоты» ----------

function statsItem(value, label) {
  return `<div class="stats__item"><span class="stats__value">${value}</span><span class="stats__label">${label}</span></div>`;
}

function renderFreq() {
  const allTokens = tokenize(els.textA.value);
  const tokenCount = allTokens.length;
  const typeCount = new Set(allTokens).size;

  // стоп-слова убираем только из таблицы; счётчики выше считаются по всему тексту
  let tokens = allTokens;
  if (els.useStopWords.checked) {
    const stopWords = readStopWords();
    tokens = allTokens.filter(token => !stopWords.has(token));
  }
  const topN = Number(els.topN.value);   // значение <select> — строка: "20" → 20
  const rows = freq(tokens).slice(0, topN);

  els.wordCount.textContent = tokenCount + " слов";
  els.freqStats.innerHTML =
    statsItem(tokenCount, "словоупотреблений") +
    statsItem(typeCount, "разных словоформ") +
    statsItem(formatNumber(typeCount / tokenCount), "доля разных (TTR)");

  const headerRow = row([
    headerCell("Ранг", "table__num"),
    headerCell("Словоформа"),
    headerCell("Частота", "table__num"),
    headerCell("Ранг × частота", "table__num"),
  ]);
  // ранг × частота ≈ постоянная величина — закон Ципфа
  const bodyRows = rows.map(([word, count], index) => {
    const rank = index + 1;
    return row([
      cell(rank, "table__num"),
      cell(escapeHtml(word)),
      cell(count, "table__num"),
      cell(rank * count, "table__num"),
    ]);
  });
  fillTable(els.freqTable, headerRow, bodyRows, "Нет слов");
}

// ---------- вкладка «Конкорданс» ----------

function renderKwic() {
  const query = els.query.value.trim();
  if (query === "") {
    els.kwicTable.innerHTML = "";
    els.kwicStatus.textContent = "Введите слово";
    return;
  }

  const lines = kwic(els.textA.value, query, Number(els.contextWidth.value), els.asPrefix.checked);
  els.kwicStatus.textContent = `Найдено: ${lines.length}`;

  const bodyRows = lines.map(line => row([
    cell(escapeHtml(line.left), "concordance__left"),
    cell(escapeHtml(line.word), "concordance__word"),
    cell(escapeHtml(line.right), "concordance__right"),
  ]));
  fillTable(els.kwicTable, null, bodyRows, "Не найдено");
}

// ---------- вкладка «Стилометрия» ----------

// Строки таблицы: название показателя и как достать его значение из результата stylometry()
const STYLOMETRY_ROWS = [
  { label: "Слов", value: result => result.tokens },
  { label: "Предложений", value: result => result.sentences },
  { label: "Средняя длина предложения (слов)", value: result => formatNumber(result.meanLen, 1) },
  { label: "Разброс длины предложений", value: result => formatNumber(result.sdLen, 1) },
  { label: "Доля разных слов (весь текст)", value: result => formatNumber(result.ttr) },
  { label: "Доля разных слов (первые 100)", value: result => formatNumber(result.ttr100) },
  { label: "Доля стоп-слов", value: result => formatNumber(result.stopShare) },
  { label: "Средняя длина слова", value: result => formatNumber(result.meanWordLen, 1) },
  { label: "Клише", value: result => formatCliches(result.cliches) },
];

// [["важно отметить", 2], …] → «важно отметить (2), …»
function formatCliches(found) {
  if (found.length === 0) {
    return "—";
  }
  return found.map(([cliche, count]) => `${escapeHtml(cliche)} (${count})`).join(", ");
}

// Пустое поле → null: для него столбец не считаем
function analyze(text, stopWords, cliches) {
  if (text.trim() === "") {
    return null;
  }
  return stylometry(text, stopWords, cliches);
}

function renderStylometry() {
  const stopWords = readStopWords();
  const cliches = readCliches();
  const resultA = analyze(els.textA.value, stopWords, cliches);
  const resultB = analyze(els.textB.value, stopWords, cliches);

  if (!resultA && !resultB) {
    fillTable(els.styleTable, null, [], "Нет текста");
    return;
  }

  // столбец «Текст Б» показываем, только если второй текст есть.
  // «Текст А/Б» не переносим: переносится длинный столбец «Показатель»
  const headers = [headerCell("Показатель"), headerCell("Текст А", "table__nowrap")];
  if (resultB) {
    headers.push(headerCell("Текст Б", "table__nowrap"));
  }
  const bodyRows = STYLOMETRY_ROWS.map(({ label, value }) => {
    const cells = [cell(label), cell(resultA ? value(resultA) : "—")];
    if (resultB) {
      cells.push(cell(value(resultB)));
    }
    return row(cells);
  });
  fillTable(els.styleTable, row(headers), bodyRows);
}

// ---------- вкладка «Длины слов» ----------

function renderWordLengths() {
  const lengths = wordLengths(tokenize(els.textA.value));
  const headerRow = row([
    headerCell("Букв в слове", "table__num"),
    headerCell("Сколько слов", "table__num"),
  ]);
  const bodyRows = lengths.map(([length, count]) => row([
    cell(length, "table__num"),
    cell(count, "table__num"),
  ]));
  fillTable(els.lenTable, headerRow, bodyRows);
}

function renderAll() {
  renderFreq();
  renderKwic();
  renderStylometry();
  renderWordLengths();
}

// ---------- обработчики событий ----------

// Вкладка: у кнопки data-tab="freq" — секция id="tab-freq".
// Активная кнопка и секция получают модификатор --active; aria-selected — для экранного диктора.
function switchTab(activeButton) {
  for (const button of els.tabButtons) {
    const isActive = button === activeButton;
    button.classList.toggle("tabs__button--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }
  for (const panel of els.tabPanels) {
    const isActive = panel.id === "tab-" + activeButton.dataset.tab;
    panel.classList.toggle("tab-panel--active", isActive);
  }
}

// Пример текста + подходящее слово для конкорданса
function loadSample(language) {
  els.textA.value = SAMPLES[language];
  els.query.value = SAMPLE_QUERIES[language];
  renderAll();
}

function clearText() {
  els.textA.value = "";
  renderAll();
  els.textA.focus();
}

// ---------- запуск ----------

// Начальное заполнение: данные — из data.js
els.version.textContent = VERSION;
document.title = `Лингвистический верстак ${VERSION}`;
els.stopWords.value = STOP_DEFAULT;
els.cliches.value = CLICHES_DEFAULT;
els.textA.value = SAMPLES.ru;
els.query.value = SAMPLE_QUERIES.ru;

// Блоки «Показать код»: функция в JavaScript умеет выдать собственный исходный текст.
// Поэтому студенты всегда видят ровно тот код, который сейчас работает.
showCode(els.freqCode,
  "// Шаблон слова. Разбор по частям —\n" +
  "// внутри tokenize.\n" +
  "const WORD = " + WORD + ";\n\n" + tokenize + "\n\n" + freq);
showCode(els.kwicCode, kwic.toString());
// сверху — что считается, ниже — помощники, которые считают
const stylometryCode = [
  sentences, stylometry, average, standardDeviation,
  typeTokenRatio, stopWordShare, countCliches,
];
showCode(els.styleCode, stylometryCode.join("\n\n"));
showCode(els.lenCode, wordLengths.toString());

for (const button of els.tabButtons) {
  button.addEventListener("click", () => switchTab(button));
}
for (const button of els.sampleButtons) {
  button.addEventListener("click", () => loadSample(button.dataset.sample));
}
els.clearButton.addEventListener("click", clearText);

// input — на каждую набранную букву; change — когда поменяли галочку или выбор в списке
for (const field of [els.textA, els.textB, els.stopWords, els.cliches, els.query]) {
  field.addEventListener("input", renderAll);
}
for (const control of [els.useStopWords, els.topN, els.asPrefix, els.contextWidth]) {
  control.addEventListener("change", renderAll);
}

renderAll();   // первый расчёт при открытии страницы
