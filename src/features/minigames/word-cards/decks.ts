// The word cards, by module — and by unit, for a module that has units.
//
// A module's `name` is the curriculum module's own name (the `modules` table),
// so the selector reads the way the rest of the app does. A module either has
// `cards` of its own (Eurotrip: a one-off course with no units) or `units`, each
// with its cards; the unit selector only appears for the second kind.

export type WordCard = {
  category: string;
  word: string;
  /** The words the explainer may not say. Five, by convention. */
  taboo: string[];
};

export type WordUnit = { id: string; name: string; cards: WordCard[] };

export type WordModule = { id: string; name: string } & (
  | { cards: WordCard[]; units?: undefined }
  | { units: WordUnit[]; cards?: undefined }
);

/** Rows of [category, word, taboo words] — the shape the deck is written in. */
type Row = [string, string, string[]];

function cards(rows: Row[]): WordCard[] {
  return rows.map(([category, word, taboo]) => ({ category, word, taboo }));
}

// Book One. The words are each unit's own — the same pool Book One Crossings
// draws its boards from (the Vocabulary stages of B1L1–B1L24 plus the everyday
// nouns those lessons talk about) — and the forbidden words are kept to what a
// Book One student already has, so the card is hard for the right reason.

const BOOK_ONE_U1: Row[] = [
  // Daily life
  ["Daily life", "Coffee", ["drink", "morning", "cup", "hot", "Starbucks"]],
  ["Daily life", "Breakfast", ["morning", "eat", "first", "meal", "coffee"]],
  ["Daily life", "Morning", ["early", "wake up", "sun", "day", "breakfast"]],
  ["Daily life", "Night", ["dark", "sleep", "late", "moon", "evening"]],
  ["Daily life", "Weekend", ["Saturday", "Sunday", "rest", "week", "free"]],
  ["Daily life", "Monday", ["day", "week", "first", "Friday", "work"]],
  ["Daily life", "Family", ["mother", "father", "children", "parents", "home"]],
  ["Daily life", "Home", ["house", "live", "family", "apartment", "return"]],
  // Work
  ["Work", "Email", ["computer", "send", "message", "inbox", "write"]],
  ["Work", "Meeting", ["people", "talk", "room", "work", "call"]],
  ["Work", "Office", ["work", "desk", "building", "company", "boss"]],
  ["Work", "Team", ["group", "people", "work", "together", "colleagues"]],
  ["Work", "Deadline", ["date", "finish", "time", "project", "late"]],
  ["Work", "Computer", ["laptop", "screen", "keyboard", "work", "internet"]],
  ["Work", "Phone", ["call", "mobile", "iPhone", "message", "app"]],
  // Places & getting there
  ["Places", "Car", ["drive", "road", "wheels", "park", "traffic"]],
  ["Places", "Hospital", ["doctor", "sick", "nurse", "patient", "ambulance"]],
  ["Places", "School", ["teacher", "students", "learn", "class", "children"]],
];

const BOOK_ONE_U2: Row[] = [
  // Places
  ["Places", "Restaurant", ["eat", "waiter", "food", "menu", "dinner"]],
  ["Places", "Supermarket", ["buy", "food", "shop", "groceries", "cart"]],
  ["Places", "Pharmacy", ["medicine", "buy", "drugs", "sick", "prescription"]],
  ["Places", "Gym", ["exercise", "weights", "train", "muscles", "fitness"]],
  ["Places", "Elevator", ["floor", "up", "down", "building", "stairs"]],
  ["Places", "Reception", ["hotel", "desk", "front", "check in", "welcome"]],
  // Food & money
  ["Food & money", "Pizza", ["Italy", "cheese", "slice", "tomato", "delivery"]],
  ["Food & money", "Bill", ["pay", "restaurant", "money", "waiter", "check"]],
  ["Food & money", "Card", ["credit", "pay", "bank", "money", "plastic"]],
  ["Food & money", "Hungry", ["eat", "food", "stomach", "lunch", "empty"]],
  // Free time
  ["Free time", "Series", ["Netflix", "watch", "episode", "TV", "season"]],
  ["Free time", "Book", ["read", "pages", "author", "story", "library"]],
  ["Free time", "Music", ["song", "listen", "sing", "band", "Spotify"]],
  ["Free time", "Friends", ["people", "together", "party", "best", "meet"]],
  // Describing things
  ["Describing", "Expensive", ["price", "money", "cost", "cheap", "a lot"]],
  ["Describing", "Sweet", ["sugar", "cake", "chocolate", "taste", "candy"]],
  ["Describing", "Fast", ["quick", "speed", "slow", "car", "run"]],
  ["Describing", "Cold", ["ice", "winter", "temperature", "hot", "freeze"]],
];

