import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  createModule,
  renameModule,
  setModulePosition,
  type ModuleRow,
} from "@/features/modules/data/modules";

// `position` stays a string through the form and is parsed on submit: a coerced
// number field types its value as `unknown`, which the Input can't accept.
const schema = z.object({
  name: z.string().trim().min(1, "A module needs a name."),
  position: z.string().trim().regex(/^\d+$/, "Use a whole number."),
});

type FormValues = z.infer<typeof schema>;

/**
 * Creates a module, or edits an existing one's name and order.
 *
 * Renaming goes through an RPC because it also has to re-tag every lesson in the
 * module — a rename that only touched `modules.name` would leave that module's
 * students seeing an empty library.
 */
export function ModuleDialog({
  module,
  open,
  onOpenChange,
  onSaved,
}: {
  /** The module being edited, or undefined to create a new one. */
  module?: ModuleRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? "Edit module" : "New module"}</DialogTitle>
          <DialogDescription>
            {module
              ? "Renaming re-tags every lesson in this module."
              : "Modules are what a student’s access is pinned to."}
          </DialogDescription>
        </DialogHeader>

        {/* The form lives in here so that closing and reopening the dialog
            starts from the saved values — Radix unmounts the dialog's content,
            which resets the form without an effect to do it. */}
        <ModuleForm
          module={module}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function ModuleForm({
  module,
  onClose,
  onSaved,
}: {
  module?: ModuleRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: module?.name ?? "",
      position: String(module?.position ?? 0),
    },
  });

  const onSubmit = async (values: FormValues) => {
    const name = values.name.trim();
    const position = Number(values.position);

    setError(null);
    try {
      if (!module) {
        await createModule(name, position);
      } else {
        if (name !== module.name) await renameModule(module.id, name);
        if (position !== module.position) {
          await setModulePosition(module.id, position);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const nameValue = useWatch({ control: form.control, name: "name" });
  const renaming = module && nameValue.trim() !== module.name;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Module One" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} />
              </FormControl>
              <FormDescription>
                Lowest first, wherever modules are listed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {renaming && module.lessonCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {module.lessonCount} lesson{module.lessonCount === 1 ? "" : "s"}{" "}
            will be re-tagged, and {module.studentCount} student
            {module.studentCount === 1 ? "" : "s"} keep their access.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
