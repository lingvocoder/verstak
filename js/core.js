// =====================================================================
//  core.js — ЯДРО верстака: лингвистические функции.
//
//  Правило: функции здесь получают текст и возвращают числа, списки, объекты.
//  Они НЕ трогают страницу (никаких document, кнопок, таблиц). Поэтому
//  их можно вызывать из консоли браузера и проверять тестами (tests/tests.html).
//
//  Именно этот код ты видишь под кнопкой «Показать код».
// =====================================================================

// Шаблон слова. Разбор по частям — в комментариях внутри tokenize:
// студенты видят только код функций, а не комментарии над ними.
const WORD = /\p{L}+(?:-\p{L}+)*/gu;

function tokenize(text) {
  // Шаблон WORD по частям.
  // \p{L}+ — одна или больше букв
  // любого алфавита.
  // (?:-\p{L}+)* — дальше 0 или
  // больше раз «дефис + буквы»:
  // по-моему.
  // g — искать все совпадения.
  // u — Юникод: без него \p{L}
  // не работает.
  // Цифр и апострофа в шаблоне нет:
  // «2004» — не слово,
  // didn't → didn + t.

  // все буквы — маленькие:
  // «Реферат» и «реферат» — одно
  const lower = text.toLowerCase();
  // все куски по шаблону,
  // как в Python:
  // re.findall(WORD, lower)
  const words = lower.match(WORD);
  // если слов нет, match возвращает
  // null, а не пустой список
  if (words === null) {
    return [];
  }
  return words;
}

function freq(tokens) {
  // словарь «слово → сколько раз»
  // (Map — как dict в Python)
  const counts = new Map();
  for (const token of tokens) {
    // как в Python:
    // if token not in counts
    if (!counts.has(token)) {
      counts.set(token, 0);
    }
    // как в Python:
    // counts[token] += 1
    const count = counts.get(token);
    counts.set(token, count + 1);
  }
  // пары [слово, частота],
  // как в Python:
  // list(counts.items())
  const pairs = Array.from(counts);
  // по убыванию частоты,
  // как в Python: sorted(pairs,
  //   key=lambda p: p[1],
  //   reverse=True)
  // sort сравнивает две пары a и b:
  // если b[1] - a[1] больше нуля,
  // b встаёт раньше.
  // При равной частоте слова идут
  // в порядке появления в тексте.
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs;
}

function kwic(
  text, query, width, asPrefix
) {
  // Конкорданс (KWIC): каждое
  // вхождение query и по width
  // знаков слева и справа от него.
  // Контекст режем по знакам, а не
  // по словам: края могут обрезать
  // слово. Так задумано.
  const target =
    query.toLowerCase();
  const lines = [];
  // все совпадения с шаблоном WORD,
  // как re.finditer в Python
  const found = text.matchAll(WORD);
  for (const match of found) {
    // match[0] — само слово,
    // match.index — где оно стоит
    const word = match[0];
    const start = match.index;
    const end = start + word.length;
    // с запросом сравниваем
    // маленькими буквами
    const low = word.toLowerCase();
    let hit;
    if (asPrefix) {
      // галочка «как начало слова»,
      // как в Python: startswith
      hit = low.startsWith(target);
    } else {
      hit = low === target;
    }
    // не то слово — к следующему
    if (!hit) {
      continue;
    }
    // начало левого контекста;
    // не меньше 0 (начало текста):
    // slice(-5) считал бы с конца
    let from = start - width;
    if (from < 0) {
      from = 0;
    }
    // как text[from:start] в Python
    const left =
      text.slice(from, start);
    const right =
      text.slice(end, end + width);
    // строка конкорданса — словарь,
    // как dict в Python
    lines.push({
      left: left,
      word: word,
      right: right,
    });
  }
  return lines;
}

function sentences(text) {
  // Предложение кончается
  // на . ! ? или … перед пробелом.
  // Шаблон разреза cut по частям.
  // \s+ — пробелы и переносы строк.
  // (?<=[.!?…]) — «посмотри назад»:
  // перед пробелом стоит знак
  // конца. Знак проверяется,
  // но не вырезается и остаётся
  // в предложении.
  // Ловушка: «т. е.» тоже даёт
  // разрез — машина не знает
  // сокращений.
  const cut = /(?<=[.!?…])\s+/;
  const parts = text.split(cut);
  // убираем пробелы по краям
  // и пустые куски, как в Python:
  // [p.strip() for p in parts
  //  if p.strip()]
  const result = [];
  for (const part of parts) {
    const sentence = part.trim();
    if (sentence !== "") {
      result.push(sentence);
    }
  }
  return result;
}

function stylometry(text, stopSet, cliches) {
    const sents = sentences(text);              // режем один раз и берём дважды: длины и количество
    const lens = sents.map(s => tokenize(s).length).filter(n => n > 0); // длина каждого предложения в словах
    const tokens = tokenize(text);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length); // разброс (стандартное отклонение)
    const meanWordLen = tokens.reduce((acc, t) => acc + t.length, 0) / tokens.length; /// средняя длина слова в буквах
    const firstHundred = tokens.slice(0, 100);   // TTR зависит от длины, поэтому считаем ещё и на первых 100 словах
    const low = text.toLowerCase();

    return {
        tokens: tokens.length,                  // всего слов
        sentences: sents.length,                // сколько «предложений» нашла машина
        meanLen: mean,
        sdLen: sd,
        ttr: new Set(tokens).size / tokens.length,
        ttr100: new Set(firstHundred).size / firstHundred.length,
        stopShare: tokens.filter(t => stopSet.has(t)).length / tokens.length,
        meanWordLen: meanWordLen,
        // клише: режем текст по клише — кусков на 1 больше, чем вхождений
        cliches: cliches.map(c => [c, low.split(c).length - 1]).filter(([, n]) => n > 0),

    }

}

// Сколько слов каждой длины: [[1, 5], [2, 12], ...] — «кривая Менденхолла» (1887)
function wordLengths(tokens) {
  // словарь «длина слова → сколько таких слов»
  // (тот же приём, что в freq)
  const counts = new Map();
  for (const token of tokens) {
    // сколько букв в слове
    const length = token.length;
    if (!counts.has(length)) {
      counts.set(length, 0);
    }
    counts.set(length, counts.get(length) + 1);
  }
  // пары [длина, сколько слов] по возрастанию
  // длины, как в Python: sorted(counts.items())
  const pairs = Array.from(counts);
  pairs.sort((a, b) => a[0] - b[0]);
  return pairs;
}