const BOOK_ONE_U3: Row[] = [
  // Things that go wrong
  ["Problems", "Problem", ["wrong", "issue", "solve", "bad", "trouble"]],
  ["Problems", "Mistake", ["wrong", "error", "sorry", "fix", "correct"]],
  ["Problems", "Bug", ["error", "software", "program", "fix", "computer"]],
  ["Problems", "Delay", ["late", "wait", "flight", "time", "train"]],
  ["Problems", "Traffic", ["cars", "jam", "road", "slow", "rush hour"]],
  ["Problems", "Rain", ["water", "umbrella", "wet", "weather", "cloud"]],
  // Work
  ["Work", "Presentation", ["slides", "PowerPoint", "speak", "audience", "meeting"]],
  ["Work", "Report", ["document", "write", "results", "boss", "monthly"]],
  ["Work", "Update", ["new", "version", "install", "news", "latest"]],
  ["Work", "Manager", ["boss", "team", "work", "lead", "company"]],
  ["Work", "Client", ["customer", "company", "buy", "service", "pay"]],
  // Errands & appointments
  ["Errands", "Appointment", ["time", "doctor", "meeting", "schedule", "book"]],
  ["Errands", "Errand", ["task", "go", "buy", "small", "outside"]],
  ["Errands", "Doctor", ["sick", "hospital", "medicine", "health", "clinic"]],
  ["Errands", "Bank", ["money", "account", "cash", "card", "ATM"]],
];

const BOOK_ONE_U4: Row[] = [
  // When
  ["When", "Tomorrow", ["day", "after", "today", "next", "morning"]],
  ["When", "Friday", ["day", "week", "weekend", "Thursday", "last"]],
  ["When", "Noon", ["twelve", "midday", "lunch", "o'clock", "day"]],
  ["When", "Calendar", ["date", "month", "days", "plan", "year"]],
  ["When", "Holiday", ["vacation", "travel", "free", "trip", "beach"]],
  // Making plans
  ["Plans", "Cancel", ["stop", "not", "plan", "call off", "meeting"]],
  ["Plans", "Confirm", ["yes", "sure", "check", "appointment", "agree"]],
  ["Plans", "Postpone", ["later", "delay", "move", "date", "change"]],
  ["Plans", "Busy", ["free", "time", "lots", "work", "no"]],
  ["Plans", "Invite", ["party", "ask", "come", "guest", "card"]],
  // Events
  ["Events", "Party", ["music", "dance", "friends", "celebrate", "drinks"]],
  ["Events", "Dinner", ["evening", "eat", "meal", "night", "restaurant"]],
  ["Events", "Trip", ["travel", "go", "journey", "vacation", "bag"]],
  ["Events", "Birthday", ["cake", "age", "party", "candles", "year"]],
];

