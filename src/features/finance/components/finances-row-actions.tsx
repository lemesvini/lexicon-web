import { BanknoteIcon, HistoryIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FinanceRow } from "@/features/finance/data/finance";

/** What a row's menu can ask the page to open. The dialogs live on the page, not
 *  here: one of each serves every row, and a dialog rendered inside a menu item
 *  is unmounted the moment the menu closes. */
export type FinanceRowHandlers = {
  onRecordPayment: (student: FinanceRow) => void;
  onShowHistory: (student: FinanceRow) => void;
  onEditBilling: (student: FinanceRow) => void;
};

/** Per-row actions: record a payment, see the history, edit billing details. */
export function FinancesRowActions({
  student,
  handlers,
}: {
  student: FinanceRow;
  handlers: FinanceRowHandlers;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontalIcon />
          <span className="sr-only">Actions for {student.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handlers.onRecordPayment(student)}>
          <BanknoteIcon />
          Record payment
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlers.onShowHistory(student)}>
          <HistoryIcon />
          Payment history
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handlers.onEditBilling(student)}>
          <PencilIcon />
          Billing details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
