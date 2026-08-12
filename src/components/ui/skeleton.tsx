import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse [animation-duration:500ms] rounded-md bg-secondary/30",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