const EUROTRIP: Row[] = [
  // Getting around
  ["Getting around", "Airport", ["plane", "flight", "terminal", "gate", "travel"]],
  ["Getting around", "Passport", ["country", "border", "document", "photo", "travel"]],
  ["Getting around", "Suitcase", ["bag", "clothes", "pack", "luggage", "wheels"]],
  ["Getting around", "Boarding pass", ["plane", "gate", "ticket", "flight", "seat"]],
  ["Getting around", "Jet lag", ["tired", "sleep", "time zone", "flight", "hours"]],
  ["Getting around", "Train station", ["platform", "railway", "ticket", "wait", "trip"]],
  ["Getting around", "Ferry", ["boat", "lake", "sea", "cross", "car"]],
  ["Getting around", "Taxi", ["car", "driver", "pay", "ride", "Uber"]],
  ["Getting around", "Metro", ["train", "underground", "station", "city", "line"]],
  ["Getting around", "Connecting flight", ["plane", "change", "airport", "second", "stop"]],
  ["Getting around", "Charger", ["phone", "battery", "plug", "cable", "electricity"]],
  ["Getting around", "Adapter", ["plug", "socket", "wall", "electricity", "country"]],
  // Hotel & money
  ["Hotel & money", "Hotel", ["room", "sleep", "bed", "stay", "reception"]],
  ["Hotel & money", "Reception", ["hotel", "desk", "check in", "key", "front"]],
  ["Hotel & money", "Check-out", ["hotel", "leave", "room", "time", "key"]],
  ["Hotel & money", "Towel", ["dry", "bath", "shower", "beach", "wet"]],
  ["Hotel & money", "Pillow", ["bed", "head", "sleep", "soft", "night"]],
  ["Hotel & money", "Tip", ["waiter", "money", "extra", "service", "restaurant"]],
  ["Hotel & money", "Receipt", ["paper", "pay", "bill", "shop", "money"]],
  ["Hotel & money", "Cash", ["money", "coins", "notes", "card", "pay"]],
  ["Hotel & money", "Exchange rate", ["money", "currency", "euro", "dollar", "bank"]],
  ["Hotel & money", "Discount", ["price", "cheaper", "sale", "percent", "pay"]],
  ["Hotel & money", "Fine", ["pay", "money", "police", "rule", "ticket"]],
  // Sightseeing
  ["Sightseeing", "Museum", ["art", "paintings", "history", "ticket", "visit"]],
  ["Sightseeing", "Cathedral", ["church", "God", "religion", "Mass", "big"]],
  ["Sightseeing", "Queue", ["line", "wait", "people", "long", "stand"]],
  ["Sightseeing", "Tour guide", ["explain", "group", "visit", "follow", "tourists"]],
  ["Sightseeing", "Souvenir", ["gift", "buy", "remember", "shop", "trip"]],
  ["Sightseeing", "Map", ["street", "find", "lost", "Google", "city"]],
  ["Sightseeing", "Selfie", ["photo", "phone", "camera", "picture", "myself"]],
  ["Sightseeing", "Gondola", ["Venice", "boat", "canal", "row", "water"]],
  ["Sightseeing", "Beach", ["sand", "sea", "sun", "swim", "water"]],
  ["Sightseeing", "Stadium", ["football", "game", "fans", "team", "seats"]],
  ["Sightseeing", "Fashion Week", ["clothes", "models", "Milan", "show", "designer"]],
  // Food & drink
  ["Food & drink", "Cappuccino", ["coffee", "milk", "Italy", "breakfast", "foam"]],
  ["Food & drink", "Gelato", ["ice cream", "Italy", "cold", "flavour", "cone"]],
  ["Food & drink", "Pizza", ["Italy", "cheese", "tomato", "slice", "Naples"]],
  ["Food & drink", "Tapas", ["Spain", "small", "plates", "bar", "share"]],
  ["Food & drink", "Menu", ["restaurant", "food", "order", "list", "waiter"]],
  ["Food & drink", "Waiter", ["restaurant", "food", "serve", "order", "tip"]],
  ["Food & drink", "Bill", ["restaurant", "pay", "money", "waiter", "total"]],
  ["Food & drink", "Vegetarian", ["meat", "eat", "vegetables", "animals", "food"]],
  ["Food & drink", "Wine", ["red", "white", "grape", "glass", "bottle"]],
  ["Food & drink", "Breakfast", ["morning", "eat", "coffee", "meal", "first"]],
  ["Food & drink", "Hangover", ["drink", "alcohol", "head", "morning", "party"]],
  // Health & clinic
  ["Health & clinic", "Dentist", ["teeth", "mouth", "doctor", "clinic", "chair"]],
  ["Health & clinic", "Toothache", ["pain", "hurt", "mouth", "dentist", "sweets"]],
  ["Health & clinic", "Pharmacy", ["medicine", "buy", "drugs", "prescription", "shop"]],
  ["Health & clinic", "Painkiller", ["medicine", "head", "pill", "hurt", "pharmacy"]],
  ["Health & clinic", "Sunburn", ["red", "skin", "beach", "hot", "cream"]],
  ["Health & clinic", "Sunscreen", ["skin", "beach", "cream", "protect", "summer"]],
  ["Health & clinic", "Blister", ["foot", "shoes", "walk", "skin", "hurt"]],
  ["Health & clinic", "Allergy", ["react", "food", "sneeze", "medicine", "body"]],
  ["Health & clinic", "Braces", ["teeth", "metal", "straight", "dentist", "smile"]],
  ["Health & clinic", "Anaesthetic", ["pain", "injection", "sleep", "surgery", "feel"]],
  ["Health & clinic", "Implant", ["tooth", "screw", "bone", "dentist", "false"]],
  ["Health & clinic", "Floss", ["teeth", "clean", "string", "between", "dentist"]],
  ["Health & clinic", "Travel insurance", ["pay", "health", "company", "accident", "cover"]],
  // Work & tech
  ["Work & tech", "Bug", ["error", "software", "program", "fix", "problem"]],
  ["Work & tech", "Deadline", ["date", "finish", "time", "project", "late"]],
  ["Work & tech", "Meeting", ["people", "talk", "work", "room", "call"]],
  ["Work & tech", "Customer", ["client", "buy", "pay", "company", "service"]],
  ["Work & tech", "Complaint", ["angry", "problem", "customer", "unhappy", "service"]],
  ["Work & tech", "Password", ["secret", "login", "account", "letters", "type"]],
  ["Work & tech", "Update", ["new", "version", "phone", "install", "app"]],
  ["Work & tech", "Screenshot", ["picture", "phone", "photo", "save", "image"]],
  ["Work & tech", "Wi-Fi", ["internet", "connection", "password", "network", "signal"]],
  ["Work & tech", "Feedback", ["opinion", "comment", "review", "good", "bad"]],
  ["Work & tech", "Working from home", ["house", "office", "computer", "remote", "company"]],
  ["Work & tech", "Boss", ["manager", "work", "company", "job", "team"]],
  // Sports & free time
  ["Sports & free time", "Padel", ["tennis", "racket", "ball", "court", "wall"]],
  ["Sports & free time", "Volleyball", ["net", "beach", "hit", "team", "jump"]],
  ["Sports & free time", "Basketball", ["hoop", "NBA", "jump", "team", "court"]],
  ["Sports & free time", "Yoga", ["stretch", "breathe", "mat", "exercise", "relax"]],
  ["Sports & free time", "Gym", ["exercise", "weights", "work out", "muscles", "train"]],
  ["Sports & free time", "Video game", ["play", "console", "computer", "screen", "controller"]],
  ["Sports & free time", "Board game", ["table", "dice", "play", "cards", "friends"]],
  ["Sports & free time", "Karaoke", ["sing", "song", "microphone", "bar", "music"]],
  ["Sports & free time", "Guitar", ["strings", "play", "music", "instrument", "song"]],
  // Everyday life
  ["Everyday life", "Birthday", ["cake", "party", "age", "candles", "year"]],
  ["Everyday life", "Wedding", ["marry", "bride", "church", "ring", "party"]],
  ["Everyday life", "Neighbour", ["next door", "house", "live", "street", "apartment"]],
  ["Everyday life", "Umbrella", ["rain", "wet", "open", "carry", "weather"]],
  ["Everyday life", "Alarm clock", ["wake up", "morning", "sleep", "ring", "time"]],
  ["Everyday life", "Hairdresser", ["hair", "cut", "salon", "style", "scissors"]],
  ["Everyday life", "Siesta", ["sleep", "afternoon", "Spain", "nap", "rest"]],
];

