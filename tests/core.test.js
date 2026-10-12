// =====================================================================
//  core.test.js — модульные тесты ядра (js/core.js).
//
//  Запуск из корня проекта: node --test
//  Ставить ничего не нужно: describe, it и assert встроены в Node.
//  Добавить тест = дописать it(...) в describe нужной функции.
//  Числа здесь — эталон из лабораторных: если тест упал, значит
//  изменилось поведение ядра, а не «устарел тест».
// =====================================================================

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  SAMPLES, STOP_DEFAULT,
  tokenize, freq, kwic, sentences, stylometry, wordLengths,
  average, standardDeviation, countCliches,
} = require("./load-core.js");

// Для дробных чисел: округляем, чтобы 0.1 + 0.2 не мешало сравнению
const round = (x, digits = 2) => Math.round(x * 10 ** digits) / 10 ** digits;

describe("tokenize: что машина считает словом", () => {
  it("дефис внутри слова сохраняется", () => {
    assert.deepEqual(tokenize("По-моему"), ["по-моему"]);
  });

  it("«т. е.» распадается на две буквы", () => {
    assert.deepEqual(tokenize("т. е."), ["т", "е"]);
  });

  it("цифры словом не считаются", () => {
    assert.deepEqual(tokenize("в 2004 году"), ["в", "году"]);
  });

  it("апостроф режет didn't надвое", () => {
    assert.deepEqual(tokenize("didn't"), ["didn", "t"]);
  });

  it("пустой текст — пустой список", () => {
    assert.deepEqual(tokenize(""), []);
  });

  it("регистр не важен", () => {
    assert.deepEqual(tokenize("Реферат РЕФЕРАТ"), ["реферат", "реферат"]);
  });
});

describe("wordLengths: длины слов", () => {
  it("сколько слов каждой длины, по возрастанию", () => {
    assert.deepEqual(wordLengths(tokenize("я ты они")), [[1, 1], [2, 1], [3, 1]]);
  });
});

describe("freq: частотный список", () => {
  it("частоты по убыванию", () => {
    assert.deepEqual(freq(["б", "а", "а"]), [["а", 2], ["б", 1]]);
  });
});

describe("kwic: конкорданс", () => {
  it("«реферат» целиком: 3 вхождения", () => {
    assert.equal(kwic(SAMPLES.ru, "реферат", 20, false).length, 3);
  });

  it("«реферат» как начало слова: 6", () => {
    assert.equal(kwic(SAMPLES.ru, "реферат", 20, true).length, 6);
  });

  it("регистр запроса не важен", () => {
    assert.equal(kwic("Сталь и сталь", "СТАЛЬ", 5, false).length, 2);
  });

  it("строка конкорданса: контекст и слово как в тексте", () => {
    assert.deepEqual(
      kwic("А Реферат б", "реферат", 2, false),
      [{ left: "А ", word: "Реферат", right: " б" }],
    );
  });
});

describe("sentences: границы предложений", () => {
  it("«т. е.» ломает границы предложений", () => {
    assert.deepEqual(
      sentences("Это т. е. пример. Второе!"),
      ["Это т.", "е.", "пример.", "Второе!"],
    );
  });
});

describe("stylometry: показатели текста", () => {
  const ru = stylometry(SAMPLES.ru, new Set(STOP_DEFAULT), ["важно отметить"]);

  it("в русском примере 80 слов", () => {
    assert.equal(ru.tokens, 80);
  });

  it("машина нашла 11 «предложений» (на самом деле их 9)", () => {
    assert.equal(ru.sentences, 11);
  });

  it("TTR русского примера 0,86", () => {
    assert.equal(round(ru.ttr), 0.86);
  });

  // 100 раз «а», потом «б»: в первые 100 слов «б» не попадает — 1 разное слово из 100
  it("TTR на первых 100 словах: 101-е слово не считается", () => {
    assert.equal(stylometry("а ".repeat(100) + "б", new Set(), []).ttr100, 0.01);
  });

  it("средняя длина слова: раз два три = 3", () => {
    assert.equal(stylometry("Раз два три.", new Set(), []).meanWordLen, 3);
  });
});

describe("помощники стилометрии", () => {
  it("среднее: 1, 2, 3 → 2", () => {
    assert.equal(average([1, 2, 3]), 2);
  });

  // классический пример: statistics.pstdev([2, 4, 4, 4, 5, 5, 7, 9]) == 2.0
  it("разброс как pstdev (делим на n)", () => {
    assert.equal(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), 2);
  });

  it("клише: без учёта регистра, ненайденные не выводятся", () => {
    assert.deepEqual(
      countCliches("Важно отметить, что ВАЖНО ОТМЕТИТЬ.", ["важно отметить", "таким образом"]),
      [["важно отметить", 2]],
    );
  });
});
