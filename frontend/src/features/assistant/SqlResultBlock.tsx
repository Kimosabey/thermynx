import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { SqlResult } from "./useNyxConversation";

export interface SqlResultBlockProps {
  sql?: SqlResult | null;
}

/** Renders a /nl-query result: the SQL + a row table. */
export default function SqlResultBlock({ sql }: SqlResultBlockProps) {
  if (!sql) return null;
  const cols = sql.columns || (sql.rows?.[0] ? Object.keys(sql.rows[0]) : []);
  const rows = (sql.rows || []).slice(0, 50);
  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center gap-2">
        <Database size={14} strokeWidth={2} />
        <span className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">Generated SQL</span>
        <Badge variant="secondary" className="text-[9px]">
          {sql.row_count ?? rows.length} rows
        </Badge>
      </div>
      <pre className="mb-3 overflow-x-auto rounded-[10px] border border-border-subtle bg-elevated p-3 font-mono text-xs text-cyan">
        {sql.sql}
      </pre>
      {(sql.warnings || []).map((w, i) => (
        <p key={i} className="mb-1 text-[11px] text-warn">
          <span className="sr-only">Warning: </span>
          <span aria-hidden="true">⚠</span> {w}
        </p>
      ))}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-[10px] border border-border-subtle">
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c) => (
                  <TableHead key={c} className="text-[10px] text-ink-muted">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {cols.map((c) => (
                    <TableCell
                      key={c}
                      className="max-w-[260px] overflow-hidden text-xs tabular-nums text-ellipsis whitespace-nowrap"
                      title={String(r[c])}
                    >
                      {String(r[c])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {rows.length === 0 && <p className="text-xs text-ink-muted">Query returned no rows.</p>}
      {sql.row_count != null && sql.row_count > rows.length && (
        <p className="mt-2 text-xs text-ink-muted">
          Showing first {rows.length} of {sql.row_count} rows
        </p>
      )}
    </div>
  );
}
