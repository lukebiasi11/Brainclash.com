/* Brain Clash i18n (nov2es). UI strings keyed by their English text; t(en, ...args) returns the active language.
   English is the key itself, so English mode is byte-identical. {0},{1}... are positional args.
   Language: localStorage "bc-lang" ("en" | "es"). The toggle is hidden until ?lang=es (or ?lang=en) has been visited once on this device
   ("bc-lang-unlocked"), until Spanish goes public. es strings: Latin American Spanish. */
(function (root) {
  "use strict";
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const q = (typeof location !== "undefined" && (location.search.match(/[?&]lang=(en|es)\b/) || [])[1]) || null;
  if (q) { store.set("bc-lang", q); store.set("bc-lang-unlocked", "1"); }
  const LANG = store.get("bc-lang") === "es" ? "es" : "en";
  const ES = {
    // categories / word games
    "World Rush": "Vuelta al Mundo", "Time Warp": "Máquina del Tiempo", "MVP": "MVP", "Word Nerd": "Palabrólogo", "Brain Teaser": "Rompecocos",
    "Geography": "Geografía", "History": "Historia", "Sports": "Deportes", "Word games": "Juegos de palabras", "Logic": "Lógica",
    "2 map pins + 1 geography question": "2 pines en el mapa + 1 pregunta de geografía", "2 timelines · drag cards into order": "2 líneas de tiempo · arrastra las tarjetas en orden",
    "3 questions · easy → hard": "3 preguntas · de fácil a difícil", "2 brain-benders · one shot each": "2 acertijos · un solo intento cada uno",
    "Unscramble": "Descifra", "Word Bridge": "Puente de Palabras", "Clusters": "Grupos", "Imposter": "Impostor", "Anagram Rush": "Anagramas Exprés",
    "Unscramble 6 words from hints · 60s": "Descifra 6 palabras con pistas · 60 s", "Finish the first word, start the second · 60s": "Termina la primera palabra, empieza la segunda · 60 s",
    "Find 3 groups of 3 · 90s": "Encuentra 3 grupos de 3 · 90 s", "Spot the word that doesn't fit · 60s": "Detecta la palabra que no encaja · 60 s", "Make words from 6 letters · 60s": "Forma palabras con 6 letras · 60 s",
    // home
    "5": "5", " categories.": " categorías.", "1": "1", " shot a day.": " intento al día.", "5,000": "5,000", " points on the line.": " puntos en juego.",
    "You've finished today's Clash: ": "Ya terminaste el Clash de hoy: ", "View results": "Ver resultados", "Continue the Clash": "Continuar el Clash", "Start the Clash": "Empezar el Clash",
    "How it works": "Cómo funciona", "Same challenge for everyone, new every day at midnight US Eastern (New York) time.": "El mismo reto para todos, nuevo cada día a la medianoche, hora del este de EE. UU. (Nueva York).",
    "Fixed order: World Rush → Time Warp → MVP → Word Nerd → Brain Teaser.": "Orden fijo: Vuelta al Mundo → Máquina del Tiempo → MVP → Palabrólogo → Rompecocos.",
    "Each category is worth up to 1,000 points. No speed bonuses — accuracy wins.": "Cada categoría vale hasta 1,000 puntos. Sin bonos por velocidad: gana la precisión.",
    "Finish a category to unlock the next. No skipping or replays.": "Termina una categoría para desbloquear la siguiente. No se puede saltar ni repetir.",
    "Word Nerd rotates daily between Unscramble, Word Bridge, Clusters, Imposter and Anagram Rush.": "Palabrólogo rota cada día entre Descifra, Puente de Palabras, Grupos, Impostor y Anagramas Exprés.",
    "Played": "Jugadas", "Best": "Mejor", "Streak": "Racha",
    "Beta prototype · scores saved on this device only. Leaderboards, friends and prize pools coming later. ": "Prototipo beta · los puntajes se guardan solo en este dispositivo. Pronto habrá clasificaciones, amigos y premios. ",
    "Credits & licenses": "Créditos y licencias", "Next Clash in ": "Próximo Clash en ", "Resets in ": "Se reinicia en ", " · Clash #": " · Clash #",
    "Practice mode (doesn't count)": "Modo práctica (no cuenta)", "Language": "Idioma",
    // results graph
    "Today's points by category": "Puntos de hoy por categoría", "Today's scores · ": "Puntajes de hoy · ", "Points by category": "Puntos por categoría", "Total": "Total",
    // intros / game chrome
    "Rotates daily · today's format below": "Rota cada día · el formato de hoy está abajo", "Today's word game": "Juego de palabras de hoy", "{0} seconds": "{0} segundos", "Up to 1,000 pts": "Hasta 1,000 pts",
    "Start {0}": "Empezar {0}", "Today's word game: {0} — {1}": "Juego de palabras de hoy: {0} — {1}", "Worth up to ": "Vale hasta ", "1,000 points": "1,000 puntos",
    "Drop a pin as close as you can to two cities (up to 450 pts each — 0 at 4,000 km+), then answer one geography question (100 pts). Spin the globe to aim the ✛ at your guess, then tap or hit Lock in.":
      "Pon un pin lo más cerca posible de dos ciudades (hasta 450 pts cada una; 0 a 4,000 km o más) y luego responde una pregunta de geografía (100 pts). Gira el globo para apuntar la ✛ a tu respuesta y toca o presiona Confirmar.",
    "Drag the picture cards into chronological order, earliest first (top on phones, left on wider screens). Round 1: 4 events in 45s (400 pts). Round 2: 5 events in 45s (600 pts). Partial credit for every correctly ordered pair.":
      "Arrastra las tarjetas en orden cronológico, de la más antigua a la más reciente (arriba en celulares, a la izquierda en pantallas anchas). Ronda 1: 4 eventos en 45 s (400 pts). Ronda 2: 5 eventos en 45 s (600 pts). Crédito parcial por cada par en el orden correcto.",
    "Three questions of rising difficulty: 250, 350, then 400 points. Matching and ordering questions give partial credit for each one you get right.":
      "Tres preguntas de dificultad creciente: 250, 350 y 400 puntos. Las preguntas de emparejar y ordenar dan crédito parcial por cada acierto.",
    "Unscramble 6 medium–hard words using the hint (definition, synonym, antonym or riddle). Tap letters to spell; correct answers auto-advance. First 4 words 150 pts, last 2 worth 200. 60 seconds.":
      "Descifra 6 palabras de dificultad media a alta con la pista (definición, sinónimo, antónimo o adivinanza). Toca las letras para deletrear; las respuestas correctas avanzan solas. Las primeras 4 valen 150 pts y las últimas 2, 200. 60 segundos.",
    "Find the middle word that finishes the first word and starts the second, e.g. SUN _ HOUSE → LIGHT (sunlight, lighthouse). It is NOT a word that blends both meanings. 6 puzzles: the first 4 are worth 150 pts, the last 2 are worth 200. 60 seconds.":
      "Este juego es en inglés. Encuentra la palabra del medio que termina la primera y empieza la segunda, p. ej. SUN _ HOUSE → LIGHT (sunlight, lighthouse). 6 acertijos: los primeros 4 valen 150 pts y los últimos 2, 200. 60 segundos.",
    "Sort 9 words into 3 groups of 3. Groups are worth 300, 300 and 400. Three wrong guesses ends the round. 90 seconds.": "Ordena 9 palabras en 3 grupos de 3. Los grupos valen 300, 300 y 400. Tres errores terminan la ronda. 90 segundos.",
    "8 sets of four words — tap the one that doesn't belong. 4 medium (100 pts) then 4 hard (150 pts). 60 seconds.": "8 grupos de cuatro palabras: toca la que no pertenece. 4 medios (100 pts) y luego 4 difíciles (150 pts). 60 segundos.",
    "Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 25, 5 = 50, 6 = 100. No penalty for wrong guesses.": "Este juego es en inglés. Forma todas las palabras de 3 a 6 letras que puedas con 6 letras en 60 segundos. 3 letras = 10, 4 = 25, 5 = 50, 6 = 100. Los errores no restan.",
    "Two puzzles worth 400 and 600 points, {0} seconds each. You get ONE submission each — think before you lock it in.": "Dos acertijos de 400 y 600 puntos, {0} segundos cada uno. Tienes UN solo intento por acertijo: piensa antes de confirmar.",
    "Category score": "Puntaje de la categoría", "See final results": "Ver resultados finales", "Next: {0} →": "Siguiente: {0} →", "Score ": "Puntaje ", "/1,000 pts": "/1,000 pts", "Practice": "Práctica", "Skip": "Saltar", "Skip →": "Saltar →",
    "Leave this game? Progress in the current category is lost.": "¿Salir del juego? Se perderá el progreso de la categoría actual.",
    "{0} was locked in at {1} pts — you left mid-round, so it can't be replayed.": "{0} quedó registrada con {1} pts: saliste a mitad de ronda, así que no se puede repetir.", "That category": "Esa categoría",
    // world rush
    "Pin {0} of 2 · up to 450 pts": "Pin {0} de 2 · hasta 450 pts", "Where is ": "¿Dónde está ", "?": "?", "Spin to aim at the ✛, then tap or Lock in": "Gira para apuntar a la ✛ y toca o confirma",
    "Time's up — no pin placed → +0": "Se acabó el tiempo: no pusiste pin → +0", "Next pin →": "Siguiente pin →", "Geography Q →": "Pregunta de geografía →", "Geography question · 100 pts": "Pregunta de geografía · 100 pts",
    "📍 Lock in pin": "📍 Confirmar pin", "Lock in": "Confirmar", "Lock in order": "Confirmar orden", "Lock in pairs": "Confirmar parejas",
    // feedback
    "Correct! +{0}": "¡Correcto! +{0}", "Skipped. +0": "Saltada. +0", "Time's up. +0": "Se acabó el tiempo. +0", "Not quite. +0": "Casi. +0",
    "Skipped. Answer: {0}. +0": "Saltada. Respuesta: {0}. +0", "Time's up. Answer: {0}. +0": "Se acabó el tiempo. Respuesta: {0}. +0", "Answer: {0}. +0": "Respuesta: {0}. +0",
    // time warp
    "Round {0} of 2 · {1} · up to {2} pts": "Ronda {0} de 2 · {1} · hasta {2} pts", "Drag the cards into order — ": "Arrastra las tarjetas en orden: ", "Earliest ←": "Más antiguo ←", "→ Latest": "→ Más reciente", "Earliest": "Más antiguo", "Latest": "Más reciente",
    "Correct order: ": "Orden correcto: ", "{0}/{1} pairs in order → {2} pts": "{0}/{1} pares en orden → {2} pts", "Round 2 →": "Ronda 2 →",
    // sports
    "Question {0} of 3 · {1} · {2} pts": "Pregunta {0} de 3 · {1} · {2} pts", "Easy": "Fácil", "Medium": "Media", "Hard": "Difícil", "Next question →": "Siguiente pregunta →",
    "Type your answer": "Escribe tu respuesta", "Drag into order — first team at the top. Or use ▲▼, tap two chips to swap, or arrow keys.": "Arrastra en orden: el primer equipo arriba. O usa ▲▼ (o las flechas del teclado), o toca dos fichas para cambiarlas.",
    "FIRST": "PRIMERO", "LAST": "ÚLTIMO", "{0}/{1} in the right spot → +{2}": "{0}/{1} en su lugar → +{2}", "Tap a name, then a record to pair them. Tap a pair again to unpair. Drag also works.": "Toca un nombre y luego un dato para emparejarlos. Toca una pareja otra vez para separarla. También puedes arrastrar.",
    "Correct: ": "Correcto: ", "{0}/{1} correct → +{2}": "{0}/{1} correctas → +{2}",
    // word games
    "↩ Undo": "↩ Deshacer", "Clear": "Borrar", "Skipped words come back at the end if time remains.": "Las palabras saltadas vuelven al final si queda tiempo.",
    "Word {0}/6 · {1} pts · Score {2}/1,000 pts": "Palabra {0}/6 · {1} pts · Puntaje {2}/1,000 pts", " · {0} left": " · quedan {0}", "Missing word": "Palabra faltante", "Submit": "Enviar",
    "Skipped puzzles come back at the end if time remains.": "Los acertijos saltados vuelven al final si queda tiempo.", "Puzzle {0}/6 · {1} pts · Score {2}/1,000 pts": "Acertijo {0}/6 · {1} pts · Puntaje {2}/1,000 pts",
    "Find 3 groups of 3 · 90 seconds": "Encuentra 3 grupos de 3 · 90 segundos", "Score {0}/1,000 pts · Mistakes left: ": "Puntaje {0}/1,000 pts · Errores restantes: ", "One away…": "Te falta una…",
    "8 puzzles · 60 seconds": "8 acertijos · 60 segundos", "Which one doesn't belong?": "¿Cuál no pertenece?", "Puzzle {0}/8 · {1} · {2} pts · Score {3}/1,000 pts": "Acertijo {0}/8 · {1} · {2} pts · Puntaje {3}/1,000 pts",
    "🔀 Shuffle": "🔀 Mezclar", "Shuffle": "Mezclar", "Submit word": "Enviar palabra", "Already found": "Ya la encontraste", "Not a word": "No es una palabra", "Missed words: ": "Palabras que faltaron: ", "none — wow!": "ninguna. ¡Wow!",
    // brain teaser
    "Math trap": "Trampa matemática", "Sequence": "Secuencia", "Guesstimate": "Estimación", "Optical illusion": "Ilusión óptica", "Lateral riddle": "Acertijo lateral",
    "earliest at top, latest at bottom": "lo más antiguo arriba, lo más reciente abajo", "earliest on the left, latest on the right": "lo más antiguo a la izquierda, lo más reciente a la derecha", "☝️ Touch and drag to reorder": "☝️ Toca y arrastra para reordenar", " Deselect": " Deseleccionar", "📤 Share result": "📤 Compartir resultado", "Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 25, 5 = 50, 6 = 100. No penalty for wrong guesses.": "Forma todas las palabras en inglés de 3 a 6 letras que puedas con 6 letras en 60 segundos. 3 letras = 10, 4 = 25, 5 = 50, 6 = 100. Los errores no restan puntos.", "⌨️ Type letters · Enter to submit · Backspace to delete · Space to shuffle": "⌨️ Escribe letras · Enter para enviar · Retroceso para borrar · Espacio para mezclar", "{0} words · {1} raw": "{0} palabras · {1} brutos", "Year": "Año", "Your estimate": "Tu estimación", "year": "año", " in ": " en ", "definition": "definición", "synonym": "sinónimo", "antonym": "antónimo", "riddle": "acertijo", "Definition": "Definición", "Synonym": "Sinónimo", "Antonym": "Antónimo", "Riddle": "Acertijo", "Your best estimate": "Tu mejor estimación", "Exact year ±{0} = full points · otherwise 0": "Año exacto ±{0} = puntos completos · si no, 0", "Exact year only = full points · otherwise 0": "Solo el año exacto = puntos completos · si no, 0",
    "Within 5% = full points · 0 at 50% off": "Dentro del 5% = puntos completos · 0 si te desvías 50%", "Enter a year, e.g. 1954": "Escribe un año, p. ej. 1954", "Enter a number, e.g. 1,200 or 1.2k": "Escribe un número, p. ej. 1,200 o 1.2k",
    " Off by {0} year.": " Te desviaste {0} año.", " Off by {0} years.": " Te desviaste {0} años.", " You were {0}% off.": " Te desviaste un {0}%.",
    "Skipped.": "Saltada.", "Time's up.": "Se acabó el tiempo.", "Spot on!": "¡Exacto!", "Close!": "¡Cerca!", "Not close.": "Lejos.", " Answer: {0}.": " Respuesta: {0}.",
    "Puzzle {0} of 2{1} · {2} pts · one submission": "Acertijo {0} de 2{1} · {2} pts · un intento", "Final puzzle →": "Último acertijo →",
    // results
    "Clash complete": "Clash terminado", "Practice complete": "Práctica terminada", "Clash complete!": "¡Clash terminado!", "See full results": "Ver resultados completos",
    "Practice run complete": "Práctica terminada", "Today's Clash complete": "Clash de hoy terminado", "Final score": "Puntaje final", "Share result": "Compartir resultado", "Home": "Inicio", "Copied!": "¡Copiado!",
    "Global & friends leaderboards arrive with accounts in a future version.": "Las clasificaciones globales y con amigos llegarán con las cuentas en una versión futura.",
    // quips
    "Flawless. Are you cheating, or just insufferable?": "Impecable. ¿Haces trampa o nada más eres insoportable?", "5,000. Go outside, you've earned it.": "5,000. Sal a tomar aire, te lo ganaste.", "Perfect score. We're calling your mom to brag.": "Puntaje perfecto. Le vamos a llamar a tu mamá para presumir.",
    "Big brain energy. Mildly annoying, honestly.": "Energía de cerebrito. Medio molesto, la verdad.", "Strong showing. Don't let it go to your head.": "Buen papel. Que no se te suba.", "Impressive. The other brains are taking notes.": "Impresionante. Los otros cerebros están tomando notas.",
    "Solidly… fine. Like a beige couch.": "Bien… a secas. Como un sillón beige.", "Not bad, not great. Peak Tuesday energy.": "Ni mal ni genial. Energía de martes.", "Your brain showed up. Mostly.": "Tu cerebro se presentó. Casi todo.",
    "Rough one. Your brain called in sick?": "Día difícil. ¿Tu cerebro se reportó enfermo?", "Well, at least you finished.": "Bueno, al menos terminaste.", "Bold strategy: guess everything.": "Estrategia audaz: adivinar todo.",
    "Zero. Impressive in its own way.": "Cero. Impresionante a su manera.", "A perfect zero. Was the phone upside down?": "Un cero perfecto. ¿Tenías el celular al revés?", "Nothing! Tomorrow can only go up.": "¡Nada! Mañana solo puede mejorar.",
    "Showing off now, are we?": "Ya estás presumiendo, ¿eh?", "Clean sweep. Rude, honestly.": "Barrida total. Qué grosero, la verdad.", "That category never stood a chance.": "Esa categoría nunca tuvo oportunidad.",
    "Nicely done. Keep that energy.": "Bien hecho. Sigue con esa energía.", "Solid. Your brain is warmed up.": "Sólido. Tu cerebro ya calentó.", "Respectable work. Carry on.": "Trabajo respetable. Sigue así.",
    "Middle of the pack. Very… balanced.": "A media tabla. Muy… equilibrado.", "Half right, half vibes.": "Mitad aciertos, mitad corazonadas.", "Could be worse. Could be better.": "Pudo ser peor. Pudo ser mejor.",
    "Oof. Shake it off.": "Uf. Sacúdetelo.", "That one bit back.": "Esa te mordió.", "Let's pretend that didn't happen.": "Hagamos como que no pasó.",
    "A goose egg. Bold.": "Un rosco. Valiente.", "Zero. Next category, quickly.": "Cero. A la siguiente categoría, rápido.", "Nothing? The next one's yours.": "¿Nada? La próxima es tuya."
  };
  function t(s) { let r = LANG === "es" && Object.prototype.hasOwnProperty.call(ES, s) ? ES[s] : s; for (let i = 1; i < arguments.length; i++) r = r.split("{" + (i - 1) + "}").join(arguments[i]); return r; }
  const api = { LANG, t, ES, locale: LANG === "es" ? "es-419" : undefined, toggleVisible: () => store.get("bc-lang-unlocked") === "1", set(l) { store.set("bc-lang", l); } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BC_I18N = api;
})(typeof window !== "undefined" ? window : globalThis);
