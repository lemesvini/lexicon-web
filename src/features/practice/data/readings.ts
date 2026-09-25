/**
 * The reading library: short texts with comprehension questions, sorted by
 * CEFR level, the way lingua.com lays its reading practice out.
 *
 * Static for now. A text is a thing the school writes once and every student
 * reads, so a file in the repo is the right shelf until someone needs to add
 * one without a deploy. Titles and texts are English — that is the exercise.
 * The blurbs are Portuguese, because the student picks a text before reading
 * it, and the pick should not itself be the test.
 *
 * `answer` is a 0-based index into `options`, same convention as the homework
 * blocks in `@/lib/lessons`.
 */

export type Level = "A1" | "A2" | "B1" | "B2";

export const LEVELS: readonly Level[] = ["A1", "A2", "B1", "B2"];

export const LEVEL_LABEL: Record<Level, string> = {
  A1: "Iniciante",
  A2: "Básico",
  B1: "Intermediário",
  B2: "Intermediário avançado",
};

export type ReadingQuestion = {
  prompt: string;
  options: readonly string[];
  answer: number;
};

export type Reading = {
  /** Stable — it is in the URL and keys the saved score. */
  id: string;
  level: Level;
  title: string;
  /** One Portuguese line under the title on the list. */
  blurb: string;
  /** One string per paragraph. */
  paragraphs: readonly string[];
  questions: readonly ReadingQuestion[];
};

