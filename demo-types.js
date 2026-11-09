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
    prompt: "Larger by area?",
    explain: "Brazil, Canada, Russia, India, and Algeria are the larger ones here.",
    points: 250,
    rounds: [
      { left: "Brazil", right: "Australia", correct: "left", note: "Brazil is about 8.5 million km²; Australia about 7.7 million." },
      { left: "Canada", right: "United States", correct: "left", note: "Canada is larger by area." },
      { left: "China", right: "Russia", correct: "right", note: "Russia is the larger country." },
      { left: "Argentina", right: "India", correct: "right", note: "India is larger by area." },
      { left: "Algeria", right: "Mexico", correct: "left", note: "Algeria is larger by area." }
    ]
  },
  {
    type: "pair",
    difficulty: "medium",
    prompt: "Which came first?",
    explain: "The earlier event is the answer in each round.",
    points: 250,
    rounds: [
      { left: "Model T goes on sale", right: "Titanic sinks", correct: "left", note: "1908 vs 1912" },
      { left: "First Moon landing", right: "Berlin Wall falls", correct: "left", note: "1969 vs 1989" },
      { left: "Telephone patented", right: "Printing press", correct: "right", note: "The printing press is the 1400s; the telephone is 1876." },
      { left: "Wright Flyer", right: "Model T goes on sale", correct: "left", note: "1903 vs 1908" },
      { left: "First modern Olympics", right: "Titanic sinks", correct: "left", note: "1896 vs 1912" }
    ]
  },
  {
    type: "reveal",
    difficulty: "medium",
    prompt: "Who is this?",
    explain: "Serena Williams won her first US Open singles title in 1999.",
    points: 300,
    clues: [
      "This player won more Open Era Grand Slam singles titles than any other woman.",
      "She won her first US Open singles title in 1999.",
      "Her sister Venus is also a tennis champion."
    ],
    answer: "Serena Williams",
    accept: ["Serena", "Serena Williams", "S. Williams"]
  },
  {
    type: "reveal",
    difficulty: "easy",
    prompt: "What is this?",
    explain: "The Eiffel Tower was finished for the 1889 world's fair in Paris.",
    points: 300,
    clues: [
      "It was built as the entrance to a world's fair.",
      "It stands beside the Seine.",
      "This iron tower is the symbol of Paris."
    ],
    answer: "Eiffel Tower",
    accept: ["Eiffel", "the Eiffel Tower", "Tour Eiffel"]
  },
  {
    type: "slider",
    difficulty: "medium",
    prompt: "How many marbles are in the jar?",
    explain: "The jar is drawn with exactly 437 marbles.",
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
    prompt: "How many keys does a standard piano have?",
    explain: "A standard piano has 88 keys.",
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
    pair: window.TYPE_DEMO[0]
  },
  history: { r1: window.TYPE_DEMO[1], r2: window.TYPE_DEMO[2] },
  historyOther: {
    r1: { type: "mc", q: "Which came first?", options: ["Model T", "Titanic"], a: 0 },
    r2: { type: "text", q: "Who invented the telephone?", answers: ["alexander graham bell", "bell"] }
  },
  order: { type: "order", q: "Put these teams in career order.", items: ["Alpha", "Beta", "Gamma"] },
  orderHint: { type: "order", q: "Put these stops in order.", items: ["Alpha", "Beta", "Gamma"], hint: "Put the first stop at the top." },
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