/** Every module with cards, in curriculum order. */
export const WORD_MODULES: WordModule[] = [
  {
    id: "book-one",
    name: "Book One",
    // Named as in Book One Crossings, so the two games read the same unit list.
    units: [
      { id: "u1", name: "Unit One · Who I am", cards: cards(BOOK_ONE_U1) },
      { id: "u2", name: "Unit Two · You and me", cards: cards(BOOK_ONE_U2) },
      { id: "u3", name: "Unit Three · What happened", cards: cards(BOOK_ONE_U3) },
      { id: "u4", name: "Unit Four · What's next", cards: cards(BOOK_ONE_U4) },
    ],
  },
  { id: "eurotrip", name: "Eurotrip", cards: cards(EUROTRIP) },
];

/** Where a deck is: a module, and its unit when it has units. */
export type DeckRef = { module: string; unit: string | null };

/** A stable id for a deck, to keep each deck's "sent" marks apart. */
export function deckId(ref: DeckRef): string {
  return ref.unit ? `${ref.module}/${ref.unit}` : ref.module;
}

export function findModule(id: string): WordModule | undefined {
  return WORD_MODULES.find((m) => m.id === id);
}

/** The cards for a module (and unit), or none for a stale reference. */
export function deckCards(ref: DeckRef): WordCard[] {
  const module = findModule(ref.module);
  if (!module) return [];
  if (module.cards) return module.cards;
  return module.units.find((u) => u.id === ref.unit)?.cards ?? [];
}

/** Where to land when a module is picked: its own cards, or its first unit. */
export function firstDeck(module: WordModule): DeckRef {
  return { module: module.id, unit: module.units ? module.units[0].id : null };
}
