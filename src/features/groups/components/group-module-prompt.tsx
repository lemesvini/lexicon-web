import * as React from "react";
import { CheckIcon, FolderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GroupCard,
  GroupCardBody,
} from "@/features/groups/components/group-card";
import { setGroupModule, type GroupRow } from "@/features/groups/data/groups";
import {
  setCurrentModule,
  type ModuleOption,
} from "@/features/students/data/students";

/**
 * The way out of a group that is in no module and whose students are in none
 * either — the state a group is in the day it is made.
 *
 * It only appears then. A module set on the group, or a student already placed
 * in one, and this is gone: from that point the module is the studio's to move,
 * where the lessons it copies are, and a second control on the same fact is how
 * the two end up disagreeing.
 *
 * Picking one writes it in both places. The group is what the studio plans
 * from; the student's own module is what their side of the app reads, and a
 * group placed without its students leaves everyone on the roster looking
 * unplaced. `setCurrentModule` opens each student's history row as it goes,
 * which is the same thing placing them one at a time from the roster does.
 *
 * Nothing is copied here — assigning a module never copies its lessons on its
 * own (see the studio's plan card), and this is only the pointer.
 */
export function GroupModulePrompt({
  group,
  modules,
  /** Ids of the students on this group's roster — who gets placed. */
  studentIds,
  busy,
  /** The page's write runner: reloads and reports failures in one place. */
  run,
}: {
  group: GroupRow;
  modules: ModuleOption[];
  studentIds: string[];
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [chosen, setChosen] = React.useState<string | null>(null);

  const choice = modules.find((module) => module.id === chosen);

  const place = (moduleId: string) =>
    run(async () => {
      await setGroupModule(group.id, moduleId);
      // In series rather than all at once: each one reads the student's current
      // module before it writes the history row, and a roster is a handful of
      // rows — there is nothing here worth racing for.
      for (const studentId of studentIds) {
        await setCurrentModule(studentId, moduleId);
      }
    });

  return (
    <GroupCard title="Module">
      <GroupCardBody className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FolderIcon className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">No module set</p>
            <p className="text-sm text-muted-foreground">
              {studentIds.length > 0
                ? `Pick one and ${group.name}${
                    studentIds.length === 1
                      ? "’s student moves"
                      : `’s ${studentIds.length} students move`
                  } into it too.`
                : "Pick the module this group is working through."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={busy}>
              <Button variant="outline" size="sm">
                {choice ? choice.name : "Choose a module"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-80 w-64 overflow-y-auto"
            >
              {modules.length === 0 ? (
                <DropdownMenuItem disabled>No modules yet</DropdownMenuItem>
              ) : (
                modules.map((module) => (
                  <DropdownMenuItem
                    key={module.id}
                    onSelect={() => setChosen(module.id)}
                  >
                    {module.id === chosen && <CheckIcon />}
                    <span className="truncate">{module.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* The press is separate from the pick because this writes a row per
              student and opens a history entry for each — not something to do
              on the way past a menu. */}
          <Button
            size="sm"
            disabled={busy || !chosen}
            onClick={() => chosen && void place(chosen)}
          >
            {studentIds.length > 0 ? "Set and place students" : "Set module"}
          </Button>
        </div>
      </GroupCardBody>
    </GroupCard>
  );
}
