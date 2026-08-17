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
import { TempPasswordPanel } from "@/components/temp-password-panel";
import { createTeacher } from "@/features/teachers/data/teachers";

const schema = z.object({
  fullName: z.string().trim().min(1, "Enter the teacher’s name."),
  email: z.email("Enter a valid email."),
});

type FormValues = z.infer<typeof schema>;

/**
 * Adds a teacher and creates their account in one step, then hands back the
 * temporary password to pass on. The same two-faced dialog as the student one,
 * for the same reason: once the account exists there is no going back to the
 * form.
 */
export function AddTeacherDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [created, setCreated] = React.useState<
    { email: string; password: string } | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "" },
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
      const { tempPassword } = await createTeacher({
        fullName: values.fullName,
        email: values.email,
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
          Add teacher
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Teacher added" : "Add a teacher"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Their account is ready."
              : "They get the same app you do, minus this page, and see only the students they add themselves."}
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
                      <Input placeholder="Ana Costa" {...field} />
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
                        placeholder="ana@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
