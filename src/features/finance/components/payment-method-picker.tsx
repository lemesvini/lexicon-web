import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/features/finance/data/payments";

/**
 * The four ways a student pays, as a segmented group of buttons — there are
 * few enough that a dropdown would only hide them. A radio group semantically:
 * exactly one is chosen, and arrow keys are not worth reimplementing for four
 * options, so each is simply a button that reports `aria-checked`.
 */
export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Payment method"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {PAYMENT_METHODS.map((method) => {
        const selected = method.value === value;
        return (
          <button
            key={method.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(method.value)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-accent",
            )}
          >
            {method.label}
          </button>
        );
      })}
    </div>
  );
}
