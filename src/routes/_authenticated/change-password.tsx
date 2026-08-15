import { type FormEvent, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, mustChangePassword } from "@/lib/profile";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePasswordPage,
});

const MIN_LENGTH = 8;

/**
 * Sets a new password. Sits outside both role layouts because both kinds of
 * user land here: a student arrives forced, right after an admin handed them a
 * temporary password, and anyone can come here from the menu to change theirs.
 */
function ChangePasswordPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const forced = mustChangePassword(session?.user);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password"));
    const confirmation = String(formData.get("confirmation"));

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords don’t match.");
      return;
    }

    setIsSubmitting(true);

    // Clearing the flag is part of the same write: leaving it set would bounce
    // the user straight back here on the next navigation.
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });

    if (updateError) {
      setIsSubmitting(false);
      setError(updateError.message);
      return;
    }

    const profile = await getCurrentProfile().catch(() => null);
    setIsSubmitting(false);
    navigate({ to: profile?.role === "admin" ? "/" : "/learn" });
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl">lexicon</CardTitle>
          <CardDescription>
            {forced
              ? "Choose a password to finish setting up your account."
              : "Choose a new password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmation">Confirm password</Label>
              <Input
                id="confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
