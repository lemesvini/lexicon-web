/**
 * The onboarding form, as data.
 *
 * One step per screen, in order. Keeping the questions here rather than inside
 * the stepper means the summary written into the student's context and the
 * screen the student answered are built from the same strings — a question can
 * never be reworded in one place and not the other.
 */

export type OnboardingStep =
  | { id: string; kind: "intro"; title: string; body: string[] }
  | {
      id: string;
      kind: "text";
      title: string;
      /** The question as it appears in the student's context. */
      question: string;
      hint?: string;
      placeholder: string;
    }
  | {
      id: string;
      kind: "chips";
      title: string;
      question: string;
      hint?: string;
      options: string[];
    };

/** Answers keyed by step id. Text steps hold a string, chip steps a list. */
export type OnboardingAnswers = {
  motivation: string;
  interests: string[];
  routine: string;
};

export const EMPTY_ANSWERS: OnboardingAnswers = {
  motivation: "",
  interests: [],
  routine: "",
};

/**
 * Em português: é a primeira coisa que o aluno vê no app, muitas vezes antes de
 * ter inglês para responder com confiança. Perguntar na língua dele é o que faz
 * a resposta vir completa — e a resposta é o material da aula.
 */

/** Lista deliberadamente ampla — a ideia é que todo mundo ache vários. */
const INTERESTS = [
  "Viagens",
  "Música",
  "Filmes",
  "Séries",
  "Futebol",
  "Esportes",
  "Academia",
  "Corrida",
  "Yoga",
  "Dança",
  "Cozinhar",
  "Comida e restaurantes",
  "Café",
  "Livros",
  "Games",
  "Jogos de tabuleiro",
  "Anime",
  "Tecnologia",
  "Inteligência artificial",
  "Negócios",
  "Marketing",
  "Finanças e investimentos",
  "Empreendedorismo",
  "Mudança de carreira",
  "Intercâmbio",
  "Faculdade",
  "Ciência",
  "História",
  "Política",
  "Arte",
  "Fotografia",
  "Moda",
  "Design",
  "Carros",
  "Motos",
  "Natureza e trilhas",
  "Praia",
  "Pets",
  "Família",
  "Filhos",
  "Saúde",
  "Meditação",
  "Religião",
  "Voluntariado",
  "Podcasts",
  "Redes sociais",
  "Idiomas",
];

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "intro",
    kind: "intro",
    title: "Boas-vindas! Vamos preparar suas aulas",
    body: [
      "Antes de começar, queremos te conhecer um pouco.",
      "São três perguntas rápidas — por que você está aprendendo inglês, do que você gosta e como são os seus dias. Seu professor usa as respostas para escolher os temas, textos e exemplos das aulas, para que elas falem de coisas que fazem sentido para você.",
      "Leva uns dois minutos, e você só responde uma vez.",
    ],
  },
  {
    id: "motivation",
    kind: "text",
    title: "Seu objetivo",
    question: "O que te motiva a estudar inglês?",
    hint: "Viagens, trabalho, estudos, família, morar fora… o que for verdade para você.",
    placeholder: "Eu quero…",
  },
  {
    id: "interests",
    kind: "chips",
    title: "Seus interesses",
    question: "Interesses",
    hint: "Escolha quantos quiser — e adicione os seus no final.",
    options: INTERESTS,
  },
  {
    id: "routine",
    kind: "text",
    title: "Sua rotina",
    question: "Como é uma semana normal para você?",
    hint: "Trabalho, estudos, exercícios, quando sobra tempo para praticar.",
    placeholder: "Eu trabalho com… / Eu estudo… / Normalmente eu…",
  },
];
