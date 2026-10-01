import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import { cn } from "@/lib/utils";

/** cmdk needs a non-empty, unique value for the "no lesson" row. */
const NONE_VALUE = "__none__";

/** Splits `"[Lesson One] Nice to meet you!"` into its label and headline. */
function splitTitle(title: string): { label: string; headline: string } {
  const match = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(title);
  if (!match) return { label: "", headline: title };
  return { label: match[1].trim(), headline: match[2].trim() };
}

/**
 * A searchable lesson picker: a Popover holding a cmdk Command list.
 *
 * Used wherever a lesson is chosen, because the curriculum is long and several
 * modules reuse identical titles — so search matches title, unit and module,
 * every option is keyed by lesson id (never by title), and the module is shown
 * as the group heading. `module` narrows the list to one module's lessons (a
 * group can only be doing its own module's), falling back to every lesson when
 * that module has none so the picker is never empty. `children`, when given,
 * replaces the default select-like trigger.
 */
export function LessonCombobox({
  lessons,
  value,
  onChange,
  module,
  allowNone = false,
  noneLabel = "No lesson",
  placeholder = "Pick a lesson",
  disabled,
  className,
  align = "start",
  children,
}: {
  lessons: CloudLessonSummary[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Only list this module's lessons, when it has any. */
  module?: string;
  /** Adds a first row that clears the choice. */
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
  /** A custom trigger, rendered via `asChild` in place of the default button. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const visible = React.useMemo(() => {
    if (!module) return lessons;
    const inModule = lessons.filter((lesson) => lesson.module === module);
    return inModule.length > 0 ? inModule : lessons;
  }, [lessons, module]);

  // Lessons arrive in curriculum order, so groups keep first-seen order.
  const groups = React.useMemo(() => {
    const byModule = new Map<string, CloudLessonSummary[]>();
    for (const lesson of visible) {
      const key = lesson.module ?? "";
      const list = byModule.get(key);
      if (list) list.push(lesson);
      else byModule.set(key, [lesson]);
    }
    return [...byModule.entries()];
  }, [visible]);

  const selected = lessons.find((lesson) => lesson.id === value) ?? null;
  const showHeadings = groups.length > 1;

  const pick = (id: string | null) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children ?? (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-transparent px-3 font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">
              {selected ? selected.title || selected.id : placeholder}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent align={align} className="w-[max(18rem,var(--radix-popover-trigger-width))] p-0">
        <Command>
          <CommandInput placeholder="Search lessons…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No lessons found.</CommandEmpty>

            {allowNone && (
              <>
                <CommandGroup>
                  <CommandItem
                    value={NONE_VALUE}
                    keywords={[noneLabel]}
                    onSelect={() => pick(null)}
                  >
                    <CheckIcon
                      className={cn("size-4", value ? "opacity-0" : "opacity-100")}
                    />
                    {noneLabel}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groups.map(([moduleName, items]) => (
              <CommandGroup
                key={moduleName}
                heading={showHeadings ? moduleName || "No module" : undefined}
              >
                {items.map((lesson) => {
                  const { label, headline } = splitTitle(lesson.title);
                  const main = headline || label || lesson.title || lesson.id;
                  const secondary = [headline ? label : "", lesson.unit]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <CommandItem
                      key={lesson.id}
                      // The id keeps duplicate titles from colliding; the rest
                      // is what the search matches against.
                      value={lesson.id}
                      keywords={[
                        lesson.title,
                        lesson.unit,
                        lesson.module,
                      ].filter((k): k is string => Boolean(k))}
                      onSelect={() => pick(lesson.id)}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4 shrink-0",
                          lesson.id === value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{main}</span>
                        {(secondary || (!showHeadings && lesson.module)) && (
                          <span className="truncate text-xs text-muted-foreground">
                            {[secondary, showHeadings ? "" : lesson.module]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
