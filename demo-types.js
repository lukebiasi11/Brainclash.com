// Practice-only examples for pair, reveal, and slider. Not part of the daily lists.
// Live dates never read this file. Open index.html?preview=demo
// Marble positions fill a jar from the bottom. The returned list length is the count.
function marbleJar(count) {
  const left = 28, right = 172, bottom = 236, top = 58;
  for (let r = 8; r >= 2; r = Math.round((r - 0.1) * 10) / 10) {
    const pts = [];
    let y = bottom - r, row = 0;
    while (pts.length < count && y - r >= top) {
      const t = (bottom - y) / (bottom - top);
      const neck = t > 0.78 ? (t - 0.78) / 0.22 : 0;
      const inset = (row % 2) * r;
      const rowLeft = left + neck * 36 + inset;
      const rowRight = right - neck * 36;
      for (let x = rowLeft + r; x <= rowRight - r + 1e-6 && pts.length < count; x += r * 2) pts.push({ x: x, y: y });
      y -= r * 1.72;
      row++;
    }
    if (pts.length === count) return { count: count, r: r, pts: pts };
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
    max: 800,
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