export const READINGS: readonly Reading[] = [
  // ── A1 ────────────────────────────────────────────────────────────────
  {
    id: "my-morning",
    level: "A1",
    title: "My Morning",
    blurb: "Uma rotina simples de manhã, no presente.",
    paragraphs: [
      "My name is Lucas. I wake up at seven o'clock every day. First, I drink a glass of water. Then I take a shower and get dressed.",
      "For breakfast, I eat bread with cheese and I drink coffee with milk. I don't like tea. My sister, Ana, eats fruit and drinks orange juice.",
      "At eight o'clock I leave the house. I walk to the bus stop and take the bus to work. The bus is often full, but I don't mind. I listen to music and look out the window.",
    ],
    questions: [
      {
        prompt: "What time does Lucas wake up?",
        options: ["At six o'clock", "At seven o'clock", "At eight o'clock", "At nine o'clock"],
        answer: 1,
      },
      {
        prompt: "What does Lucas drink for breakfast?",
        options: ["Tea", "Orange juice", "Coffee with milk", "Water"],
        answer: 2,
      },
      {
        prompt: "What does Ana eat for breakfast?",
        options: ["Bread with cheese", "Fruit", "Eggs", "Nothing"],
        answer: 1,
      },
      {
        prompt: "How does Lucas go to work?",
        options: ["By car", "By bike", "On foot", "By bus"],
        answer: 3,
      },
      {
        prompt: "What does Lucas do on the bus?",
        options: ["He sleeps", "He reads a book", "He listens to music", "He talks to his sister"],
        answer: 2,
      },
    ],
  },
  {
    id: "our-apartment",
    level: "A1",
    title: "Our Apartment",
    blurb: "Uma família descreve onde mora.",
    paragraphs: [
      "We live in a small apartment in the city. It is on the third floor. There is no elevator, so we use the stairs.",
      "The apartment has two bedrooms, a kitchen, a bathroom and a living room. My bedroom is small, but it has a big window. I can see the park from my bed.",
      "The kitchen is my mother's favourite room. She cooks dinner there every evening. My father's favourite room is the living room, because the TV is there. My favourite room is my bedroom.",
    ],
    questions: [
      {
        prompt: "Where is the apartment?",
        options: ["In a village", "In the city", "Near the beach", "On a farm"],
        answer: 1,
      },
      {
        prompt: "Which floor is the apartment on?",
        options: ["The first", "The second", "The third", "The fourth"],
        answer: 2,
      },
      {
        prompt: "How many bedrooms are there?",
        options: ["One", "Two", "Three", "Four"],
        answer: 1,
      },
      {
        prompt: "What can the writer see from the bedroom?",
        options: ["The sea", "The street", "The park", "The school"],
        answer: 2,
      },
      {
        prompt: "Why is the living room the father's favourite room?",
        options: ["It is big", "The TV is there", "It has a window", "He cooks there"],
        answer: 1,
      },
    ],
  },

  // ── A2 ────────────────────────────────────────────────────────────────
  {
    id: "a-day-at-the-market",
    level: "A2",
    title: "A Day at the Market",
    blurb: "Compras no mercado de sábado, com passado simples.",
    paragraphs: [
      "Last Saturday, Maria went to the market with her grandmother. They left early, at half past seven, because the best fruit is gone by nine.",
      "First they bought vegetables: tomatoes, onions and a big pumpkin. Then they stopped at the fish stall. Maria's grandmother knows the fisherman, so he gave them a good price.",
      "On the way home, Maria carried the heavy bags and her grandmother carried the flowers. They were tired, but happy. At home, they cooked lunch together and ate on the balcony in the sun.",
    ],
    questions: [
      {
        prompt: "Why did they leave early?",
        options: [
          "The market closes at nine",
          "The best fruit sells out early",
          "The bus leaves at half past seven",
          "Her grandmother wakes up early",
        ],
        answer: 1,
      },
      {
        prompt: "What did they buy first?",
        options: ["Fish", "Flowers", "Vegetables", "Bread"],
        answer: 2,
      },
      {
        prompt: "Why did the fisherman give them a good price?",
        options: [
          "The fish was old",
          "They bought a lot",
          "It was late in the day",
          "He knows Maria's grandmother",
        ],
        answer: 3,
      },
      {
        prompt: "Who carried the flowers?",
        options: ["Maria", "Her grandmother", "The fisherman", "Nobody"],
        answer: 1,
      },
      {
        prompt: "Where did they eat lunch?",
        options: ["At the market", "In the kitchen", "On the balcony", "At a restaurant"],
        answer: 2,
      },
    ],
  },
  {
    id: "the-new-job",
    level: "A2",
    title: "The New Job",
    blurb: "Primeira semana num emprego novo.",
    paragraphs: [
      "Pedro started a new job last week. He works at a small bookshop near the train station. He used to work in a supermarket, but he didn't like it very much because it was too noisy.",
      "The bookshop is quiet and smells of paper and coffee. His boss, Mrs. Silva, is friendly but very organised. On his first day, she showed him how to find any book in less than a minute.",
      "Pedro's favourite part of the job is talking to customers. Yesterday, an old man asked him for a book about trains, and they talked for twenty minutes. Pedro thinks he is going to like it here.",
    ],
    questions: [
      {
        prompt: "Where does Pedro work now?",
        options: ["In a supermarket", "At the train station", "In a bookshop", "In a café"],
        answer: 2,
      },
      {
        prompt: "Why didn't Pedro like his old job?",
        options: ["It was too far", "It was too noisy", "The boss was unfriendly", "The pay was low"],
        answer: 1,
      },
      {
        prompt: "What did Mrs. Silva teach Pedro on his first day?",
        options: [
          "How to make coffee",
          "How to use the till",
          "How to find any book quickly",
          "How to talk to customers",
        ],
        answer: 2,
      },
      {
        prompt: "What is Pedro's favourite part of the job?",
        options: ["The quiet", "The coffee", "Talking to customers", "Reading books"],
        answer: 2,
      },
      {
        prompt: "What did the old man want?",
        options: ["A book about trains", "A train ticket", "A cup of coffee", "Directions to the station"],
        answer: 0,
      },
    ],
  },

  // ── B1 ────────────────────────────────────────────────────────────────
  {
    id: "a-trip-that-went-wrong",
    level: "B1",
    title: "A Trip That Went Wrong",
    blurb: "Uma viagem de fim de semana com contratempos.",
    paragraphs: [
      "When Carla and her friends planned a weekend by the lake, everything seemed simple. They booked a cabin online, rented a car and packed enough food for three days. What they didn't check was the weather forecast.",
      "It started raining before they had even left the city. By the time they reached the lake, the road to the cabin had turned into mud, and the car got stuck. They spent an hour pushing it out while the rain poured down.",
      "The cabin, when they finally got there, was smaller than the photos suggested, and the heating didn't work. Still, nobody complained for long. They lit the fireplace, played cards until midnight and laughed about the whole thing. On Sunday the sun came out, and the lake looked exactly like the pictures.",
      "\"Next time,\" Carla said on the drive home, \"we check the forecast.\" But she was already planning the next trip.",
    ],
    questions: [
      {
        prompt: "What did the friends forget to do before leaving?",
        options: ["Book the cabin", "Rent a car", "Check the weather forecast", "Pack food"],
        answer: 2,
      },
      {
        prompt: "Why did the car get stuck?",
        options: [
          "It ran out of petrol",
          "The road had turned to mud",
          "They took a wrong turn",
          "A tree had fallen on the road",
        ],
        answer: 1,
      },
      {
        prompt: "What was wrong with the cabin?",
        options: [
          "It was too far from the lake",
          "It was dirty",
          "It was smaller than expected and cold",
          "Someone else was staying there",
        ],
        answer: 2,
      },
      {
        prompt: "How did the group react to the problems?",
        options: [
          "They went home immediately",
          "They argued all night",
          "They made the best of it",
          "They called the owner to complain",
        ],
        answer: 2,
      },
      {
        prompt: "What does the last paragraph suggest about Carla?",
        options: [
          "She never wants to travel again",
          "She blames her friends",
          "She has already forgotten the trip",
          "She enjoyed the trip despite everything",
        ],
        answer: 3,
      },
    ],
  },
  {
    id: "the-neighbourhood-garden",
    level: "B1",
    title: "The Neighbourhood Garden",
    blurb: "Como um terreno vazio virou uma horta comunitária.",
    paragraphs: [
      "For years, the empty lot at the end of Rua das Flores was nothing but weeds and broken bricks. Children were told to stay away from it, and most adults simply stopped noticing it was there.",
      "That changed when Dona Rosa, a retired teacher, put a hand-written note on the lamp post: \"Anyone want to grow tomatoes? Saturday, 8 a.m. Bring gloves.\" Six people came. Two of them had never planted anything in their lives.",
      "Three years later, the lot has forty small plots, a shared tool shed and a bench where the older residents sit in the afternoon. The vegetables are only part of it. Neighbours who used to nod at each other in the street now know each other's names, argue about the best way to grow beans, and look after each other's plots during holidays.",
      "\"I thought I was starting a garden,\" Dona Rosa says. \"It turns out I was starting a neighbourhood.\"",
    ],
    questions: [
      {
        prompt: "What was the lot like before the garden?",
        options: [
          "A car park",
          "A playground for children",
          "Abandoned and full of weeds",
          "A small farm",
        ],
        answer: 2,
      },
      {
        prompt: "How did Dona Rosa invite people to the first meeting?",
        options: [
          "With a note on a lamp post",
          "By knocking on doors",
          "Through a social media post",
          "With a letter from the council",
        ],
        answer: 0,
      },
      {
        prompt: "How many people came on the first Saturday?",
        options: ["Two", "Six", "Forty", "Three"],
        answer: 1,
      },
      {
        prompt: "According to the text, what is the most important result of the garden?",
        options: [
          "Cheaper vegetables",
          "A place for children to play",
          "Stronger relationships between neighbours",
          "A new tool shed",
        ],
        answer: 2,
      },
      {
        prompt: "What does Dona Rosa mean by \"I was starting a neighbourhood\"?",
        options: [
          "She built new houses on the lot",
          "The garden brought people together",
          "She moved to a new street",
          "The council named the street after her",
        ],
        answer: 1,
      },
    ],
  },

  // ── B2 ────────────────────────────────────────────────────────────────
  {
    id: "the-four-day-week",
    level: "B2",
    title: "The Four-Day Week",
    blurb: "Uma empresa testa a semana de quatro dias — e o que aconteceu.",
    paragraphs: [
      "When a mid-sized software company in Lisbon announced it would trial a four-day working week, the reaction inside the building was not the celebration management had expected. Several senior engineers worried that the same amount of work would simply be squeezed into fewer, longer days. The finance team asked, reasonably, who would answer clients on Fridays.",
      "The six-month trial went ahead anyway, with one rule that turned out to matter more than any other: nothing about salaries or targets would change. Employees would be paid the same and expected to deliver the same. The only thing that shrank was the number of meetings, which the company cut by roughly half after an internal survey found that most of them could have been an email.",
      "The results were less dramatic than either the optimists or the sceptics had predicted. Productivity, measured by completed projects, was flat — neither up nor down. Sick days fell by a fifth. Staff turnover, which had been a persistent problem, dropped to almost zero during the trial period. Client satisfaction dipped slightly in the first month and then recovered once a rota was introduced for Friday support.",
      "The company has since made the change permanent, though its CEO is careful not to oversell it. \"It didn't make us faster,\" she told a local newspaper. \"It made people want to stay. For us, that was the point.\"",
    ],
    questions: [
      {
        prompt: "How did employees initially react to the announcement?",
        options: [
          "With enthusiasm",
          "With indifference",
          "With concern about workload and client coverage",
          "By threatening to resign",
        ],
        answer: 2,
      },
      {
        prompt: "Which rule does the text describe as the most important?",
        options: [
          "Fridays would be for meetings only",
          "Pay and targets would stay the same",
          "Everyone would work longer days",
          "Clients would be told in advance",
        ],
        answer: 1,
      },
      {
        prompt: "What happened to the number of meetings?",
        options: [
          "It roughly doubled",
          "It stayed the same",
          "It was cut by about half",
          "Meetings were banned entirely",
        ],
        answer: 2,
      },
      {
        prompt: "What effect did the trial have on productivity?",
        options: [
          "It rose sharply",
          "It fell by a fifth",
          "It stayed roughly the same",
          "It was not measured",
        ],
        answer: 2,
      },
      {
        prompt: "What does the CEO consider the main benefit of the change?",
        options: [
          "Faster delivery",
          "Employee retention",
          "Lower costs",
          "Better client satisfaction",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "the-art-of-doing-nothing",
    level: "B2",
    title: "The Art of Doing Nothing",
    blurb: "Um ensaio sobre tédio, atenção e por que descansar é difícil.",
    paragraphs: [
      "There was a time, not long ago, when waiting was simply part of life. You waited for the bus, for the kettle, for a friend who was running late, and in those gaps you did nothing in particular. You looked around. You thought about things. Occasionally, you were bored.",
      "Today those gaps have all but disappeared. The moment a queue forms or a conversation pauses, a hand reaches for a phone, and the empty minute is filled. Boredom, once an unremarkable feature of the day, has become something close to unbearable — a discomfort to be treated instantly rather than endured.",
      "Psychologists have begun to argue that this is a loss, not a gain. Boredom, they suggest, is the mind's way of signalling that it wants to wander, and wandering is where a surprising amount of creative and reflective thinking happens. Studies have found that people who are given a dull task before a problem-solving exercise tend to produce more original ideas than those who were kept busy. The idle mind, it seems, is not idle at all.",
      "None of this means we should throw away our phones. But it may be worth treating the next empty minute as something other than a problem — and seeing what turns up when nothing is asked of us.",
    ],
    questions: [
      {
        prompt: "According to the first paragraph, what was waiting like in the past?",
        options: [
          "Stressful and frustrating",
          "An ordinary part of life",
          "Something people avoided",
          "A time to make phone calls",
        ],
        answer: 1,
      },
      {
        prompt: "What does the writer say happens to empty minutes today?",
        options: [
          "They are longer than before",
          "They are spent thinking",
          "They are filled with phone use",
          "They no longer exist at all",
        ],
        answer: 2,
      },
      {
        prompt: "What do psychologists suggest boredom does?",
        options: [
          "It reduces creativity",
          "It signals that the mind wants to wander",
          "It causes anxiety in most people",
          "It should be treated as quickly as possible",
        ],
        answer: 1,
      },
      {
        prompt: "What did the studies mentioned in the text find?",
        options: [
          "Busy people solve problems faster",
          "Dull tasks make people tired",
          "People who were bored first had more original ideas",
          "Phones improve concentration",
        ],
        answer: 2,
      },
      {
        prompt: "What is the writer's final suggestion?",
        options: [
          "Get rid of your phone",
          "Avoid boring tasks",
          "Stop treating empty moments as a problem",
          "Take longer breaks at work",
        ],
        answer: 2,
      },
    ],
  },
];

export function findReading(id: string): Reading | undefined {
  return READINGS.find((reading) => reading.id === id);
}

/** The text after this one in the library, in list order — or nothing at the
 *  end of the shelf. */
export function nextReading(id: string): Reading | undefined {
  const index = READINGS.findIndex((reading) => reading.id === id);
  return index === -1 ? undefined : READINGS[index + 1];
}
