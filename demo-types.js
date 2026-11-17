// Practice-only examples for pair, reveal, and slider. Not part of the daily lists.
// Live dates never read this file. Open index.html?preview=demo
// The glass outline and the inner trapezoid share these numbers.
// Circles are packed only inside the trapezoid, which sits inside the glass.
const JAR = {
  view: "0 0 220 300",
  d: "M86 8 h48 l12 36 h42 l-10 220 a40 18 0 0 1 -40 14 H82 a40 18 0 0 1 -40 -14 L32 44 h42 z",
  top: 70,
  bottom: 250,
  topLeft: 44,
  topRight: 176,
  botLeft: 56,
  botRight: 164
};
function jarRow(y) {
  const t = (y - JAR.top) / (JAR.bottom - JAR.top);
  return [JAR.topLeft + t * (JAR.botLeft - JAR.topLeft), JAR.topRight + t * (JAR.botRight - JAR.topRight)];
}
function marbleInside(p, r) {
  if (p.y - r < JAR.top || p.y + r > JAR.bottom) return false;
  const span = jarRow(p.y);
  return p.x - r >= span[0] && p.x + r <= span[1];
}
function marbleJar(count) {
  for (let r = 8; r >= 2; r = Math.round((r - 0.1) * 10) / 10) {
    const pts = [];
    let y = JAR.bottom - r, row = 0;
    while (pts.length < count && y - r >= JAR.top) {
      const span = jarRow(y);
      const inset = (row % 2) * r;
      for (let x = span[0] + r + inset; x <= span[1] - r + 1e-6 && pts.length < count; x += r * 2) {
        const p = { x: x, y: y };
        if (marbleInside(p, r)) pts.push(p);
      }
      y -= r * 1.72;
      row++;
    }
    if (pts.length === count && pts.every(p => marbleInside(p, r))) return { count: count, r: r, pts: pts, jar: JAR };
  }
  return null;
}
window.marbleJar = marbleJar;
window.MARBLE_COUNT = 437;
window.TYPE_DEMO = [
  {
    type: "pair",
    difficulty: "easy",
    prompt: { en: "Larger by area?", es: "¿Cuál es más grande por superficie?" },
    explain: { en: "Brazil, Canada, Russia, India, and Algeria are the larger ones here.", es: "Brasil, Canadá, Rusia, India y Argelia son los más grandes de esta lista." },
    points: 250,
    rounds: [
      { left: { en: "Brazil", es: "Brasil" }, right: { en: "Australia", es: "Australia" }, correct: "left", note: { en: "Brazil is about 8.5 million km²; Australia about 7.7 million.", es: "Brasil tiene unos 8,5 millones de km²; Australia, unos 7,7 millones." } },
      { left: { en: "Canada", es: "Canadá" }, right: { en: "United States", es: "Estados Unidos" }, correct: "left", note: { en: "Canada is larger by area.", es: "Canadá es más grande por superficie." } },
      { left: { en: "China", es: "China" }, right: { en: "Russia", es: "Rusia" }, correct: "right", note: { en: "Russia is the larger country.", es: "Rusia es el país más grande." } },
      { left: { en: "Argentina", es: "Argentina" }, right: { en: "India", es: "India" }, correct: "right", note: { en: "India is larger by area.", es: "India es más grande por superficie." } },
      { left: { en: "Algeria", es: "Argelia" }, right: { en: "Mexico", es: "México" }, correct: "left", note: { en: "Algeria is larger by area.", es: "Argelia es más grande por superficie." } }
    ]
  },
  {
    type: "pair",
    difficulty: "medium",
    prompt: { en: "Which came first?", es: "¿Cuál ocurrió primero?" },
    explain: { en: "The earlier event is the answer in each round.", es: "En cada ronda, la respuesta es lo que ocurrió primero." },
    points: 250,
    rounds: [
      { left: { en: "Model T goes on sale", es: "El Modelo T sale a la venta" }, right: { en: "Titanic sinks", es: "Se hunde el Titanic" }, correct: "left", note: { en: "1908 vs 1912", es: "1908 contra 1912" } },
      { left: { en: "First Moon landing", es: "El primer alunizaje" }, right: { en: "Berlin Wall falls", es: "Cae el Muro de Berlín" }, correct: "left", note: { en: "1969 vs 1989", es: "1969 contra 1989" } },
      { left: { en: "Telephone patented", es: "Se patenta el teléfono" }, right: { en: "Printing press", es: "La imprenta" }, correct: "right", note: { en: "The printing press is the 1400s; the telephone is 1876.", es: "La imprenta es del siglo XV; el teléfono es de 1876." } },
      { left: { en: "Wright Flyer", es: "El Wright Flyer" }, right: { en: "Model T goes on sale", es: "El Modelo T sale a la venta" }, correct: "left", note: { en: "1903 vs 1908", es: "1903 contra 1908" } },
      { left: { en: "First modern Olympics", es: "Los primeros Juegos Olímpicos modernos" }, right: { en: "Titanic sinks", es: "Se hunde el Titanic" }, correct: "left", note: { en: "1896 vs 1912", es: "1896 contra 1912" } }
    ]
  },
  {
    type: "reveal",
    difficulty: "medium",
    prompt: { en: "Who is this?", es: "¿Quién es?" },
    explain: { en: "Serena Williams won her first US Open singles title in 1999.", es: "Serena Williams ganó su primer US Open de individuales en 1999." },
    points: 300,
    clues: [
      { en: "This player won more Open Era Grand Slam singles titles than any other woman.", es: "Esta jugadora ganó más títulos de Grand Slam en individuales de la Era Open que cualquier otra mujer." },
      { en: "She won her first US Open singles title in 1999.", es: "Ganó su primer US Open de individuales en 1999." },
      { en: "Her sister Venus is also a tennis champion.", es: "Su hermana Venus también es una campeona del tenis." }
    ],
    answer: "Serena Williams",
    accept: ["Serena", "Serena Williams", "S. Williams"]
  },
  {
    type: "reveal",
    difficulty: "easy",
    prompt: { en: "What is this?", es: "¿Qué es esto?" },
    explain: { en: "The Eiffel Tower was finished for the 1889 world's fair in Paris.", es: "La Torre Eiffel se terminó para la exposición universal de 1889 en París." },
    points: 300,
    clues: [
      { en: "It was built as the entrance to a world's fair.", es: "Se construyó como la entrada de una exposición universal." },
      { en: "It stands beside the Seine.", es: "Está junto al río Sena." },
      { en: "This iron tower is the symbol of Paris.", es: "Esta torre de hierro es el símbolo de París." }
    ],
    answer: "Eiffel Tower",
    accept: ["Eiffel", "the Eiffel Tower", "Tour Eiffel", "Torre Eiffel", "la Torre Eiffel"]
  },
  {
    type: "slider",
    difficulty: "medium",
    prompt: { en: "How many marbles are in the jar?", es: "¿Cuántas canicas hay en el frasco?" },
    explain: { en: "The jar is drawn with exactly 437 marbles.", es: "El frasco está dibujado con exactamente 437 canicas." },
    points: 1000,
    min: 0,
    max: 2000,
    step: 1,
    answer: 437,
    unit: "marbles",
    scale: "percent",
    per_pct: 20,
    tolerance: 0,
    typed: true,
    marbles: 437
  },
  {
    type: "slider",
    difficulty: "easy",
    prompt: { en: "How many keys does a standard piano have?", es: "¿Cuántas teclas tiene un piano estándar?" },
    explain: { en: "A standard piano has 88 keys.", es: "Un piano estándar tiene 88 teclas." },
    points: 200,
    min: 0,
    max: 150,
    step: 1,
    answer: 88,
    unit: "keys",
    per_unit: 8,
    tolerance: 0
  }
];
// Practice-only days for the slots the validator already accepts. Not a calendar date.
// Open index.html?preview=slots&shot=world|warp|mc|order|orderhint|match|matchhint
window.SLOT_DEMO = {
  world: {
    pins: [{ name: "Oslo, Norway", lat: 59.91, lon: 10.75 }, { name: "Lagos, Nigeria", lat: 6.52, lon: 3.38 }],
    pair: Object.assign({}, window.TYPE_DEMO[0], {
      prompt: { en: "Which is bigger?", es: "¿Cuál es más grande?" },
      rounds: window.TYPE_DEMO[0].rounds.map((r, i) => i ? r : Object.assign({}, r, {
        left: { en: r.left.en, es: "Brasil" },
        right: { en: r.right.en, es: "Australia" },
        note: { en: r.note.en, es: "Brasil es más grande por área." }
      }))
    })
  },
  history: { r1: window.TYPE_DEMO[1], r2: window.TYPE_DEMO[2] },
  historyOther: {
    r1: { type: "mc", q: { en: "Which came first?", es: "¿Cuál ocurrió primero?" }, options: [{ en: "Model T", es: "Modelo T" }, { en: "Titanic", es: "Titanic" }], a: 0 },
    r2: { type: "text", q: { en: "Who invented the telephone?", es: "¿Quién inventó el teléfono?" }, answers: ["alexander graham bell", "bell", "alejandro graham bell"] }
  },
  order: { type: "order", q: "Put these teams in career order.", items: ["Alpha", "Beta", "Gamma"] },
  orderHint: { type: "order", q: "Put these stops in order.", items: ["Alpha", "Beta", "Gamma"], hint: { en: "Put the first stop at the top.", es: "La primera parada va arriba." } },
  timed: Object.assign({}, window.TYPE_DEMO[1], { roundSeconds: 12 }),
  thinkPair: window.TYPE_DEMO[0],
  flip: Object.assign([
    ["BELIEF", "definition", "A bee plus a leaf"],
    ["CORNDOG", "definition", "Corn plus a dog"],
    ["PLANET", "definition", "A world in orbit"],
    ["ROCKET", "definition", "It leaves the ground"],
    ["BRIDGE", "definition", "It crosses a river"],
    ["CASTLE", "definition", "A stone home for a king"]
  ], { timerSec: 30 }),
  match: {
    type: "match", q: "Match the name to the record.",
    left: ["Ada", "Marie", "Katherine", "Grace"],
    right: ["1843", "1867", "1918", "1906"],
    pairs: [0, 1, 2, 3]
  },
  matchHint: {
    type: "match", q: "Match the person to the year.",
    left: ["Ada", "Marie", "Katherine", "Grace"],
    right: ["1843", "1867", "1918", "1906"],
    pairs: [0, 1, 2, 3],
    hint: "Match each person to their year."
  }
};
window.EMOJI_DEMO = [
  [
    { type: "emoji", emoji: "🐝🍃", prompt: { en: "What word do these emojis spell?", es: "¿Qué palabra forman estos emojis?" }, answers: ["belief"], accept: ["belief"] },
    { type: "text", q: "Type that word once more.", answers: ["belief"] }
  ],
  [
    { type: "emoji", emoji: "🌽🐕", prompt: { en: "What word do these emojis spell?", es: "¿Qué palabra forman estos emojis?" }, answers: ["corndog", "corn dog"], accept: ["corndog", "corn dog"] },
    { type: "text", q: "Type that word once more.", answers: ["corndog", "corn dog"] }
  ]
];
