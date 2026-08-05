export type Puzzle = {
  id: string;
  number: number;
  emoji: string;
  answer: string;
  acceptedAnswers: string[];
  category: string;
  hints: string[];
  explanation: string;
  structure: "literal" | "idiom" | "rebus" | "person" | "story" | "movie" | "historical" | "interpretive";
};

export type PublicPuzzle = Pick<Puzzle, "id" | "number" | "emoji"> & {
  hintCount: number;
};

export const GAME_CONFIG = {
  launchDate: "2026-08-05",
  dayBoundary: "UTC" as const,
  cycleAfterLastPuzzle: true,
  maxCommentLength: 500,
  maxGuessLength: 120,
};

// Experimental playtest set. Edit puzzles here; mechanics live in GAME_CONFIG.
export const PUZZLES: Puzzle[] = [
  {
    id: "rain-cats-dogs",
    number: 1,
    emoji: "🌧️  🐱  🐶",
    answer: "It’s raining cats and dogs",
    acceptedAnswers: [
      "it's raining cats and dogs",
      "its raining cats and dogs",
      "raining cats and dogs",
      "it is raining cats and dogs",
    ],
    category: "Common expression",
    hints: [
      "It’s a common expression.",
      "The weather is doing much more than drizzling.",
      "The animals aren’t meant literally—say what the whole scene means.",
    ],
    explanation: "A delightfully absurd way to say that rain is coming down extremely heavily.",
    structure: "literal",
  },
  {
    id: "elephant-room",
    number: 2,
    emoji: "🐘  🛋️  🏠",
    answer: "The elephant in the room",
    acceptedAnswers: ["the elephant in the room", "elephant in the room"],
    category: "Idiom",
    hints: [
      "It’s an idiom.",
      "Everyone notices the problem, but nobody wants to mention it.",
      "Focus on the very large guest indoors.",
    ],
    explanation: "The impossible-to-ignore subject everyone is deliberately avoiding.",
    structure: "idiom",
  },
  {
    id: "van-gogh",
    number: 3,
    emoji: "🎨  🌻  👂",
    answer: "Vincent van Gogh",
    acceptedAnswers: ["vincent van gogh", "van gogh", "vincent vangogh", "vangogh"],
    category: "Famous person",
    hints: [
      "You’re looking for a famous person.",
      "The flower points toward one of his best-known subjects.",
      "The ear is the biographical clue.",
    ],
    explanation: "The painter of the Sunflowers series is also inseparable from the story of his injured ear.",
    structure: "person",
  },
  {
    id: "cinderella",
    number: 4,
    emoji: "👠  🎃  🕛",
    answer: "Cinderella",
    acceptedAnswers: ["cinderella"],
    category: "Story",
    hints: [
      "It’s a classic story.",
      "A magical ride has a strict deadline.",
      "The shoe is left behind at midnight.",
    ],
    explanation: "The glass slipper, pumpkin carriage, and midnight deadline tell Cinderella’s whole transformation in three beats.",
    structure: "story",
  },
  {
    id: "titanic",
    number: 5,
    emoji: "🚢  🧊  💔",
    answer: "Titanic",
    acceptedAnswers: ["titanic", "the titanic"],
    category: "Movie / historical event",
    hints: [
      "It’s both history and a famous movie.",
      "The middle clue changed the ship’s fate.",
      "The broken heart also nods to the film’s love story.",
    ],
    explanation: "An ocean liner, an iceberg, and a doomed romance collapse history and cinema into one answer.",
    structure: "movie",
  },
  {
    id: "newton-gravity",
    number: 6,
    emoji: "🍎  🌳  ⬇️  🧠",
    answer: "Isaac Newton",
    acceptedAnswers: ["isaac newton", "newton", "sir isaac newton"],
    category: "Historical person",
    hints: [
      "You’re looking for a person from history.",
      "The falling fruit leads to a scientific idea.",
      "Think gravity.",
    ],
    explanation: "Legend says a falling apple helped Newton frame his thinking about gravity.",
    structure: "historical",
  },
  {
    id: "chicken-egg",
    number: 7,
    emoji: "🐔  ↔️  🥚  ❓",
    answer: "Which came first, the chicken or the egg?",
    acceptedAnswers: [
      "which came first the chicken or the egg",
      "what came first the chicken or the egg",
      "the chicken or the egg",
      "chicken or the egg",
      "chicken and egg",
    ],
    category: "Age-old question",
    hints: [
      "It’s a familiar question, not a single object.",
      "It asks about cause and origin.",
      "Start your answer with ‘Which came first…’",
    ],
    explanation: "The circular riddle asks which of two interdependent things could possibly have started the cycle.",
    structure: "interpretive",
  },
  {
    id: "fish-out-water",
    number: 8,
    emoji: "🐟  🚫  💧",
    answer: "A fish out of water",
    acceptedAnswers: ["a fish out of water", "fish out of water", "like a fish out of water"],
    category: "Idiom",
    hints: [
      "It’s an idiom.",
      "It describes someone outside their natural setting.",
      "Read the crossed-out final clue as ‘out of.’",
    ],
    explanation: "Someone far outside their comfort zone looks as misplaced as a fish on dry land.",
    structure: "idiom",
  },
  {
    id: "king-of-rock",
    number: 9,
    emoji: "👑  🪨  🎸",
    answer: "Elvis Presley",
    acceptedAnswers: ["elvis presley", "elvis", "the king of rock and roll", "king of rock and roll"],
    category: "Famous person",
    hints: [
      "The emojis form a title for a person.",
      "The rock stands for a kind of music, not a stone.",
      "He’s widely called ‘the King of Rock and Roll.’",
    ],
    explanation: "Crown plus rock music points to the performer known simply as the King: Elvis Presley.",
    structure: "person",
  },
  {
    id: "outside-box",
    number: 10,
    emoji: "🧠  ➡️  📦",
    answer: "Think outside the box",
    acceptedAnswers: ["think outside the box", "thinking outside the box", "outside the box thinking"],
    category: "Rebus / expression",
    hints: [
      "It’s a familiar piece of advice.",
      "Treat the arrow as an instruction about position.",
      "Move the thought somewhere beyond the container.",
    ],
    explanation: "The rebus turns unconventional thinking into a literal movement beyond the box.",
    structure: "rebus",
  },
];

export function normalizeGuess(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAcceptedGuess(puzzle: Puzzle, guess: string) {
  const normalized = normalizeGuess(guess);
  return puzzle.acceptedAnswers.some((answer) => normalizeGuess(answer) === normalized);
}

export function getPuzzleById(id: string) {
  return PUZZLES.find((puzzle) => puzzle.id === id);
}

export function getPuzzleByNumber(number: number) {
  return PUZZLES.find((puzzle) => puzzle.number === number);
}

export function getDailyPuzzle(now = new Date()) {
  const launch = Date.parse(`${GAME_CONFIG.launchDate}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsedDays = Math.max(0, Math.floor((today - launch) / 86_400_000));
  const index = GAME_CONFIG.cycleAfterLastPuzzle
    ? elapsedDays % PUZZLES.length
    : Math.min(elapsedDays, PUZZLES.length - 1);
  return PUZZLES[index];
}

export function toPublicPuzzle(puzzle: Puzzle): PublicPuzzle {
  return {
    id: puzzle.id,
    number: puzzle.number,
    emoji: puzzle.emoji,
    hintCount: puzzle.hints.length,
  };
}

export function puzzleResolution(puzzle: Puzzle) {
  return {
    answer: puzzle.answer,
    category: puzzle.category,
    explanation: puzzle.explanation,
  };
}
