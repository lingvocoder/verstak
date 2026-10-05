// =====================================================================
//  ui.js — ИНТЕРФЕЙС: связывает функции из core.js со страницей.
//
//  Схема одна для всех вкладок:
//    пользователь что-то меняет → срабатывает событие → renderAll()
//    → каждая render-функция берёт данные из полей, зовёт функцию ядра
//      и рисует результат в таблицу.
// =====================================================================

// Короткое имя для поиска элемента по id: $("text") вместо document.getElementById("text")
const $ = id => document.getElementById(id);
const text = $("text"), textB = $("textB");

// ---------- начальное заполнение страницы ----------
$("version").textContent = VERSION;
$("stop").value = STOP_DEFAULT;
$("cliches").value = CLICHES_DEFAULT;
text.value = SAMPLES.ru;

// Блоки «Показать код»: функция в JavaScript умеет выдать собственный исходный текст.
// Поэтому студенты всегда видят ровно тот код, который сейчас работает.
$("code-freq").textContent =
  "// Слово = буквы любого алфавита (\\p{L}) подряд, можно через дефис.\n" +
  "// Цифр и апострофа в шаблоне нет — поэтому «2004» не слово, а didn't распадается.\n" +
  "const WORD = " + WORD + ";\n\n" + tokenize + "\n\n" + freq;
$("code-kwic").textContent = kwic.toString();
$("code-style").textContent = sentences + "\n\n" + stylometry;

// ---------- мелкие помощники ----------
const stopSet = () => new Set(tokenize($("stop").value));          // стоп-слова из поля → множество
const fmt = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "—"; // 0.8625 → «0,86»
// Экранирование: если в тексте есть < или &, браузер не должен принять их за разметку
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- вкладка «Частоты» ----------
function renderFreq() {
    let tokens = tokenize(text.value);
    const all = tokens.length, types = new Set(tokens).size;
    if ($("useStop").checked) { const s = stopSet(); tokens = tokens.filter(t => !s.has(t)); }
    const rows = freq(tokens).slice(0, +$("topN").value);          // +"20" → 20: строка в число
    $("count").textContent = all + " слов";
    $("freqStats").innerHTML =
      `<div class="stats__item"><span class="stats__value">${all}</span><span class="stats__label">словоупотреблений</span></div>` +
      `<div class="stats__item"><span class="stats__value">${types}</span><span class="stats__label">разных словоформ</span></div>` +
      `<div class="stats__item"><span class="stats__value">${fmt(types / all)}</span><span class="stats__label">доля разных (TTR)</span></div>`;
    if (!rows.length) { $("freqTable").innerHTML = `<tr><td class="table__empty">Нет слов</td></tr>`; return; }
    $("freqTable").innerHTML =
      `<tr><th class="table__num">Ранг</th><th>Словоформа</th><th class="table__num">Частота</th><th class="table__num">Ранг × частота</th></tr>` +
      rows.map(([w, n], i) => `<tr><td class="table__num">${i + 1}</td><td>${esc(w)}</td><td class="table__num">${n}</td><td class="table__num">${(i + 1) * n}</td></tr>`).join("");
}

// ---------- вкладка «Конкорданс» ----------
function renderKwic() {
    const q = $("query").value.trim();
    if (!q) { $("kwicTable").innerHTML = ""; $("kwicStats").textContent = "Введите слово"; return; }
    const lines = kwic(text.value, q, +$("width").value, $("prefix").checked);
    $("kwicStats").textContent = `Найдено: ${lines.length}`;
    $("kwicTable").innerHTML = lines.map(l =>
        `<tr><td class="concordance__left">${esc(l.left)}</td><td class="concordance__word">${esc(l.word)}</td><td class="concordance__right">${esc(l.right)}</td></tr>`).join("")
      || `<tr><td class="table__empty">Не найдено</td></tr>`;
}

// ---------- вкладка «Стилометрия» ----------
function renderStyle() {
    const s = stopSet();
    const cl = $("cliches").value.split("\n").map(x => x.trim().toLowerCase()).filter(Boolean);
    const A = text.value.trim() ? stylometry(text.value, s, cl) : null;
    const B = textB.value.trim() ? stylometry(textB.value, s, cl) : null;
    // Каждая строка таблицы: [название показателя, как достать значение из результата]
    const rows = [
        ["Слов", r => r.tokens],
        ["Предложений", r => r.sentences],
        ["Средняя длина предложения (слов)", r => fmt(r.meanLen, 1)],
        ["Разброс длины предложений", r => fmt(r.sdLen, 1)],
        ["Доля разных слов (весь текст)", r => fmt(r.ttr)],
        ["Доля разных слов (первые 100)", r => fmt(r.ttr100)],
        ["Доля стоп-слов", r => fmt(r.stopShare)],
        ["Средняя длина слова", r => fmt(r.meanWordLen,1)],
        ["Клише", r => r.cliches.length ? r.cliches.map(([c, n]) => `${esc(c)} (${n})`).join(", ") : "—"]
    ];
    if (!A && !B) { $("styleTable").innerHTML = `<tr><td class="table__empty">Нет текста</td></tr>`; return; }
    $("styleTable").innerHTML =
      `<tr><th>Показатель</th><th>Текст А</th>${B ? "<th>Текст Б</th>" : ""}</tr>` +
      rows.map(([name, f]) => `<tr><td>${name}</td><td>${A ? f(A) : "—"}</td>${B ? `<td>${f(B)}</td>` : ""}</tr>`).join("");
}

// ---------- вкладка «Длины слов» ----------
function renderLen() {
    const rows = wordLengths(tokenize(text.value));
    $("lenTable").innerHTML =
      `<tr><th class="table__num">Букв в слове</th><th class="table__num">Сколько слов</th></tr>` +
      rows.map(([len, n]) => `<tr><td class="table__num">${len}</td><td class="table__num">${n}</td></tr>`).join("");
}

function renderAll() { renderFreq(); renderKwic(); renderStyle(); renderLen(); }

// ---------- события: кто что слушает ----------

// Вкладки: нажатая кнопка получает модификатор --active, остальные теряют; то же с секциями
document.querySelectorAll(".tabs__button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs__button").forEach(x => x.classList.toggle("tabs__button--active", x === b));
    document.querySelectorAll(".tab-panel").forEach(t => t.classList.toggle("tab-panel--active", t.id === "tab-" + b.dataset.tab));
}));

// Кнопки примеров: подставить текст и подходящее слово для конкорданса
document.querySelectorAll("[data-sample]").forEach(b => b.addEventListener("click", () => {
    text.value = SAMPLES[b.dataset.sample];
    $("query").value = b.dataset.sample === "ru" ? "реферат" : "go";
    renderAll();
}));
$("clear").addEventListener("click", () => { text.value = ""; renderAll(); text.focus(); });

// input — срабатывает на каждую набранную букву; change — когда поменяли галочку или список
["text", "textB", "stop", "cliches", "query"].forEach(id => $(id).addEventListener("input", renderAll));
["useStop", "topN", "prefix", "width"].forEach(id => $(id).addEventListener("change", renderAll));

renderAll();   // первый расчёт при открытии страницы
