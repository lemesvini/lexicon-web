import {
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  MotionConfig,
  motion,
  stagger,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, isStaff } from "@/lib/profile";
import { AdvancedContextAnim } from "@/features/homepage/components/advanced-context-anim";

const WHATSAPP_NUMBER = "5549999984639";
const CTA_GREETING = "Olá! Quero agendar o nivelamento da Lexicon.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  CTA_GREETING,
)}`;
const INSTAGRAM_HREF = "https://www.instagram.com/lexicon_en/";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    // Two throws rather than a ternary on `to`: the router types each
    // destination against its own route, and a union defeats that.
    if (isStaff(await getCurrentProfile())) throw redirect({ to: "/lessons" });
    throw redirect({ to: "/learn" });
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

// The landing page is always light: it pins the palette primitives (and the
// semantic tokens it reads) so a `.dark` ancestor can't repaint it.
const MIST_100 = "oklch(0.9584 0.0093 62.5849)";

const palette = {
  "--mist-100": MIST_100,
  "--mist-50": "oklch(0.9818 0.0060 62.5849)",
  "--sand-76": "oklch(0.7621 0.0156 98.3528)",
  "--forest-800": "oklch(0.3004 0.0440 168.9151)",
  "--forest-900": "oklch(0.1841 0.0101 172.8800)",
  "--jade-400": "#61B495",
  "--jade-600": "oklch(0.4761 0.0752 167.6137)",
  "--border": "oklch(0.8847 0.0100 90.0000)",
  "--muted-foreground": "oklch(0.5100 0.0300 169.0000)",
} as CSSProperties;

// In-page link that glides to its section. It has to go through the router:
// TanStack patches history.replaceState, so a hand-rolled smooth scroll gets
// cut short by the router's own instant hash scroll. Scoped here rather than
// `scroll-behavior: smooth` on <html>, which would reach the whole app.
// Re-clicking a link whose hash is already in the URL is a same-URL
// navigation the router won't scroll for, so that case scrolls by hand —
// safe there, since the URL doesn't change and the router stays out of it.
function AnchorLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollOptions: ScrollIntoViewOptions = {
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  };

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (window.location.hash !== `#${to}`) return;
    e.preventDefault();
    document.getElementById(to)?.scrollIntoView(scrollOptions);
  };

  return (
    <Link
      to="/"
      hash={to}
      replace
      hashScrollIntoView={scrollOptions}
      onClick={onClick}
      className={className}
    >
      {children}
    </Link>
  );
}

// The logo glides back to the hero. It stays out of the router: the page is
// already "/", and a navigation would jump to the top instead of gliding.
function scrollToTop(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

const pillPrimary =
  "rounded-full bg-secondary font-medium text-white transition-opacity hover:opacity-75";

// The overscroll bounce shows the canvas (html/body) background, not ours —
// under the app's dark theme that's a black strip above the header. Paint the
// canvas with the page colour while the landing is mounted, then hand it back.
function useLightCanvas() {
  useEffect(() => {
    const targets = [document.documentElement, document.body];
    const previous = targets.map((el) => ({
      background: el.style.backgroundColor,
      scheme: el.style.colorScheme,
    }));
    for (const el of targets) {
      el.style.backgroundColor = MIST_100;
      el.style.colorScheme = "light";
    }
    return () => {
      targets.forEach((el, i) => {
        el.style.backgroundColor = previous[i].background;
        el.style.colorScheme = previous[i].scheme;
      });
    };
  }, []);
}

// Apple-style entrance: a short rise out of a faint blur on a long ease-out.
// `reducedMotion="user"` on the page's MotionConfig drops the transforms for
// people who ask for less motion, leaving only the fade.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const rise: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(3px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: EASE_OUT },
  },
};

// Parent for a run of `rise` children that reveal one after the other.
const cascade = (gap = 0.1, delay = 0): Variants => ({
  hidden: {},
  shown: { transition: { delayChildren: stagger(gap, { startDelay: delay }) } },
});

