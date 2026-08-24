import {
  ClipboardCheckIcon,
  MailIcon,
  PhoneIcon,
  UserCogIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { StudentAvatarUpload } from "@/components/student-avatar";
import { setStudentAvatar } from "@/lib/avatars";
import { StudentRowActions } from "@/features/students/components/student-row-actions";
import { Tile } from "@/features/students/components/student-tiles";
import {
  formatDate,
  formatSince,
} from "@/features/students/components/student-formats";
import type { StudentProfile } from "@/features/students/data/student-profile";
import {
  NO_MODULE,
  NO_TEACHER,
  type ModuleOption,
  type StudentRow,
  type TeacherOption,
} from "@/features/students/data/students";

/** One line of the contact block. Truncates rather than wraps — an address long
 *  enough to wrap would push the roster line out of a tile sized for it. */
function Detail({
  icon: Icon,
  children,
}: {
  icon: typeof MailIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/**
 * Who this is: the first tile in the gallery rather than a banner above it.
 *
 * The roster's row actions travel with it — change their module, hand them to
 * another teacher, issue a password — because this is where you end up when
 * you go looking at a student, and sending you back to a table to act on what
 * you just read is a round trip with no purpose.
 */
export function StudentProfileCard({
  student,
  /** ISO timestamp of the last thing they did — see `StudentSummary.lastActivity`. */
  lastActivity,
  isAdmin,
  modules,
  teachers,
  onChanged,
  span,
}: {
  student: StudentProfile;
  lastActivity: string;
  isAdmin: boolean;
  modules: ModuleOption[];
  teachers: TeacherOption[];
  onChanged: () => void;
  span: string;
}) {
  // `StudentRowActions` is written against a roster row, so the profile is
  // narrowed back to one rather than the menu being rewritten. The placeholders
  // are the roster's own — they are what its dialogs expect to see.
  const asRow: StudentRow = {
    id: student.id,
    userId: student.userId,
    name: student.name,
    email: student.email,
    phone: student.phone,
    status: student.status,
    moduleId: student.moduleId,
    module: student.module || NO_MODULE,
    teacherId: student.teacherId,
    teacher: student.teacher || NO_TEACHER,
    createdAt: student.createdAt,
  };

  return (
    <Tile span={span} className="gap-4">
      <div className="flex items-start gap-4">
        <StudentAvatarUpload
          studentId={student.id}
          name={student.name}
          path={student.avatarPath}
          size="md"
          // Staff write the roster row directly; the student's own copy of this
          // control on /profile goes through `set_own_avatar` instead.
          onSave={async (next) => {
            await setStudentAvatar(student.id, next);
            onChanged();
          }}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-pretty text-2xl font-semibold leading-tight tracking-tight">
            {student.name || "Unnamed student"}
          </h1>

          {(student.status === "inactive" || student.module) && (
            <div className="flex flex-wrap gap-1.5">
              {student.status === "inactive" && (
                <Badge variant="secondary">Inactive</Badge>
              )}
              {student.module && <Badge variant="outline">{student.module}</Badge>}
            </div>
          )}
        </div>

        {/* `-m` cancels the trigger's own padding so the glyph, not its hit
            area, lines up with the tile's edge. */}
        <div className="-mr-2 -mt-1 shrink-0">
          <StudentRowActions
            student={asRow}
            modules={modules}
            teachers={isAdmin ? teachers : []}
            onChanged={onChanged}
          />
        </div>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        {student.email && (
          <Detail icon={MailIcon}>
            <a
              href={`mailto:${student.email}`}
              className="hover:text-foreground hover:underline"
            >
              {student.email}
            </a>
          </Detail>
        )}
        {student.phone && <Detail icon={PhoneIcon}>{student.phone}</Detail>}
        {student.teacher && <Detail icon={UserCogIcon}>{student.teacher}</Detail>}
        <Detail icon={ClipboardCheckIcon}>
          {lastActivity
            ? `Last seen ${formatSince(lastActivity)}`
            : "Nothing recorded yet"}
        </Detail>
      </div>

      {/* Pushed to the foot of the tile: it is the least urgent thing here, and
          the tile is stretched to two rows of the grid, so something has to
          take up the slack. */}
      <p className="mt-auto pt-2 text-xs text-muted-foreground">
        On the roster since {formatDate(student.createdAt)}
        {!student.userId && " · no sign-in account yet"}
      </p>
    </Tile>
  );
}
