import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TempPasswordPanel } from "@/components/temp-password-panel";
import {
  createStudent,
  type ModuleOption,
  type TeacherOption,
} from "@/features/students/data/students";

// Radix's Select has no concept of an empty value, so "no module yet" needs a
// sentinel of its own.
const NO_MODULE_VALUE = "none";

const schema = z.object({
  fullName: z.string().trim().min(1, "Enter the student’s name."),
  email: z.email("Enter a valid email."),
  phone: z.string().trim().optional(),
  currentModuleId: z.string().optional(),
  teacherId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Adds a student to the roster and creates their account in one step, then
 * hands back the temporary password to pass on.
 *
 * The dialog has two faces: the form, and — once the account exists — the
 * password panel. It deliberately can't go back to the form, because the
 * student has already been created by then.
 */
export function AddStudentDialog({
  modules,
  teachers,
  currentTeacherId,
  onCreated,
}: {
  modules: ModuleOption[];
  /**
   * Who the student can belong to. One entry (or none) for a teacher — they can
   * only add to their own roster, so the field isn't shown at all. See
   * `listTeacherOptions`.
   */
  teachers: TeacherOption[];
  /** The signed-in user, who the picker starts on. */
  currentTeacherId: string;
  /** Called after a successful create, so the roster can reload. */
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [created, setCreated] = React.useState<
    { email: string; password: string } | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  const canPickTeacher = teachers.length > 1;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      currentModuleId: NO_MODULE_VALUE,
      teacherId: currentTeacherId,
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    // Reset on close rather than on open, so the password isn't left sitting in
    // memory (or flashing back up) after the dialog is dismissed.
    if (created) onCreated();
    setCreated(null);
    setError(null);
    form.reset();
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const { tempPassword } = await createStudent({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || undefined,
        currentModuleId:
          values.currentModuleId && values.currentModuleId !== NO_MODULE_VALUE
            ? values.currentModuleId
            : null,
        // Only ever read for an admin — the function ignores it otherwise and
        // files the student under whoever is calling.
        teacherId: canPickTeacher ? values.teacherId || null : null,
      });
      setCreated({ email: values.email, password: tempPassword });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          Add student
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {created ? "Student added" : "Add a student"}
          </DialogTitle>
          <DialogDescription>
            {created
              ? "Their account is ready."
              : "Creates their account and a temporary password. No email is sent."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="mt-4 space-y-4">
            <TempPasswordPanel email={created.email} password={created.password} />
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-4 space-y-4"
            >
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Maria Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="off"
                        placeholder="maria@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentModuleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current module</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pick a module" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_MODULE_VALUE}>
                          No module yet
                        </SelectItem>
                        {modules.map((module) => (
                          <SelectItem key={module.id} value={module.id}>
                            {module.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {canPickTeacher && (
                <FormField
                  control={form.control}
                  name="teacherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teacher</FormLabel>
                      <Select
                        value={field.value || currentTeacherId}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pick a teacher" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Creating…" : "Create account"}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
