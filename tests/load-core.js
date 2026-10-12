// =====================================================================
//  load-core.js — подключает data.js и core.js к тестам в Node.
//
//  Эти файлы — обычные скрипты для браузера, а не модули: в них нет
//  export, поэтому require их не подключит. Выполняем их так же, как
//  браузер выполняет <script>: по очереди, в одном общем пространстве
//  имён. Сами файлы ради тестов не меняются.
// =====================================================================

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Порядок тот же, что в index.html: core.js пользуется тем, что объявлено в data.js
for (const file of ["data.js", "core.js"]) {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
  // runInThisContext — в том же «мире», что и тест: тогда массивы из ядра
  // и массивы в ожиданиях теста одного вида, и строгое сравнение их не путает
  vm.runInThisContext(code, { filename: file });
}

// const из скриптов не становятся свойствами globalThis, но видны следующему скрипту.
// Поэтому забираем нужные имена ещё одним маленьким скриптом
module.exports = vm.runInThisContext(`({
  SAMPLES, STOP_DEFAULT,
  tokenize, freq, kwic, sentences, stylometry, wordLengths,
  average, standardDeviation, countCliches,
})`);
