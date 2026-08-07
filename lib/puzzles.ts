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
  pool: PuzzlePool;
  context: PlayContext;
  sequenceNumber: number;
  sequenceLength: number;
  dateCode: string | null;
  rankingEligible: boolean;
  legacyStorageEligible: boolean;
};

export type PuzzlePool = "daily" | "practice";
export type PlayContext = "daily" | "practice" | "challenge" | "author-test";

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
    acceptedAnswers: ["cinderella", "the story of cinderella", "disney's cinderella", "disneys cinderella"],
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
  {
    id: "break-a-leg",
    number: 11,
    emoji: "🎭  🦵  💥",
    answer: "Break a leg",
    acceptedAnswers: ["break a leg", "break a leg in theater", "the phrase break a leg"],
    category: "Theater expression",
    hints: [
      "It’s a traditional expression.",
      "Performers say it before someone goes onstage.",
      "It means good luck, despite sounding like an injury.",
    ],
    explanation: "Actors traditionally say “break a leg” instead of “good luck” before a performance.",
    structure: "idiom",
  },
  {
    id: "piece-of-cake",
    number: 12,
    emoji: "🧩  ➡️  🍰",
    answer: "A piece of cake",
    acceptedAnswers: ["a piece of cake", "piece of cake", "it's a piece of cake", "its a piece of cake"],
    category: "Idiom",
    hints: [
      "It’s an idiom about difficulty.",
      "The first emoji represents one part of a whole.",
      "You say this when a task is extremely easy.",
    ],
    explanation: "Calling something “a piece of cake” means it was pleasantly easy to do.",
    structure: "literal",
  },
  {
    id: "spill-the-beans",
    number: 13,
    emoji: "🫗  🫘  🤫",
    answer: "Spill the beans",
    acceptedAnswers: ["spill the beans", "spilling the beans", "spilled the beans"],
    category: "Idiom",
    hints: [
      "It’s an idiom involving a secret.",
      "The final emoji tells you what was not supposed to happen.",
      "It means to reveal hidden information.",
    ],
    explanation: "To spill the beans is to let a secret out, whether deliberately or by accident.",
    structure: "idiom",
  },
  {
    id: "nail-on-the-head",
    number: 14,
    emoji: "🔨  🔩  🎯",
    answer: "Hit the nail on the head",
    acceptedAnswers: ["hit the nail on the head", "hitting the nail on the head", "you hit the nail on the head"],
    category: "Idiom",
    hints: [
      "It describes getting something exactly right.",
      "The target suggests precision.",
      "A hammer should strike one particular part of a nail.",
    ],
    explanation: "A perfectly aimed hammer blow becomes an idiom for identifying or saying exactly the right thing.",
    structure: "literal",
  },
  {
    id: "blue-moon",
    number: 15,
    emoji: "1️⃣  ⏳  🔵  🌕",
    answer: "Once in a blue moon",
    acceptedAnswers: ["once in a blue moon", "only once in a blue moon", "a blue moon"],
    category: "Idiom",
    hints: [
      "It’s an expression about frequency.",
      "The unusual color signals that it does not happen often.",
      "Start with a word meaning one time.",
    ],
    explanation: "Something that happens once in a blue moon happens very rarely.",
    structure: "idiom",
  },
  {
    id: "arm-and-a-leg",
    number: 16,
    emoji: "💵  ➡️  💪  ➕  🦵",
    answer: "Costs an arm and a leg",
    acceptedAnswers: ["costs an arm and a leg", "cost an arm and a leg", "an arm and a leg", "it costs an arm and a leg"],
    category: "Idiom",
    hints: [
      "It describes a price.",
      "The body parts represent an extreme sacrifice.",
      "Use this phrase when something is very expensive.",
    ],
    explanation: "If something costs an arm and a leg, its price feels painfully high.",
    structure: "rebus",
  },
  {
    id: "under-the-weather",
    number: 17,
    emoji: "🤒  ⬇️  🌧️",
    answer: "Under the weather",
    acceptedAnswers: ["under the weather", "feeling under the weather", "i'm under the weather", "im under the weather"],
    category: "Idiom",
    hints: [
      "It describes how someone feels.",
      "The face is unwell, and its position matters.",
      "It’s a familiar way to say you feel sick.",
    ],
    explanation: "Feeling under the weather is a gentle way to say you are ill or not quite yourself.",
    structure: "rebus",
  },
  {
    id: "burn-midnight-oil",
    number: 18,
    emoji: "🔥  🕛  🛢️  📚",
    answer: "Burn the midnight oil",
    acceptedAnswers: ["burn the midnight oil", "burning the midnight oil", "burned the midnight oil", "burnt the midnight oil"],
    category: "Idiom",
    hints: [
      "It’s about working late.",
      "Before electric lights, a lamp needed the third clue.",
      "The clock points to work continuing deep into the night.",
    ],
    explanation: "Burning the midnight oil means working late, recalling the oil lamps once used after dark.",
    structure: "historical",
  },
  {
    id: "cat-out-of-the-bag",
    number: 19,
    emoji: "🐈  ⬅️  👜  🤫",
    answer: "Let the cat out of the bag",
    acceptedAnswers: ["let the cat out of the bag", "letting the cat out of the bag", "the cat is out of the bag", "cat out of the bag"],
    category: "Idiom",
    hints: [
      "It’s about information that was supposed to stay hidden.",
      "The animal has escaped its container.",
      "The phrase means a secret has been revealed.",
    ],
    explanation: "Once the cat is out of the bag, the secret can no longer be contained.",
    structure: "literal",
  },
  {
    id: "when-pigs-fly",
    number: 20,
    emoji: "⏰  🐷  🪽  ☁️",
    answer: "When pigs fly",
    acceptedAnswers: ["when pigs fly", "pigs might fly", "pigs fly"],
    category: "Idiom",
    hints: [
      "It describes the likelihood of something happening.",
      "The scene is deliberately impossible.",
      "Begin with a word that asks at what time.",
    ],
    explanation: "“When pigs fly” is a humorous way to say something will never happen.",
    structure: "literal",
  },
  {
    id: "statue-of-liberty",
    number: 21,
    emoji: "🗽  🔥  🇺🇸",
    answer: "The Statue of Liberty",
    acceptedAnswers: ["the statue of liberty", "statue of liberty", "lady liberty", "liberty enlightening the world"],
    category: "American landmark",
    hints: [
      "It’s a landmark in the United States.",
      "A torch is raised above New York Harbor.",
      "The monument was a gift from France.",
    ],
    explanation: "The torch-bearing Statue of Liberty has welcomed arrivals to New York Harbor since 1886.",
    structure: "historical",
  },
  {
    id: "golden-gate-bridge",
    number: 22,
    emoji: "🌉  🟠  🚪  🌁",
    answer: "The Golden Gate Bridge",
    acceptedAnswers: ["the golden gate bridge", "golden gate bridge", "golden gate"],
    category: "American landmark",
    hints: [
      "It’s a famous structure on the West Coast.",
      "The fog and orange color point toward San Francisco.",
      "Its name combines something precious with an entrance.",
    ],
    explanation: "The orange suspension bridge spans the Golden Gate strait beside famously foggy San Francisco.",
    structure: "rebus",
  },
  {
    id: "route-66",
    number: 23,
    emoji: "🚗  6️⃣  6️⃣  🏜️",
    answer: "Route 66",
    acceptedAnswers: ["route 66", "route sixty six", "u.s. route 66", "us route 66", "historic route 66"],
    category: "American road",
    hints: [
      "It’s a celebrated American highway.",
      "Road trips and the Southwest are part of its legend.",
      "Read the two digits together after the word “Route.”",
    ],
    explanation: "Historic Route 66 became an icon of the American road trip from Chicago toward Los Angeles.",
    structure: "historical",
  },
  {
    id: "mount-rushmore",
    number: 24,
    emoji: "⛰️  🗿  🇺🇸  4️⃣",
    answer: "Mount Rushmore",
    acceptedAnswers: ["mount rushmore", "mt rushmore", "mount rushmore national memorial", "rushmore"],
    category: "American landmark",
    hints: [
      "It’s a monumental site in South Dakota.",
      "Four faces are carved into a mountain.",
      "The faces belong to U.S. presidents.",
    ],
    explanation: "Mount Rushmore depicts four U.S. presidents carved into the Black Hills of South Dakota.",
    structure: "historical",
  },
  {
    id: "grand-canyon",
    number: 25,
    emoji: "🏜️  🟥  ⛰️  👀",
    answer: "The Grand Canyon",
    acceptedAnswers: ["the grand canyon", "grand canyon", "grand canyon national park"],
    category: "American landmark",
    hints: [
      "It’s a vast natural landmark.",
      "Layers of red rock reveal immense stretches of time.",
      "The Colorado River carved this Arizona wonder.",
    ],
    explanation: "The Colorado River carved the Grand Canyon through layered rock in northern Arizona.",
    structure: "historical",
  },
  {
    id: "las-vegas",
    number: 26,
    emoji: "🎰  🎲  🌵  💡",
    answer: "Las Vegas",
    acceptedAnswers: ["las vegas", "vegas", "las vegas nevada", "sin city"],
    category: "American city",
    hints: [
      "It’s a city in the American desert.",
      "Bright lights and games of chance define its popular image.",
      "The Strip is its best-known boulevard.",
    ],
    explanation: "Casinos, neon, and the Mojave Desert point to Las Vegas, Nevada.",
    structure: "interpretive",
  },
  {
    id: "new-orleans",
    number: 27,
    emoji: "🎺  ⚜️  🦐  🎭",
    answer: "New Orleans",
    acceptedAnswers: ["new orleans", "new orleans louisiana", "nola", "the big easy", "big easy"],
    category: "American city",
    hints: [
      "It’s a culturally distinctive Southern city.",
      "Jazz, Creole food, and the fleur-de-lis all fit.",
      "Mardi Gras is its most famous celebration.",
    ],
    explanation: "Jazz, Gulf Coast food, Mardi Gras masks, and the fleur-de-lis converge in New Orleans.",
    structure: "interpretive",
  },
  {
    id: "hollywood",
    number: 28,
    emoji: "🎬  ⭐  🌴  ⛰️",
    answer: "Hollywood",
    acceptedAnswers: ["hollywood", "hollywood california", "tinseltown", "tinsel town"],
    category: "American place",
    hints: [
      "It’s both a Los Angeles neighborhood and an idea.",
      "Movies, stars, and palm trees are the clues.",
      "Its hillside sign is recognized around the world.",
    ],
    explanation: "Film, famous stars, and Southern California point to Hollywood and its iconic hillside sign.",
    structure: "interpretive",
  },
  {
    id: "yellowstone",
    number: 29,
    emoji: "🟡  🪨  ♨️  🦬",
    answer: "Yellowstone National Park",
    acceptedAnswers: ["yellowstone national park", "yellowstone", "yellowstone park"],
    category: "American national park",
    hints: [
      "It’s a protected natural place.",
      "The first two emojis build its name.",
      "Old Faithful and roaming bison are signature sights.",
    ],
    explanation: "Yellow plus stone forms Yellowstone, home to famous geysers and major bison herds.",
    structure: "rebus",
  },
  {
    id: "niagara-falls",
    number: 30,
    emoji: "🇺🇸  💧  ⬇️  🇨🇦",
    answer: "Niagara Falls",
    acceptedAnswers: ["niagara falls", "niagara", "the niagara falls", "niagara waterfalls"],
    category: "North American landmark",
    hints: [
      "It’s a natural wonder shared by two countries.",
      "The flags locate it along the U.S.–Canada border.",
      "A huge volume of water plunges over three waterfalls.",
    ],
    explanation: "Niagara Falls is the famous group of waterfalls straddling the border of New York and Ontario.",
    structure: "literal",
  },
  {
    id: "george-washington",
    number: 31,
    emoji: "🥇  🇺🇸  🪓  🌳",
    answer: "George Washington",
    acceptedAnswers: ["george washington", "washington", "president washington", "george washington the first"],
    category: "American historical figure",
    hints: [
      "You’re looking for a person from U.S. history.",
      "The number-one clue points to his presidency.",
      "The ax and tree recall a famous childhood legend.",
    ],
    explanation: "America’s first president is linked in folklore to the story of chopping down a cherry tree.",
    structure: "historical",
  },
  {
    id: "abraham-lincoln",
    number: 32,
    emoji: "🎩  🇺🇸  📜  1️⃣6️⃣",
    answer: "Abraham Lincoln",
    acceptedAnswers: ["abraham lincoln", "abe lincoln", "lincoln", "president lincoln", "honest abe"],
    category: "American historical figure",
    hints: [
      "You’re looking for a U.S. president.",
      "The tall hat and the number 16 are biographical clues.",
      "The document evokes the Emancipation Proclamation.",
    ],
    explanation: "The tall-hatted 16th president issued the Emancipation Proclamation during the Civil War.",
    structure: "historical",
  },
  {
    id: "martin-luther-king-jr",
    number: 33,
    emoji: "👑  🗣️  💭  ✊",
    answer: "Martin Luther King Jr.",
    acceptedAnswers: ["martin luther king jr", "martin luther king junior", "martin luther king", "mlk", "dr martin luther king jr", "doctor martin luther king junior"],
    category: "American historical figure",
    hints: [
      "You’re looking for a civil rights leader.",
      "The crown is a wordplay clue for his surname.",
      "The dream recalls his most famous speech.",
    ],
    explanation: "The king and dream point to Martin Luther King Jr., a defining voice of the U.S. civil rights movement.",
    structure: "person",
  },
  {
    id: "rosa-parks",
    number: 34,
    emoji: "🌹  🚌  💺  ✊",
    answer: "Rosa Parks",
    acceptedAnswers: ["rosa parks", "rosa louise parks", "mrs parks", "mother of the civil rights movement"],
    category: "American historical figure",
    hints: [
      "You’re looking for a civil rights figure.",
      "The flower sounds like her first name.",
      "Her refusal to give up a bus seat helped spark the Montgomery bus boycott.",
    ],
    explanation: "The rose and bus seat point to Rosa Parks and her pivotal stand against segregated transit.",
    structure: "person",
  },
  {
    id: "amelia-earhart",
    number: 35,
    emoji: "👩‍✈️  ✈️  🌊  ❓",
    answer: "Amelia Earhart",
    acceptedAnswers: ["amelia earhart", "earhart", "amelia mary earhart", "amelia erhart"],
    category: "American historical figure",
    hints: [
      "You’re looking for a pioneering aviator.",
      "She set records before disappearing over the Pacific.",
      "Her first name was Amelia.",
    ],
    explanation: "A woman pilot, an ocean, and an enduring mystery identify aviation pioneer Amelia Earhart.",
    structure: "historical",
  },
  {
    id: "benjamin-franklin",
    number: 36,
    emoji: "🪁  🔑  ⚡  👓",
    answer: "Benjamin Franklin",
    acceptedAnswers: ["benjamin franklin", "ben franklin", "franklin", "benjamin franklyn"],
    category: "American historical figure",
    hints: [
      "You’re looking for a Founding Father.",
      "The spectacles nod to one of his many inventions.",
      "A famous experiment joined a kite, key, and storm.",
    ],
    explanation: "The kite-and-key electricity experiment and bifocals are famously associated with Benjamin Franklin.",
    structure: "historical",
  },
  {
    id: "jackie-robinson",
    number: 37,
    emoji: "⚾  4️⃣  2️⃣  🚧",
    answer: "Jackie Robinson",
    acceptedAnswers: ["jackie robinson", "jack roosevelt robinson", "robinson", "number 42", "42"],
    category: "American sports history",
    hints: [
      "You’re looking for a baseball legend.",
      "The barrier represents the color line he broke.",
      "His number 42 is retired across Major League Baseball.",
    ],
    explanation: "Jackie Robinson broke Major League Baseball’s modern color barrier, and every MLB team retired his number 42.",
    structure: "historical",
  },
  {
    id: "neil-armstrong",
    number: 38,
    emoji: "🚀  🌕  👣  1️⃣",
    answer: "Neil Armstrong",
    acceptedAnswers: ["neil armstrong", "armstrong", "neil alden armstrong", "first man on the moon", "first person on the moon"],
    category: "American historical figure",
    hints: [
      "You’re looking for an astronaut.",
      "The footprint was left during Apollo 11.",
      "He was the first person to walk on the Moon.",
    ],
    explanation: "Apollo 11 commander Neil Armstrong became the first person to step onto the Moon in 1969.",
    structure: "historical",
  },
  {
    id: "harriet-tubman",
    number: 39,
    emoji: "🌙  🚂  🧭  🕊️",
    answer: "Harriet Tubman",
    acceptedAnswers: ["harriet tubman", "tubman", "harriet ross tubman", "moses"],
    category: "American historical figure",
    hints: [
      "You’re looking for an abolitionist.",
      "Night travel and navigation suggest dangerous journeys toward freedom.",
      "The train represents the Underground Railroad, not a literal railway.",
    ],
    explanation: "Harriet Tubman repeatedly guided enslaved people to freedom through the Underground Railroad.",
    structure: "historical",
  },
  {
    id: "theodore-roosevelt",
    number: 40,
    emoji: "🧸  🇺🇸  🌲  👓",
    answer: "Theodore Roosevelt",
    acceptedAnswers: ["theodore roosevelt", "teddy roosevelt", "president roosevelt", "theodore teddy roosevelt", "tr"],
    category: "American historical figure",
    hints: [
      "You’re looking for a U.S. president.",
      "Conservation and national forests were central to his legacy.",
      "The stuffed bear shares his famous nickname.",
    ],
    explanation: "The teddy bear took its name from Theodore “Teddy” Roosevelt, a president closely tied to conservation.",
    structure: "person",
  },
  {
    id: "wizard-of-oz",
    number: 41,
    emoji: "🌪️  👠  🟨  🛣️",
    answer: "The Wizard of Oz",
    acceptedAnswers: ["the wizard of oz", "wizard of oz", "the wonderful wizard of oz", "wiz of oz"],
    category: "Classic American story",
    hints: [
      "It’s a story celebrated in books and film.",
      "A storm begins a journey along a colorful road.",
      "Ruby slippers carry Dorothy through Oz.",
    ],
    explanation: "The tornado, ruby slippers, and Yellow Brick Road trace Dorothy’s journey in The Wizard of Oz.",
    structure: "story",
  },
  {
    id: "et-extra-terrestrial",
    number: 42,
    emoji: "👽  📞  🏠  🚲",
    answer: "E.T. the Extra-Terrestrial",
    acceptedAnswers: ["e.t. the extra-terrestrial", "et the extra terrestrial", "e.t.", "et", "extra terrestrial"],
    category: "Movie",
    hints: [
      "It’s a beloved science-fiction movie.",
      "A child helps a stranded visitor.",
      "The visitor wants to phone home, and a bicycle takes flight.",
    ],
    explanation: "The alien’s wish to phone home and the moonlit bicycle flight unmistakably point to E.T.",
    structure: "movie",
  },
  {
    id: "jaws",
    number: 43,
    emoji: "🦈  🏖️  🚤  🎵",
    answer: "Jaws",
    acceptedAnswers: ["jaws", "jaws movie", "the movie jaws", "jaws 1975"],
    category: "Movie",
    hints: [
      "It’s a suspense movie.",
      "A beach community faces danger in the water.",
      "The shark and an ominous two-note theme are the giveaway.",
    ],
    explanation: "A great white shark terrorizes a seaside town in Jaws, whose spare theme became a warning all its own.",
    structure: "movie",
  },
  {
    id: "back-to-the-future",
    number: 44,
    emoji: "🚗  ⚡  🕰️  🔙",
    answer: "Back to the Future",
    acceptedAnswers: ["back to the future", "back 2 the future", "bttf", "back to future"],
    category: "Movie",
    hints: [
      "It’s a time-travel movie.",
      "Lightning powers a very unusual car.",
      "A DeLorean carries Marty McFly between decades.",
    ],
    explanation: "The lightning-powered DeLorean sends Marty McFly back in time in Back to the Future.",
    structure: "movie",
  },
  {
    id: "home-alone",
    number: 45,
    emoji: "🏠  👦  🎄  😱",
    answer: "Home Alone",
    acceptedAnswers: ["home alone", "home alone movie", "the movie home alone", "home alone 1"],
    category: "Movie",
    hints: [
      "It’s a holiday comedy.",
      "A family trip accidentally leaves one child behind.",
      "Kevin defends his house from two burglars at Christmas.",
    ],
    explanation: "A boy left by himself at Christmas turns his house into a trap-filled fortress in Home Alone.",
    structure: "movie",
  },
  {
    id: "jurassic-park",
    number: 46,
    emoji: "🦖  🏝️  🧬  🚙",
    answer: "Jurassic Park",
    acceptedAnswers: ["jurassic park", "the jurassic park", "the movie jurassic park", "jurassic park movie"],
    category: "Movie",
    hints: [
      "It’s a science-fiction adventure.",
      "Genetics brings extinct creatures back on an island.",
      "The attraction’s dinosaurs do not stay under control.",
    ],
    explanation: "Cloned dinosaurs escape their island enclosures in Jurassic Park, turning a theme park preview into survival.",
    structure: "movie",
  },
  {
    id: "ghostbusters",
    number: 47,
    emoji: "👻  🚫  🔦  🏙️",
    answer: "Ghostbusters",
    acceptedAnswers: ["ghostbusters", "ghost busters", "the ghostbusters", "ghostbusters movie"],
    category: "Movie",
    hints: [
      "It’s a supernatural comedy.",
      "A team runs an unusual removal service in New York City.",
      "The crossed-out ghost echoes the team’s famous logo.",
    ],
    explanation: "The barred ghost and New York setting identify the paranormal clean-up team known as the Ghostbusters.",
    structure: "movie",
  },
  {
    id: "finding-nemo",
    number: 48,
    emoji: "🔍  🐠  🌊  🇦🇺",
    answer: "Finding Nemo",
    acceptedAnswers: ["finding nemo", "find nemo", "finding nemo movie", "nemo"],
    category: "Animated movie",
    hints: [
      "It’s an animated ocean adventure.",
      "A father crosses the sea looking for his son.",
      "The destination is near Sydney, Australia.",
    ],
    explanation: "A clownfish searches the ocean for his missing son Nemo, eventually reaching Sydney.",
    structure: "movie",
  },
  {
    id: "toy-story",
    number: 49,
    emoji: "🤠  🚀  🧸  🤝",
    answer: "Toy Story",
    acceptedAnswers: ["toy story", "the toy story", "toy story movie", "toystory"],
    category: "Animated movie",
    hints: [
      "It’s an animated movie.",
      "The characters come alive when people leave.",
      "A cowboy and a space ranger become unlikely friends.",
    ],
    explanation: "Woody the cowboy and Buzz Lightyear the space ranger lead the living toys of Toy Story.",
    structure: "movie",
  },
  {
    id: "the-matrix",
    number: 50,
    emoji: "💊  🔴  🔵  💻",
    answer: "The Matrix",
    acceptedAnswers: ["the matrix", "matrix", "the matrix movie", "matrix movie"],
    category: "Movie",
    hints: [
      "It’s a science-fiction movie.",
      "Reality may be a computer simulation.",
      "A choice between a red pill and a blue pill changes everything.",
    ],
    explanation: "The red-or-blue pill choice awakens Neo to the simulated reality of The Matrix.",
    structure: "movie",
  },
  {
    id: "star-wars",
    number: 51,
    emoji: "⭐  ⚔️  🚀  🌌",
    answer: "Star Wars",
    acceptedAnswers: ["star wars", "the star wars", "starwars", "star wars saga"],
    category: "Movie series",
    hints: [
      "It’s a space-opera franchise.",
      "The first two emojis translate the title almost literally.",
      "The Force and lightsabers shape this galaxy far away.",
    ],
    explanation: "Stars, futuristic combat, and spacecraft assemble the title and world of Star Wars.",
    structure: "literal",
  },
  {
    id: "indiana-jones",
    number: 52,
    emoji: "🤠  🐍  🏺  🗺️",
    answer: "Indiana Jones",
    acceptedAnswers: ["indiana jones", "indy", "dr indiana jones", "doctor indiana jones", "indiana jones movies"],
    category: "Movie character",
    hints: [
      "You’re looking for an adventure-film hero.",
      "Ancient artifacts and maps come with the job.",
      "The hat is iconic, and he famously hates snakes.",
    ],
    explanation: "A fedora-wearing archaeologist with a fear of snakes can only be Indiana Jones.",
    structure: "person",
  },
  {
    id: "rocky",
    number: 53,
    emoji: "🥊  🪨  🏃  🪜",
    answer: "Rocky",
    acceptedAnswers: ["rocky", "rocky balboa", "the movie rocky", "rocky movie"],
    category: "Movie",
    hints: [
      "It’s a sports drama.",
      "The rock is a wordplay clue for the title.",
      "A boxer’s training run ends atop Philadelphia’s museum steps.",
    ],
    explanation: "The boxer, rock, and triumphant run up the Philadelphia steps identify Rocky Balboa.",
    structure: "movie",
  },
  {
    id: "forrest-gump",
    number: 54,
    emoji: "🏃  🍫  🪶  🚌",
    answer: "Forrest Gump",
    acceptedAnswers: ["forrest gump", "forest gump", "forrest", "the movie forrest gump"],
    category: "Movie",
    hints: [
      "It’s an American drama-comedy.",
      "Running, a feather, and a bus-stop bench frame the story.",
      "A box of chocolates is its most famous prop.",
    ],
    explanation: "Forrest’s long runs, floating feather, bus-stop story, and chocolates all mark Forrest Gump.",
    structure: "movie",
  },
  {
    id: "the-lion-king",
    number: 55,
    emoji: "🦁  👑  🌅  🐗",
    answer: "The Lion King",
    acceptedAnswers: ["the lion king", "lion king", "disney's the lion king", "disneys the lion king"],
    category: "Animated movie",
    hints: [
      "It’s an animated story.",
      "The first two emojis form the title.",
      "A young heir named Simba must reclaim the Pride Lands.",
    ],
    explanation: "The crowned lion is Simba, whose journey from cub to ruler drives The Lion King.",
    structure: "literal",
  },
  {
    id: "the-little-mermaid",
    number: 56,
    emoji: "🧜‍♀️  🦀  🎤  👑",
    answer: "The Little Mermaid",
    acceptedAnswers: ["the little mermaid", "little mermaid", "disney's the little mermaid", "disneys little mermaid", "ariel"],
    category: "Story and movie",
    hints: [
      "It’s a fairy tale known widely through animation.",
      "A sea princess longs for life on land.",
      "Ariel gives up her voice as part of the bargain.",
    ],
    explanation: "The mermaid princess, crab companion, and surrendered singing voice point to Ariel’s story.",
    structure: "story",
  },
  {
    id: "frozen",
    number: 57,
    emoji: "❄️  👭  ⛄  🏰",
    answer: "Frozen",
    acceptedAnswers: ["frozen", "disney frozen", "disney's frozen", "the movie frozen", "frozen movie"],
    category: "Animated movie",
    hints: [
      "It’s an animated musical.",
      "Two royal sisters are at the center of the story.",
      "Ice magic creates both a snowman and a crisis for Arendelle.",
    ],
    explanation: "Elsa’s ice powers, Anna’s devotion, and Olaf the snowman define Frozen.",
    structure: "movie",
  },
  {
    id: "up",
    number: 58,
    emoji: "🎈  🏠  ⬆️  👴",
    answer: "Up",
    acceptedAnswers: ["up", "pixar up", "disney pixar up", "the movie up", "up movie"],
    category: "Animated movie",
    hints: [
      "It’s an animated adventure.",
      "The arrow is also the entire title.",
      "Thousands of balloons lift an older man’s house into the sky.",
    ],
    explanation: "Carl’s balloon-tethered house literally rises up, launching the movie’s unlikely journey.",
    structure: "literal",
  },
  {
    id: "black-panther",
    number: 59,
    emoji: "⚫  🐆  👑  🦸",
    answer: "Black Panther",
    acceptedAnswers: ["black panther", "the black panther", "marvel's black panther", "marvel black panther", "t'challa", "tchalla"],
    category: "Superhero movie",
    hints: [
      "It’s a superhero title and identity.",
      "The first two emojis translate the name.",
      "The crown points to T’Challa, king of Wakanda.",
    ],
    explanation: "The black cat, royal crown, and hero symbol point to T’Challa, Wakanda’s Black Panther.",
    structure: "literal",
  },
  {
    id: "barbie",
    number: 60,
    emoji: "🩷  👱‍♀️  👠  🏠",
    answer: "Barbie",
    acceptedAnswers: ["barbie", "barbie doll", "barbie movie", "the barbie movie", "barbie the movie"],
    category: "American cultural icon",
    hints: [
      "It’s a toy character and movie title.",
      "Pink fashion and a dream house are signature clues.",
      "The doll debuted in 1959.",
    ],
    explanation: "The pink wardrobe and Dreamhouse belong to Barbie, the enduring doll who also headlines the film.",
    structure: "person",
  },
  {
    id: "born-in-the-usa",
    number: 61,
    emoji: "👶  📍  🇺🇸  🎸",
    answer: "Born in the U.S.A.",
    acceptedAnswers: ["born in the u.s.a.", "born in the usa", "born in america", "bruce springsteen born in the usa"],
    category: "Song",
    hints: [
      "It’s a famous American song title.",
      "The first three clues read almost word for word.",
      "Bruce Springsteen recorded it.",
    ],
    explanation: "Baby, location, and flag spell out the title of Bruce Springsteen’s Born in the U.S.A.",
    structure: "literal",
  },
  {
    id: "take-me-home-country-roads",
    number: 62,
    emoji: "🚗  🙋  🏠  🛣️  ⛰️",
    answer: "Take Me Home, Country Roads",
    acceptedAnswers: ["take me home country roads", "country roads take me home", "country roads", "take me home", "john denver country roads"],
    category: "Song",
    hints: [
      "It’s a sing-along song title.",
      "The emojis nearly state its best-known line in order.",
      "John Denver’s song points toward West Virginia.",
    ],
    explanation: "A traveler asks country roads to carry him home in John Denver’s enduring anthem.",
    structure: "literal",
  },
  {
    id: "purple-rain",
    number: 63,
    emoji: "🟣  🌧️  🎸  👑",
    answer: "Purple Rain",
    acceptedAnswers: ["purple rain", "prince purple rain", "purple rain by prince", "the purple rain"],
    category: "Song and movie",
    hints: [
      "It’s a song title and a movie title.",
      "The first two emojis translate it directly.",
      "The crown clues the artist Prince.",
    ],
    explanation: "Purple weather and a royal clue combine into Prince’s signature work, Purple Rain.",
    structure: "literal",
  },
  {
    id: "firework",
    number: 64,
    emoji: "🫵  💡  🎆  🎤",
    answer: "Firework",
    acceptedAnswers: ["firework", "fireworks", "katy perry firework", "firework by katy perry"],
    category: "Song",
    hints: [
      "It’s a pop song title.",
      "The bright burst is the title clue.",
      "Katy Perry sings the empowerment anthem.",
    ],
    explanation: "The explosive burst and pop microphone point to Katy Perry’s anthem Firework.",
    structure: "interpretive",
  },
  {
    id: "piano-man",
    number: 65,
    emoji: "🎹  👨  🍺  🎤",
    answer: "Piano Man",
    acceptedAnswers: ["piano man", "the piano man", "billy joel piano man", "piano man by billy joel"],
    category: "Song",
    hints: [
      "It’s a song title.",
      "The first two emojis name it directly.",
      "Billy Joel’s narrator performs in a bar.",
    ],
    explanation: "A musician entertaining bar patrons at the keys is Billy Joel’s Piano Man.",
    structure: "literal",
  },
  {
    id: "sweet-home-alabama",
    number: 66,
    emoji: "🍬  🏠  🅰️  🎸",
    answer: "Sweet Home Alabama",
    acceptedAnswers: ["sweet home alabama", "lynyrd skynyrd sweet home alabama", "sweet home alabama song", "home sweet alabama"],
    category: "Song",
    hints: [
      "It’s a Southern rock song title.",
      "The first three clues sound out its key words.",
      "Lynyrd Skynyrd recorded it.",
    ],
    explanation: "Candy, a house, and an A lead directly to Lynyrd Skynyrd’s Sweet Home Alabama.",
    structure: "rebus",
  },
  {
    id: "california-dreamin",
    number: 67,
    emoji: "🌴  🌊  💭  ❄️",
    answer: "California Dreamin’",
    acceptedAnswers: ["california dreamin'", "california dreamin", "california dreaming", "the mamas and the papas california dreamin"],
    category: "Song",
    hints: [
      "It’s a classic song title.",
      "A warm West Coast place is imagined during a cold day.",
      "The Mamas & the Papas made it famous.",
    ],
    explanation: "Palm trees and ocean are dreamed of amid winter in the Mamas & the Papas’ California Dreamin’.",
    structure: "interpretive",
  },
  {
    id: "american-pie",
    number: 68,
    emoji: "🇺🇸  🥧  🎤  🛣️",
    answer: "American Pie",
    acceptedAnswers: ["american pie", "don mclean american pie", "american pie song", "american pie by don mclean"],
    category: "Song",
    hints: [
      "It’s a landmark song title.",
      "The first two emojis state the title directly.",
      "Don McLean’s long ballad reflects on “the day the music died.”",
    ],
    explanation: "The U.S. flag and dessert spell American Pie, Don McLean’s famous musical reflection on cultural change.",
    structure: "literal",
  },
  {
    id: "ring-of-fire",
    number: 69,
    emoji: "💍  🔥  🎸  ⚫",
    answer: "Ring of Fire",
    acceptedAnswers: ["ring of fire", "the ring of fire", "johnny cash ring of fire", "ring of fire by johnny cash"],
    category: "Song",
    hints: [
      "It’s a country song title.",
      "The first two emojis translate it directly.",
      "The final dark clue nods to Johnny Cash, the Man in Black.",
    ],
    explanation: "A burning ring and the Man in Black point to Johnny Cash’s enduring hit Ring of Fire.",
    structure: "literal",
  },
  {
    id: "walking-on-sunshine",
    number: 70,
    emoji: "🚶  ⬆️  ☀️  😄",
    answer: "Walking on Sunshine",
    acceptedAnswers: ["walking on sunshine", "walkin on sunshine", "walk on sunshine", "katrina and the waves walking on sunshine"],
    category: "Song",
    hints: [
      "It’s an upbeat pop song title.",
      "Read the movement, position, and weather clues in order.",
      "Katrina and the Waves recorded it.",
    ],
    explanation: "The literal sunny stroll and joyful face capture Katrina and the Waves’ Walking on Sunshine.",
    structure: "literal",
  },
  {
    id: "friends-tv",
    number: 71,
    emoji: "👥  🛋️  ☕  🗽",
    answer: "Friends",
    acceptedAnswers: ["friends", "friends tv show", "the show friends", "friends sitcom", "f.r.i.e.n.d.s."],
    category: "TV show",
    hints: [
      "It’s a long-running American sitcom.",
      "A close-knit group gathers around a couch and coffee in New York.",
      "Central Perk is their regular meeting place.",
    ],
    explanation: "Six New York friends, a familiar couch, and endless Central Perk coffee define Friends.",
    structure: "interpretive",
  },
  {
    id: "the-simpsons",
    number: 72,
    emoji: "👨‍👩‍👧‍👦  🍩  ☢️  📺",
    answer: "The Simpsons",
    acceptedAnswers: ["the simpsons", "simpsons", "the simpson family", "simpsons tv show"],
    category: "Animated TV show",
    hints: [
      "It’s an animated sitcom.",
      "A family lives in a town beside a nuclear power plant.",
      "The doughnut is Homer’s favorite treat.",
    ],
    explanation: "The family, doughnut, and nuclear plant belong to Homer and the rest of The Simpsons in Springfield.",
    structure: "interpretive",
  },
  {
    id: "sesame-street",
    number: 73,
    emoji: "1️⃣  2️⃣  3️⃣  🟢  🛣️",
    answer: "Sesame Street",
    acceptedAnswers: ["sesame street", "the sesame street", "sesame st", "sesame street tv show"],
    category: "Children’s TV show",
    hints: [
      "It’s an educational children’s show.",
      "Numbers and letters are frequent lessons.",
      "Its title appears on a green street sign.",
    ],
    explanation: "Counting lessons and the familiar green street sign lead generations of viewers to Sesame Street.",
    structure: "interpretive",
  },
  {
    id: "the-office",
    number: 74,
    emoji: "🏢  📄  ☕  📹",
    answer: "The Office",
    acceptedAnswers: ["the office", "office", "the office us", "the american office", "the office tv show"],
    category: "TV show",
    hints: [
      "It’s a workplace comedy.",
      "A documentary crew follows employees at a paper company.",
      "The U.S. version is set at Dunder Mifflin in Scranton.",
    ],
    explanation: "An office, paper, coffee, and documentary camera capture the everyday absurdity of The Office.",
    structure: "interpretive",
  },
  {
    id: "stranger-things",
    number: 75,
    emoji: "🚲  🔦  👾  🔄",
    answer: "Stranger Things",
    acceptedAnswers: ["stranger things", "the stranger things", "stranger things tv show", "stranger thing"],
    category: "TV show",
    hints: [
      "It’s a supernatural series.",
      "Kids on bikes investigate danger in a small 1980s town.",
      "A shadow dimension called the Upside Down is breaking through.",
    ],
    explanation: "Bikes, flashlights, monsters, and an inverted world point to the mysteries of Stranger Things.",
    structure: "interpretive",
  },
  {
    id: "breaking-bad",
    number: 76,
    emoji: "🧑‍🏫  🧪  💵  ⚠️",
    answer: "Breaking Bad",
    acceptedAnswers: ["breaking bad", "the breaking bad", "breaking bad tv show", "braking bad"],
    category: "TV show",
    hints: [
      "It’s a crime drama.",
      "A chemistry teacher enters an illegal business.",
      "Walter White’s choices transform him into Heisenberg.",
    ],
    explanation: "The teacher, chemistry equipment, and dangerous money trail tell Walter White’s Breaking Bad transformation.",
    structure: "interpretive",
  },
  {
    id: "fresh-prince-bel-air",
    number: 77,
    emoji: "🆕  👑  🏠  🌴",
    answer: "The Fresh Prince of Bel-Air",
    acceptedAnswers: ["the fresh prince of bel-air", "fresh prince of bel air", "the fresh prince", "fresh prince", "fresh prince of belair"],
    category: "TV show",
    hints: [
      "It’s a 1990s sitcom.",
      "The first two clues translate part of the title.",
      "Will moves from West Philadelphia to his wealthy relatives’ California home.",
    ],
    explanation: "A fresh young prince and a palm-lined mansion point to The Fresh Prince of Bel-Air.",
    structure: "rebus",
  },
  {
    id: "saturday-night-live",
    number: 78,
    emoji: "📅  🌙  🔴  🎤",
    answer: "Saturday Night Live",
    acceptedAnswers: ["saturday night live", "snl", "saturday night live show", "saturday nite live"],
    category: "TV show",
    hints: [
      "It’s a television institution built around comedy and music.",
      "The calendar and moon give the first two words.",
      "Each episode opens with the announcement that it is live from New York.",
    ],
    explanation: "A weekend night, live indicator, and microphone spell out the weekly sketch show Saturday Night Live.",
    structure: "rebus",
  },
  {
    id: "jeopardy",
    number: 79,
    emoji: "❓  💵  📺  ⏱️",
    answer: "Jeopardy!",
    acceptedAnswers: ["jeopardy!", "jeopardy", "the jeopardy show", "jeopardy game show"],
    category: "TV game show",
    hints: [
      "It’s a long-running quiz show.",
      "Contestants compete for money under time pressure.",
      "Responses must be phrased in the form of a question.",
    ],
    explanation: "Question-form responses and clue values identify the answer-and-question format of Jeopardy!",
    structure: "interpretive",
  },
  {
    id: "scooby-doo",
    number: 80,
    emoji: "🐕  🔍  👻  🚐",
    answer: "Scooby-Doo",
    acceptedAnswers: ["scooby-doo", "scooby doo", "scooby", "scooby doo where are you", "scoobydoo"],
    category: "Animated TV series",
    hints: [
      "It’s an animated mystery franchise.",
      "A dog and young detectives investigate apparent hauntings.",
      "They travel in the Mystery Machine.",
    ],
    explanation: "A mystery-solving Great Dane chases masked “ghosts” with his friends in Scooby-Doo.",
    structure: "story",
  },
  {
    id: "thanksgiving",
    number: 81,
    emoji: "🦃  🥧  🙏  👨‍👩‍👧‍👦",
    answer: "Thanksgiving",
    acceptedAnswers: ["thanksgiving", "thanksgiving day", "american thanksgiving", "turkey day"],
    category: "American holiday",
    hints: [
      "It’s a U.S. holiday.",
      "Families often gather for turkey and pie.",
      "Its name centers on expressing gratitude.",
    ],
    explanation: "Turkey, pie, gratitude, and a family gathering form the familiar American Thanksgiving tradition.",
    structure: "interpretive",
  },
  {
    id: "fourth-of-july",
    number: 82,
    emoji: "4️⃣  🇺🇸  🎆  📜",
    answer: "The Fourth of July",
    acceptedAnswers: ["the fourth of july", "fourth of july", "4th of july", "independence day", "july fourth", "july 4th"],
    category: "American holiday",
    hints: [
      "It’s a U.S. holiday.",
      "Fireworks commemorate a founding document.",
      "Its other name is Independence Day.",
    ],
    explanation: "Americans mark the July 4 adoption of the Declaration of Independence with flags and fireworks.",
    structure: "historical",
  },
  {
    id: "super-bowl",
    number: 83,
    emoji: "🏈  🏆  📺  🥣",
    answer: "The Super Bowl",
    acceptedAnswers: ["the super bowl", "super bowl", "superbowl", "nfl championship", "the big game"],
    category: "American sporting event",
    hints: [
      "It’s a major annual sporting event.",
      "Football, a trophy, and a huge TV audience are central.",
      "The final emoji is a literal clue for the second word.",
    ],
    explanation: "The NFL championship combines football spectacle with one of America’s biggest television events.",
    structure: "rebus",
  },
  {
    id: "take-me-out-ball-game",
    number: 84,
    emoji: "🙋  ➡️  ⚾  🏟️  🎵",
    answer: "Take Me Out to the Ball Game",
    acceptedAnswers: ["take me out to the ball game", "take me out to a ball game", "take me to the ball game", "take me out to the baseball game"],
    category: "American song and tradition",
    hints: [
      "It’s a song tied to a sport.",
      "The emojis read like a request to attend a baseball game.",
      "Crowds traditionally sing it during the seventh-inning stretch.",
    ],
    explanation: "The classic ballpark sing-along asks to be taken out to a baseball game.",
    structure: "literal",
  },
  {
    id: "american-as-apple-pie",
    number: 85,
    emoji: "🇺🇸  ↔️  🍎  🥧",
    answer: "As American as apple pie",
    acceptedAnswers: ["as american as apple pie", "american as apple pie", "all american as apple pie", "it's as american as apple pie"],
    category: "American expression",
    hints: [
      "It’s a cultural expression.",
      "The comparison describes something seen as traditionally American.",
      "Complete the phrase after “As American as…”",
    ],
    explanation: "The saying uses apple pie as a shorthand for something regarded as quintessentially American.",
    structure: "literal",
  },
  {
    id: "peanut-butter-jelly",
    number: 86,
    emoji: "🥜  🧈  ➕  🍇  🍞",
    answer: "Peanut butter and jelly",
    acceptedAnswers: ["peanut butter and jelly", "peanut butter & jelly", "pb and j", "pb&j", "peanut butter jelly sandwich", "pbj"],
    category: "American food",
    hints: [
      "It’s a familiar sandwich.",
      "The grapes represent a fruit spread.",
      "Its initials are P, B, and J.",
    ],
    explanation: "Peanuts become peanut butter, grapes become jelly, and bread turns the pairing into a PB&J.",
    structure: "literal",
  },
  {
    id: "smores",
    number: 87,
    emoji: "🔥  🍫  ☁️  🍪",
    answer: "S’mores",
    acceptedAnswers: ["s'mores", "smores", "s mores", "a s'more", "campfire smores"],
    category: "American treat",
    hints: [
      "It’s a sweet food associated with camping.",
      "The cloud stands in for a toasted marshmallow.",
      "Chocolate and marshmallow are pressed between graham crackers.",
    ],
    explanation: "A campfire-toasted marshmallow, chocolate, and graham crackers combine into s’mores.",
    structure: "literal",
  },
  {
    id: "hot-dog",
    number: 88,
    emoji: "🔥  🐕  🌭  ⚾",
    answer: "Hot dog",
    acceptedAnswers: ["hot dog", "hotdog", "a hot dog", "hot dogs", "frankfurter"],
    category: "American food",
    hints: [
      "It’s a food with a playful name.",
      "The first two emojis build that name literally.",
      "It’s strongly associated with ballparks and cookouts.",
    ],
    explanation: "Heat plus dog spells the name of the classic ballpark sausage in a bun.",
    structure: "rebus",
  },
  {
    id: "new-years-eve",
    number: 89,
    emoji: "🆕  📅  🌙  🕛",
    answer: "New Year’s Eve",
    acceptedAnswers: ["new year's eve", "new years eve", "nye", "new year eve", "december 31"],
    category: "Holiday observance",
    hints: [
      "It’s a night of celebration.",
      "A calendar changes when the clock reaches midnight.",
      "It falls on December 31.",
    ],
    explanation: "At midnight on New Year’s Eve, one calendar year ends and the next begins.",
    structure: "literal",
  },
  {
    id: "black-friday",
    number: 90,
    emoji: "⚫  📅  🛍️  💸",
    answer: "Black Friday",
    acceptedAnswers: ["black friday", "the black friday", "black friday shopping", "friday after thanksgiving"],
    category: "American shopping tradition",
    hints: [
      "It’s an annual retail event.",
      "The first two clues form its name.",
      "It arrives the day after Thanksgiving with prominent sales.",
    ],
    explanation: "The Friday after Thanksgiving is known for major retail promotions and holiday shopping.",
    structure: "literal",
  },
  {
    id: "the-great-gatsby",
    number: 91,
    emoji: "🎩  🥂  🟢  💡",
    answer: "The Great Gatsby",
    acceptedAnswers: ["the great gatsby", "great gatsby", "gatsby", "f scott fitzgerald the great gatsby"],
    category: "American novel",
    hints: [
      "It’s a classic American novel.",
      "Lavish Jazz Age parties hide longing and reinvention.",
      "A green light across the water symbolizes Gatsby’s unreachable dream.",
    ],
    explanation: "The parties, fine clothes, and distant green light evoke Jay Gatsby’s glittering but doomed dream.",
    structure: "story",
  },
  {
    id: "to-kill-a-mockingbird",
    number: 92,
    emoji: "🎯  🐦  ⚖️  👧",
    answer: "To Kill a Mockingbird",
    acceptedAnswers: ["to kill a mockingbird", "kill a mockingbird", "harper lee to kill a mockingbird", "mockingbird"],
    category: "American novel",
    hints: [
      "It’s a classic American novel.",
      "A child observes injustice and moral courage in a Southern town.",
      "Atticus Finch defends a man in court.",
    ],
    explanation: "The bird, scales of justice, and young viewpoint point to Harper Lee’s To Kill a Mockingbird.",
    structure: "story",
  },
  {
    id: "moby-dick",
    number: 93,
    emoji: "⚪  🐋  ⛵  🦵",
    answer: "Moby-Dick",
    acceptedAnswers: ["moby-dick", "moby dick", "moby dick or the whale", "the white whale"],
    category: "American novel",
    hints: [
      "It’s a classic seafaring novel.",
      "A captain pursues one particular white whale.",
      "Captain Ahab’s obsession drives the Pequod’s voyage.",
    ],
    explanation: "The white whale and Ahab’s lost leg capture the obsessive hunt at the heart of Moby-Dick.",
    structure: "story",
  },
  {
    id: "catcher-in-the-rye",
    number: 94,
    emoji: "🧤  📍  🌾  👦",
    answer: "The Catcher in the Rye",
    acceptedAnswers: ["the catcher in the rye", "catcher in the rye", "j d salinger catcher in the rye", "the catcher and the rye"],
    category: "American novel",
    hints: [
      "It’s a coming-of-age novel.",
      "The first three clues translate much of the title.",
      "Holden Caulfield narrates his days in New York City.",
    ],
    explanation: "The catching glove, location marker, and grain build the title of Holden Caulfield’s story.",
    structure: "rebus",
  },
  {
    id: "little-women",
    number: 95,
    emoji: "👧  👧  👧  👧  ✍️",
    answer: "Little Women",
    acceptedAnswers: ["little women", "the little women", "louisa may alcott little women", "the march sisters"],
    category: "American novel",
    hints: [
      "It’s a classic novel.",
      "Four sisters grow up during and after the Civil War.",
      "Jo March dreams of becoming a writer.",
    ],
    explanation: "The four young March sisters—especially aspiring writer Jo—are the Little Women of the title.",
    structure: "story",
  },
  {
    id: "grapes-of-wrath",
    number: 96,
    emoji: "🍇  😡  🚚  🌾",
    answer: "The Grapes of Wrath",
    acceptedAnswers: ["the grapes of wrath", "grapes of wrath", "john steinbeck the grapes of wrath", "grape of wrath"],
    category: "American novel",
    hints: [
      "It’s a Depression-era American novel.",
      "The first two emojis translate the title.",
      "The Joad family travels west after losing its Oklahoma farm.",
    ],
    explanation: "Angry grapes spell the title, while the truck and fields recall the Joad family’s Dust Bowl migration.",
    structure: "literal",
  },
  {
    id: "charlottes-web",
    number: 97,
    emoji: "🕷️  🕸️  🐖  ✍️",
    answer: "Charlotte’s Web",
    acceptedAnswers: ["charlotte's web", "charlottes web", "charlotte web", "e b white charlotte's web"],
    category: "American children’s book",
    hints: [
      "It’s a beloved children’s story.",
      "A spider uses writing to help a pig.",
      "Charlotte spins words into her web to save Wilbur.",
    ],
    explanation: "Charlotte the spider writes praise for Wilbur in her web, changing the pig’s fate.",
    structure: "story",
  },
  {
    id: "green-eggs-and-ham",
    number: 98,
    emoji: "🟢  🥚  ➕  🐖",
    answer: "Green Eggs and Ham",
    acceptedAnswers: ["green eggs and ham", "green egg and ham", "dr seuss green eggs and ham", "green eggs & ham"],
    category: "American children’s book",
    hints: [
      "It’s a rhyming children’s book.",
      "The emojis state the title almost directly.",
      "Sam-I-Am persistently offers the unusual meal.",
    ],
    explanation: "Green eggs and a pig standing in for ham spell the title of Dr. Seuss’s famously persistent food offer.",
    structure: "literal",
  },
  {
    id: "giving-tree",
    number: 99,
    emoji: "🌳  🎁  👦  ⏳",
    answer: "The Giving Tree",
    acceptedAnswers: ["the giving tree", "giving tree", "shel silverstein the giving tree", "the tree that gives"],
    category: "American children’s book",
    hints: [
      "It’s a picture book.",
      "A tree gives repeatedly as a boy grows older.",
      "The title names the generous tree directly.",
    ],
    explanation: "The tree offers the boy parts of itself throughout his life in Shel Silverstein’s The Giving Tree.",
    structure: "story",
  },
  {
    id: "where-wild-things-are",
    number: 100,
    emoji: "👦  👑  👹  🌙",
    answer: "Where the Wild Things Are",
    acceptedAnswers: ["where the wild things are", "where wild things are", "the wild things", "maurice sendak where the wild things are"],
    category: "American children’s book",
    hints: [
      "It’s a classic picture book.",
      "A mischievous boy sails to a land of monsters.",
      "Max becomes king of the Wild Things before returning home for supper.",
    ],
    explanation: "Max’s crown, the monsters, and his nighttime journey map the adventure in Where the Wild Things Are.",
    structure: "story",
  },
];