// Reveals once, when a fifth of it is on screen. Children using the same
// variant names inherit the trigger, so a cascade needs only one of these.
function Reveal({
  variants = rise,
  className,
  children,
}: {
  variants?: Variants;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function LandingPage() {
  useLightCanvas();

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={palette}
        className="min-h-dvh bg-(--mist-100) font-montserrat text-(--forest-900) antialiased"
      >
        <Header />
        <main>
          <Hero />
          <HowItWorks />
          <AdvancedContext />
          <Modalities />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
      className="sticky top-0 z-10 border-b border-(--border) bg-[oklch(0.9584_0.0093_62.58/85%)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-6 px-6 py-3.5">
        <a
          href="/"
          onClick={scrollToTop}
          aria-label="Lexicon English School — voltar ao início"
          className="flex flex-col items-center gap-0.5 text-(--forest-800) hover:opacity-75"
        >
          <span className="font-display text-2xl leading-none text-primary">lexicon</span>
          <span className="text-[8px] font-semibold text-primary font-montserrat tracking-[0.2em]">
            English School
          </span>
        </a>
        <nav className="flex flex-wrap items-center gap-7 text-sm">
          <AnchorLink to="metodo" className="max-sm:hidden hover:opacity-75">
            Método
          </AnchorLink>
          <AnchorLink to="modalidades" className="max-sm:hidden hover:opacity-75">
            Modalidades
          </AnchorLink>
          <AnchorLink to="contato" className={`${pillPrimary} px-[18px] py-[9px]`}>
            Agendar nivelamento
          </AnchorLink>
        </nav>
      </div>
    </motion.header>
  );
}

const HERO_LEAD = "Descubra a liberdade de ser";

function Hero() {
  return (
    <motion.section
      variants={cascade(0.07, 0.15)}
      initial="hidden"
      animate="shown"
      className="flex flex-col items-center overflow-hidden px-6 pt-[88px] pb-24 text-center"
    >
      {/* <img src="/flags.png" alt="Bandeiras do Brasil e dos Estados Unidos" className="w-[140px] drop-shadow-[0_2px_4px_rgb(20_50_40/25%)]" /> */}
      <h1 className="mt-[18px] max-w-[920px] font-display text-[clamp(44px,7vw,88px)] leading-none font-thin tracking-[-0.01em] text-balance text-secondary">
        {HERO_LEAD.split(" ").map((word) => (
          <motion.span key={word} variants={rise} className="inline-block">
            {word}&nbsp;
          </motion.span>
        ))}
        <BilingualWord />
      </h1>
      <motion.p
        variants={rise}
        className="mt-[22px] max-w-[620px] text-[clamp(18px,2vw,22px)] leading-[1.45] text-pretty text-(--forest-800)"
      >
        Do básico ao avançado, aulas de inglês <b className="font-normal">personalizadas</b>{" "}
        com base no <b className="font-semibold">seu contexto</b>.
      </motion.p>
      <motion.div
        variants={rise}
        className="mt-8 flex flex-wrap items-center justify-center gap-7"
      >
        <AnchorLink to="contato" className={`${pillPrimary} px-[30px] py-[15px] text-base`}>
          Agende seu nivelamento sem custo
        </AnchorLink>
        <AnchorLink to="metodo" className="text-base text-(--jade-600) hover:opacity-75">
          Como funciona ›
        </AnchorLink>
      </motion.div>

      <HeroPhoto />
    </motion.section>
  );
}

const BILINGUAL = "bilíngue";

// The hero's key word: once the lead-in has landed, its letters spring up
// one by one out of a blur, then a hand-drawn stroke writes itself beneath.
// Screen readers get the plain word; the split letters are presentation only.
function BilingualWord() {
  const letters: Variants = {
    hidden: {},
    shown: { transition: { delayChildren: stagger(0.06, { startDelay: 0.55 }) } },
  };
  const letter: Variants = {
    hidden: { opacity: 0, y: "0.45em", rotate: -8, filter: "blur(4px)" },
    shown: {
      opacity: 1,
      y: 0,
      rotate: 0,
      filter: "blur(0px)",
      transition: { type: "spring", stiffness: 260, damping: 18 },
    },
  };
  const stroke: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    shown: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { delay: 1.35, duration: 0.9, ease: EASE_OUT },
        opacity: { delay: 1.35, duration: 0.01 },
      },
    },
  };

  return (
    <motion.span
      variants={letters}
      aria-label={BILINGUAL}
      className="relative inline-block whitespace-nowrap font-display text-primary"
    >
      {Array.from(BILINGUAL).map((char, i) => (
        <motion.span
          key={i}
          aria-hidden
          variants={letter}
          className="inline-block origin-bottom"
        >
          {char}
        </motion.span>
      ))}
      <svg
        viewBox="0 0 300 14"
        preserveAspectRatio="none"
        aria-hidden
        className="pointer-events-none absolute -bottom-[0.26em] left-[2%] h-[0.2em] w-[96%] overflow-visible text-(--jade-400)"
      >
        <motion.path
          d="M4 10 C 70 3, 150 3, 204 6 S 280 11, 296 5"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          variants={stroke}
        />
      </svg>
    </motion.span>
  );
}

