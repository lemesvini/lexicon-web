import { PlusIcon, TableIcon, XIcon } from "lucide-react";
import type { TableBlock } from "@/lib/lessons";
import type { BlockDefinition } from "../types";
import { renderInline } from "../inline-md";
import { BlockLabel, BlockNote } from "../view-ui";
import { AutoTextarea } from "../editor-ui/auto-textarea";
import {
  AddRowButton,
  BlockLabelInput,
  DeleteRowButton,
  NoteInput,
} from "../editor-ui/primitives";

/** Row count is the longest column; shorter columns are padded on read. */
function rowCount(block: TableBlock): number {
  return block.columns.reduce((max, c) => Math.max(max, c.rows.length), 0);
}

function View({ block }: { block: TableBlock }) {
  const rows = rowCount(block);
  return (
    <section className="space-y-2">
      {block.label && <BlockLabel>{block.label}</BlockLabel>}
      <div className="overflow-x-auto rounded-xl border bg-card/40">
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              {block.columns.map((col, ci) => (
                <th
                  key={ci}
                  className="px-4 py-3 font-semibold tracking-tight text-foreground"
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, ri) => (
              <tr
                key={ri}
                className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/30"
              >
                {block.columns.map((col, ci) => (
                  <td
                    key={ci}
                    className="whitespace-pre-line px-4 py-3 align-top leading-relaxed"
                  >
                    {renderInline(col.rows[ri] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.note && <BlockNote text={block.note} />}
    </section>
  );
}

function Editor({
  block,
  onChange,
}: {
  block: TableBlock;
  onChange: (b: TableBlock) => void;
}) {
  const rows = rowCount(block);

  const setCell = (col: number, row: number, value: string) => {
    const columns = block.columns.map((c, ci) => {
      if (ci !== col) return c;
      const nextRows = c.rows.slice();
      while (nextRows.length <= row) nextRows.push("");
      nextRows[row] = value;
      return { ...c, rows: nextRows };
    });
    onChange({ ...block, columns });
  };

  const setColTitle = (col: number, title: string) =>
    onChange({
      ...block,
      columns: block.columns.map((c, ci) => (ci === col ? { ...c, title } : c)),
    });

  const addColumn = () =>
    onChange({
      ...block,
      columns: [
        ...block.columns,
        { title: "New column", rows: Array<string>(rows).fill("") },
      ],
    });

  const removeColumn = (col: number) =>
    onChange({
      ...block,
      columns: block.columns.filter((_, ci) => ci !== col),
    });

  const addRow = () =>
    onChange({
      ...block,
      columns: block.columns.map((c) => ({ ...c, rows: [...c.rows, ""] })),
    });

  const removeRow = (row: number) =>
    onChange({
      ...block,
      columns: block.columns.map((c) => ({
        ...c,
        rows: c.rows.filter((_, ri) => ri !== row),
      })),
    });

  return (
    <div className="space-y-2">
      <BlockLabelInput
        value={block.label ?? ""}
        onChange={(label) => onChange({ ...block, label })}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {block.columns.map((col, ci) => (
                <th key={ci} className="border-r p-0 align-top last:border-r-0">
                  <div className="flex items-start gap-1 p-2">
                    <input
                      value={col.title}
                      onChange={(e) => setColTitle(ci, e.target.value)}
                      placeholder="Column title"
                      className="w-full bg-transparent font-semibold outline-none placeholder:text-muted-foreground/60 focus:rounded-sm focus:ring-2 focus:ring-ring/30"
                    />
                    {block.columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(ci)}
                        aria-label="Remove column"
                        title="Remove column"
                        className="mt-0.5 shrink-0 rounded text-muted-foreground hover:text-destructive"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-10 p-1 align-middle">
                <button
                  type="button"
                  onClick={addColumn}
                  aria-label="Add column"
                  title="Add column"
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <PlusIcon className="size-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, ri) => (
              <tr key={ri} className="group/row border-b last:border-b-0">
                {block.columns.map((col, ci) => (
                  <td key={ci} className="border-r p-2 align-top last:border-r-0">
                    <AutoTextarea
                      value={col.rows[ri] ?? ""}
                      onValueChange={(v) => setCell(ci, ri, v)}
                      placeholder="…"
                      className="leading-relaxed"
                    />
                  </td>
                ))}
                <td className="p-1 text-center align-middle">
                  <span className="opacity-0 transition-opacity group-hover/row:opacity-100">
                    <DeleteRowButton onClick={() => removeRow(ri)} label="Remove row" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddRowButton onClick={addRow} label="Add row" />

      <NoteInput
        value={block.note ?? ""}
        onChange={(note) => onChange({ ...block, note })}
      />
    </div>
  );
}

export const tableBlock: BlockDefinition<TableBlock> = {
  meta: {
    type: "table",
    label: "Table",
    hint: "Columns of phrases",
    icon: TableIcon,
  },
  create: () => ({
    type: "table",
    label: "",
    columns: [
      { title: "Column A", rows: [""] },
      { title: "Column B", rows: [""] },
    ],
  }),
  View,
  Editor,
};