export const DAILY_PUZZLES = PUZZLES.slice(0, 20);
export const PRACTICE_PUZZLES = PUZZLES.slice(20);

export function normalizeGuess(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/\p{M}+/gu, "")
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNormalizedGuess(value: string) {
  return value.replace(/\s/g, "");
}

export function isAcceptedGuess(puzzle: Puzzle, guess: string) {
  const normalized = normalizeGuess(guess);
  const compact = compactNormalizedGuess(normalized);

  return puzzle.acceptedAnswers.some((answer) => {
    const normalizedAnswer = normalizeGuess(answer);
    return normalizedAnswer === normalized || compactNormalizedGuess(normalizedAnswer) === compact;
  });
}

export function getPuzzlesForPool(pool: PuzzlePool) {
  return pool === "daily" ? DAILY_PUZZLES : PRACTICE_PUZZLES;
}

export function getPuzzleById(id: string, pool?: PuzzlePool) {
  return (pool ? getPuzzlesForPool(pool) : PUZZLES).find((puzzle) => puzzle.id === id);
}

export function getPuzzleByNumber(number: number, pool: PuzzlePool = "daily") {
  return getPuzzlesForPool(pool).find((puzzle) => puzzle.number === number);
}

export function getPracticePuzzleByPosition(position: number) {
  return PRACTICE_PUZZLES[position - 1];
}

