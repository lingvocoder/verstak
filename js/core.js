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

function stylometry(
  text, stopSet, cliches
) {
  const tokens = tokenize(text);
  const sents = sentences(text);

  // длина каждого предложения
  // в словах. «Предложения» без
  // слов (например, «2004.»)
  // не считаем
  const lens = [];
  for (const sent of sents) {
    const words = tokenize(sent);
    if (words.length > 0) {
      lens.push(words.length);
    }
  }

  // длина каждого слова в буквах
  const wordLens = tokens.map(
    token => token.length
  );

  // TTR зависит от длины текста,
  // поэтому считаем его ещё и на
  // первых 100 словах
  const first100 =
    tokens.slice(0, 100);
  const ttr100 =
    typeTokenRatio(first100);

  const stop =
    stopWordShare(tokens, stopSet);
  const found =
    countCliches(text, cliches);

  // результат — словарь,
  // как dict в Python
  return {
    // всего слов
    tokens: tokens.length,
    // сколько «предложений» нашла
    // машина (с ловушкой «т. е.»)
    sentences: sents.length,
    // средняя длина предложения
    meanLen: average(lens),
    // разброс длины предложений
    sdLen: standardDeviation(lens),
    // доля разных словоформ
    ttr: typeTokenRatio(tokens),
    ttr100: ttr100,
    // доля стоп-слов
    stopShare: stop,
    // средняя длина слова в буквах
    meanWordLen: average(wordLens),
    // найденные клише и их число
    cliches: found,
  };
}

function average(values) {
  // среднее арифметическое,
  // как statistics.mean в Python
  let sum = 0;
  for (const value of values) {
    sum = sum + value;
  }
  return sum / values.length;
}

function standardDeviation(values) {
  // разброс вокруг среднего,
  // как statistics.pstdev в Python:
  // делим на n, а не на n - 1
  const mean = average(values);
  // квадрат отклонения каждого
  // числа от среднего
  const squares = [];
  for (const value of values) {
    const diff = value - mean;
    squares.push(diff * diff);
  }
  // средний квадрат отклонения —
  // дисперсия; разброс — корень
  // из неё
  const variance = average(squares);
  return Math.sqrt(variance);
}

function typeTokenRatio(tokens) {
  // TTR = разных словоформ / всего,
  // как в Python:
  // len(set(tokens)) / len(tokens)
  const types = new Set(tokens);
  return types.size / tokens.length;
}

function stopWordShare(
  tokens, stopSet
) {
  // какая доля слов текста —
  // стоп-слова («и», «в», «the»…)
  let count = 0;
  for (const token of tokens) {
    if (stopSet.has(token)) {
      count = count + 1;
    }
  }
  return count / tokens.length;
}

function countCliches(
  text, cliches
) {
  // клише ищем без учёта регистра
  const low = text.toLowerCase();
  const found = [];
  for (const cliche of cliches) {
    // режем текст по клише: кусков
    // на 1 больше, чем вхождений.
    // Как в Python: low.count(…)
    const parts = low.split(cliche);
    const count = parts.length - 1;
    // отсутствующие не выводим
    if (count > 0) {
      found.push([cliche, count]);
    }
  }
  return found;
}

function wordLengths(tokens) {
  // Сколько слов каждой длины:
  // [[1, 5], [2, 12], …].
  // «Кривая Менденхолла» (1887):
  // у разных авторов она разная.
  // Слова берутся из tokenize —
  // его код на вкладке «Частоты».

  // словарь «длина → сколько слов»
  // (тот же приём, что в freq)
  const counts = new Map();
  for (const token of tokens) {
    // сколько букв в слове
    const length = token.length;
    if (!counts.has(length)) {
      counts.set(length, 0);
    }
    const n = counts.get(length);
    counts.set(length, n + 1);
  }
  // пары [длина, сколько слов]
  // по возрастанию длины,
  // как в Python:
  // sorted(counts.items())
  const pairs = Array.from(counts);
  pairs.sort((a, b) => a[0] - b[0]);
  return pairs;
}
