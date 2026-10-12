import { useAuth } from "@/hooks/use-auth";
import type { LinkTo } from "@/lib/nav";
import { isStaff } from "@/lib/profile";

/**
 * Which app this reader is in, and so what "home" means: /lessons for staff,
 * /learn for a student.
 *
 * Unknown for the moment before the profile lands — staff is the harmless
 * guess, and `isLoading` is there for anyone who needs to wait until it is sure.
 */
export function useHome(): { home: LinkTo; isLoading: boolean } {
  const { profile, isLoading } = useAuth();
  const home: LinkTo = profile && !isStaff(profile) ? "/learn" : "/lessons";
  return { home, isLoading };
}