export function getPuzzlePosition(puzzle: Puzzle, pool: PuzzlePool) {
  return getPuzzlesForPool(pool).findIndex((candidate) => candidate.id === puzzle.id) + 1;
}

export function getNextPuzzle(puzzle: Puzzle, pool: PuzzlePool = "daily") {
  const puzzles = getPuzzlesForPool(pool);
  const index = puzzles.findIndex((candidate) => candidate.id === puzzle.id);
  return puzzles[(index + 1) % puzzles.length];
}

export function getNextPuzzleLaunchAt(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

export function formatTimeUntilPuzzleLaunch(now: number, launchAt: number) {
  const totalMinutes = Math.ceil(Math.max(0, launchAt - now) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function getDailyPuzzle(now = new Date()) {
  const launch = Date.parse(`${GAME_CONFIG.launchDate}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsedDays = Math.max(0, Math.floor((today - launch) / 86_400_000));
  const index = GAME_CONFIG.cycleAfterLastPuzzle
    ? elapsedDays % DAILY_PUZZLES.length
    : Math.min(elapsedDays, DAILY_PUZZLES.length - 1);
  return DAILY_PUZZLES[index];
}

export function getPuzzleDateCode(now = new Date()) {
  return now.toISOString().slice(2, 10).replace(/-/g, "");
}

function getOriginalPuzzleDateCode(puzzle: Pick<Puzzle, "number">) {
  const launch = Date.parse(`${GAME_CONFIG.launchDate}T00:00:00Z`);
  return getPuzzleDateCode(new Date(launch + (puzzle.number - 1) * 86_400_000));
}

export function isRankingEligible(context: PlayContext) {
  return context === "daily";
}

export function toPublicPuzzle(
  puzzle: Puzzle,
  options: { pool: PuzzlePool; context: PlayContext; now?: Date },
): PublicPuzzle {
  const puzzles = getPuzzlesForPool(options.pool);
  const dateCode = options.context === "daily" ? getPuzzleDateCode(options.now) : null;
  return {
    id: puzzle.id,
    number: puzzle.number,
    emoji: puzzle.emoji,
    hintCount: puzzle.hints.length,
    pool: options.pool,
    context: options.context,
    sequenceNumber: getPuzzlePosition(puzzle, options.pool),
    sequenceLength: puzzles.length,
    dateCode,
    rankingEligible: isRankingEligible(options.context),
    legacyStorageEligible: dateCode !== null && dateCode === getOriginalPuzzleDateCode(puzzle),
  };
}

export function puzzleResolution(puzzle: Puzzle) {
  return {
    answer: puzzle.answer,
    category: puzzle.category,
    explanation: puzzle.explanation,
  };
}