const tagPop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  shown: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 20 },
  },
};

// The photo settles from slightly shrunk to full size as it scrolls into
// place, then its tags pop in around it. It reveals on its own view trigger,
// not with the hero: on load the photo sits below the fold and the top tag
// would otherwise pop in alone at the bottom edge. The scale is on the whole
// block so the tags stay pinned to the photo while it grows.
function HeroPhoto() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.88, 1]);

  return (
    <motion.div
      ref={ref}
      variants={cascade(0.08, 0.3)}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.3 }}
      style={{ scale }}
      className="relative mt-24 w-full max-w-[960px] sm:mt-32"
    >
      <motion.img
        variants={rise}
        src="/girl.jpg"
        alt="Aluna sorrindo durante uma aula de inglês online no notebook"
        width={1550}
        height={1044}
        fetchPriority="high"
        className="aspect-[4/3] w-full object-[center_45%] sm:aspect-[2/1] rounded-[clamp(24px,4vw,44px)] object-cover shadow-[0_30px_60px_-20px_rgb(20_50_40/35%)]"
      />
      <img
        src="/new-light.svg"
        alt=""
        aria-hidden
        className="absolute top-[clamp(20px,3.5vw,40px)] left-[clamp(20px,3.5vw,40px)] h-[clamp(48px,8vw,88px)] w-auto"
      />
      <FloatingTag className="top-0 left-[64%] -translate-y-1/2">
        conversação
      </FloatingTag>
      <FloatingTag className="top-[40%] right-0 translate-x-[clamp(8px,4vw,48px)]">
        personalizado
      </FloatingTag>
      <FloatingTag className="top-[58%] left-0 -translate-x-[clamp(8px,4vw,48px)]">
        individual
      </FloatingTag>
      <FloatingTag className="bottom-0 left-[22%] translate-y-1/2">
        grupos
      </FloatingTag>
      <FloatingTag className="right-[10%] bottom-0 translate-y-1/2">
        in-company
      </FloatingTag>
    </motion.div>
  );
}

