import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shows a freshly issued temporary password, once.
 *
 * Nothing stores it in readable form, so this panel is the only chance to get it
 * across to the student — which is why it says so, and why copying is one click.
 */
export function TempPasswordPanel({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(`${email}\n${password}`);
    setCopied(true);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-md border bg-muted/40 p-3">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="break-all font-mono text-sm">{email}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Temporary password</p>
          <p className="break-all font-mono text-sm">{password}</p>
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy email and password"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Send these to the student. This password won’t be shown again — if it’s
        lost, generate a new one from the roster. They’ll be asked to choose
        their own password the first time they sign in.
      </p>
    </div>
  );
}
