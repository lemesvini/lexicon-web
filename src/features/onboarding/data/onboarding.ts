import { supabase } from "@/lib/supabase";

/**
 * Append the student's onboarding answers to their own context.
 *
 * Through an RPC because a student cannot write their `students` row directly —
 * see supabase/migrations/0012_student_onboarding.sql. The function is
 * once-only: calling it again throws rather than duplicating the block.
 */
export async function saveOnboarding(summary: string): Promise<void> {
  const { error } = await supabase.rpc("save_student_onboarding", { summary });
  if (error) throw new Error(error.message);
}
