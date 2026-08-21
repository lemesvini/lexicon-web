import type { SVGProps } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, isStaff } from "@/lib/profile";

/** The header's height, and so how much of the viewport the hero has to give
 *  back to sit exactly one screen tall. */
const HEADER_H = "4rem";

/**
 * The school's WhatsApp, as a click-to-chat link.
 *
 * `wa.me` is WhatsApp's own shortener, and the reason there is one href rather
 * than two: on a phone it hands off to the installed app, on a desktop it opens
 * web.whatsapp.com. The number is digits only — country, area, then the line —
 * which is the only format it accepts; a `+` or a space and the link dies.
 *
 * The greeting is prefilled into the composer, not sent, so the visitor still
 * chooses to press send. It saves them opening on a blank thread wondering what
 * to say, which is where these links usually lose people.
 */
const WHATSAPP_NUMBER = "5549999984639";
const WHATSAPP_GREETING =
  "Olá! Gostaria de saber mais sobre as aulas da Lexicon.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_GREETING,
)}`;

/**
 * The public front door — the only page in the app a stranger can reach, and so
 * the only one written for someone who has never heard of Lexicon.
 *
 * Everything else lives under `_authenticated`. This route deliberately does
 * not, which is why it carries the inverse of that guard: a signed-in visitor is
 * sent on to their own app rather than shown the pitch. That makes this the one
 * place that decides where "home" is for each role, so `/login` can keep
 * redirecting to `/` and let this route sort it out.
 */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    // Two throws rather than a ternary on `to`: the router types each
    // destination against its own route, and a union defeats that.
    if (isStaff(await getCurrentProfile())) throw redirect({ to: "/lessons" });
    throw redirect({ to: "/learn" });
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* A wash of the brand green behind the whole page rather than inside the
          hero — anchored to the top of the header, it reads as one field of
          colour. Clipped to the hero it showed its own edge along the header.
          Decorative, so it is hidden from the reader that doesn't see it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[75vh] bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,var(--color-accent),transparent_70%)]"
      />

      <LandingHeader />
      <Hero />
    </div>
  );
}

function LandingHeader() {
  return (
    // Transparent, unlike the app's own header: there is one screen of content
    // here, so nothing ever scrolls under it that a frosted panel would need to
    // hold back — and a panel would cut a line across the wash behind it.
    <header
      className="flex w-full items-center"
      style={{ height: HEADER_H }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          // The app's wordmark, spelled out rather than imported from the
          // sidebar — that module pulls in the whole nav machinery, and this is
          // the one page a stranger waits on.
          className="font-display text-3xl leading-none text-primary sm:text-4xl"
        >
          lexicon
        </Link>

        <Button asChild size="lg">
          <Link to="/login" search={{ redirect: undefined }}>
            Log in
          </Link>
        </Button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <main
      className="flex w-full items-center justify-center px-4 py-16 sm:px-6"
      style={{ minHeight: `calc(100dvh - ${HEADER_H})` }}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <h1 className="text-balance font-display text-5xl leading-[1.05] text-foreground sm:text-6xl lg:text-7xl">
          Descubra a liberdade de ser <span className="text-primary">bilíngue</span>
        </h1>

        <p className="mt-6 max-w-2xl font-montserrat text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
Somos uma escola de inglês que oferece aulas personalizadas com foco em conversação e resultado prático com o Can Do Syllabus, nosso material didático exclusivo.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          {/* A plain anchor rather than a router Link: this leaves the app
              entirely. New tab so the visitor still has the page to come back
              to once the chat is open. */}
          <Button asChild size="lg" className="h-12 px-8 text-base rounded-full bg-primary/20 border border-primary text-primary hover:bg-primary/30">
            <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
              Entre em contato
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}

/**
 * WhatsApp's mark. Inline because lucide dropped brand icons, and without it the
 * button says "get in touch" without saying how — which is the whole appeal of
 * this particular one.
 *
 * No explicit size: the button's own `[&_svg]` rule sizes any icon that doesn't
 * bring one, so this matches every other icon in the app for free.
 */
function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}