function FloatingTag({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={tagPop}
      className={`absolute rounded-full bg-white px-[clamp(16px,3vw,36px)] py-[clamp(8px,1.4vw,16px)] text-[clamp(15px,2.2vw,28px)] tracking-[0.02em] text-(--jade-600) shadow-[0_8px_20px_rgb(0_0_0/8%)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

const steps = [
  {
    title: "Nivelamento sem custo",
    body: "Uma conversa para entender seu nível e o seu objetivo.",
  },
  {
    title: "Seu contexto vira material",
    body: "Objetivos, interesses e rotina se tornam os tópicos e exemplos das aulas.",
  },
  {
    title: "Conversação desde o início",
    body: "Você fala sobre o que importa pra você, desde a primeira aula.",
  },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[15px] font-semibold text-(--jade-600)">{children}</div>;
}

const sectionTitle =
  "m-0 font-display text-[clamp(34px,4.5vw,56px)] leading-[1.05] font-normal text-secondary";

function HowItWorks() {
  return (
    <section id="metodo" className="scroll-mt-20 border-t border-(--border) px-6 py-24">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-14">
        <Reveal variants={cascade()} className="flex max-w-[720px] flex-col gap-3.5">
          <motion.div variants={rise}>
            <Eyebrow>Como funciona</Eyebrow>
          </motion.div>
          <motion.h2 variants={rise} className={`${sectionTitle} text-balance`}>
            O seu contexto é o ponto de partida
          </motion.h2>
        </Reveal>
        <Reveal
          variants={cascade(0.12)}
          className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-10"
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              variants={rise}
              className="flex flex-col gap-3 border-t-2 border-(--forest-900) pt-5"
            >
              <div className="font-display text-[28px] text-(--jade-400)">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="text-[21px] font-semibold">{step.title}</div>
              <div className="text-base leading-relaxed text-(--forest-800)">
                {step.body}
              </div>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function AdvancedContext() {
  return (
    <section className="bg-[oklch(0.27_0.035_168)] px-6 py-[104px] text-white">
      <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-center gap-16">
        <Reveal variants={cascade(0.12)} className="flex flex-col gap-[18px]">
          <motion.div variants={rise} className="text-[15px] font-semibold text-(--jade-400)">
            Advanced Context
          </motion.div>
          <motion.h2 variants={rise} className="m-0 text-[clamp(30px,3.6vw,44px)] leading-[1.15] font-light">
            material didático
            <br />
            <span className="font-display text-[1.35em] font-normal">
              personalizado
            </span>
            <br />
            <i>de verdade</i>
          </motion.h2>
          <motion.p variants={rise} className="mt-1.5 max-w-[440px] text-lg leading-relaxed text-[oklch(0.85_0.03_167)]">
            O Advanced Context coloca o exemplo certo na aula certa, em todos os
            módulos.
          </motion.p>
        </Reveal>
        <Reveal className="flex justify-center">
          <AdvancedContextAnim className="h-auto w-full max-w-[340px]" />
        </Reveal>
      </div>
    </section>
  );
}

const modalities = [
  {
    title: "Individual",
    body: "Aulas particulares no seu horário, com material montado para você.",
  },
  {
    title: "Em grupo",
    body: "Turmas pequenas com um objetivo em comum, como uma viagem.",
  },
  {
    title: "In-company",
    body: "Aulas para equipes, com foco no inglês que a empresa usa.",
  },
];

function Modalities() {
  return (
    <section id="modalidades" className="scroll-mt-20 px-6 py-24">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-12">
        <Reveal
          variants={cascade()}
          className="flex flex-col items-center gap-3.5 text-center"
        >
          <motion.div variants={rise}>
            <Eyebrow>Modalidades</Eyebrow>
          </motion.div>
          <motion.h2 variants={rise} className={sectionTitle}>
            Do seu jeito
          </motion.h2>
        </Reveal>
        <Reveal
          variants={cascade(0.12)}
          className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5"
        >
          {modalities.map((m) => (
            <motion.div
              key={m.title}
              variants={rise}
              className="flex flex-col gap-3 rounded-3xl bg-white p-8"
            >
              <div className="font-display text-[26px]">{m.title}</div>
              <div className="text-base leading-relaxed text-(--forest-800)">
                {m.body}
              </div>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="contato" className="scroll-mt-20 px-6 pt-6 pb-24">
      <Reveal
        variants={{
          hidden: { opacity: 0, scale: 0.96, y: 24 },
          shown: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
              duration: 1,
              ease: EASE_OUT,
              delayChildren: stagger(0.1, { startDelay: 0.2 }),
            },
          },
        }}
        className="mx-auto flex max-w-[1120px] flex-col items-center gap-[22px] rounded-[32px] bg-(--jade-400) px-6 py-[clamp(48px,7vw,88px)] text-center"
      >
        <motion.h2 variants={rise} className="text-foreground m-0 max-w-[760px] text-[clamp(34px,5vw,64px)] leading-[1.1] font-normal">
           Quer ser <span className="font-display">bilíngue</span>? Entre em contato! 
        </motion.h2>
        <motion.p variants={rise} className="m-0 text-lg text-secondary font-semibold">
          Agende seu nivelamento sem custo.
        </motion.p>
        <motion.div variants={rise} className="mt-2 flex flex-wrap justify-center gap-3.5">
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noreferrer"
            className={`${pillPrimary} inline-flex items-center gap-2.5 px-[30px] py-[15px] text-base`}
          >
            <WhatsAppIcon className="size-5" />
            Falar no WhatsApp
          </a>
          <a
            href={INSTAGRAM_HREF}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2.5 rounded-full bg-white px-[30px] py-[15px] text-base font-medium transition-opacity hover:opacity-75"
          >
            <InstagramIcon className="size-5" />
            Instagram @lexicon_en
          </a>
        </motion.div>
      </Reveal>
    </section>
  );
}

// lucide-react dropped brand icons, so the two marks are inlined.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// Both portals land on the same /login; the split is only for the visitor,
// who looks for "their" door.
const portalButton =
  "inline-flex items-center justify-between gap-3 rounded-full px-5 py-3 text-sm font-medium transition-opacity hover:opacity-80";

const footerHeading =
  "m-0 text-xs font-semibold tracking-[0.14em] text-(--jade-400) uppercase";

const footerLink = "text-white/70 transition-colors hover:text-white";

function Footer() {
  return (
    <footer className="bg-(--forest-900) px-6 pt-16 pb-8 text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="flex flex-col gap-5">
            <img src="/new-light.svg" alt="lexicon" className="h-14 w-auto self-start" />
            <p className="m-0 max-w-[280px] text-sm leading-relaxed text-white/70">
              Escola de inglês com aulas personalizadas e material didático adaptado para cada aluno.
            </p>
            <div className="flex gap-3">
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              >
                <WhatsAppIcon className="size-5" />
              </a>
              <a
                href={INSTAGRAM_HREF}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              >
                <InstagramIcon className="size-5" />
              </a>
            </div>
          </div>

          <nav aria-label="Escola" className="flex flex-col gap-4">
            <h3 className={footerHeading}>Escola</h3>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
              <li>
                <AnchorLink to="metodo" className={footerLink}>
                  Método
                </AnchorLink>
              </li>
              <li>
                <AnchorLink to="modalidades" className={footerLink}>
                  Modalidades
                </AnchorLink>
              </li>
              <li>
                <AnchorLink to="contato" className={footerLink}>
                  Agendar nivelamento
                </AnchorLink>
              </li>
            </ul>
          </nav>

          <div className="flex flex-col gap-4">
            <h3 className={footerHeading}>Contato</h3>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
              <li>
                <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer" className={footerLink}>
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={INSTAGRAM_HREF} target="_blank" rel="noreferrer" className={footerLink}>
                  @lexicon_en
                </a>
              </li>
              {/* <li className="text-white/70">Chapecó, SC</li> */}
            </ul>
          </div>

          <nav aria-label="Portais" className="flex flex-col gap-4">
            <h3 className={footerHeading}>Área restrita</h3>
            <Link
              to="/login"
              search={{}}
              className={`${portalButton} bg-(--jade-400) text-(--forest-900)`}
            >
              Portal do aluno
              <span aria-hidden>→</span>
            </Link>
            <Link
              to="/login"
              search={{}}
              className={`${portalButton} border border-white/25 text-white`}
            >
              Portal do professor
              <span aria-hidden>→</span>
            </Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-white/50">
          <span>
            © {new Date().getFullYear()} Lexicon English School. Todos os
            direitos reservados.
          </span>
          {/* <span>Chapecó, SC · Brasil</span> */}
        </div>
      </div>
    </footer>
  );
}
