import { daysLeft, sortRows, type TenderRow } from "./pipeline";
import type { ExcelOptions, ExcelColumn } from "../settings";
import { DEFAULT_EXCEL_COLUMNS } from "../settings";

export type { ExcelColumn };
export const DEFAULT_COLUMNS: ExcelColumn[] = DEFAULT_EXCEL_COLUMNS;

function xmlEsc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cellXml(text: string, opts?: { href?: string; number?: boolean; style?: string }): string {
  const style = opts?.style ? ` ss:StyleID="${opts.style}"` : "";
  if (opts?.href) return `<Cell${style} ss:HRef="${xmlEsc(opts.href)}"><Data ss:Type="String">${xmlEsc(text || "Open")}</Data></Cell>`;
  if (opts?.number && text !== "" && Number.isFinite(Number(text)))
    return `<Cell${style}><Data ss:Type="Number">${Number(text)}</Data></Cell>`;
  return `<Cell${style}><Data ss:Type="String">${xmlEsc(text)}</Data></Cell>`;
}

function sheetXml(name: string, rows: TenderRow[], cols: ExcelColumn[], highlightDays: number): string {
  const widths = cols.map((c, i) => `<Column ss:Index="${i + 1}" ss:Width="${Math.min(80, Math.max(16, c.label.length + 6)) * 5.5}" ss:AutoFitWidth="0"/>`).join("");
  const head = `<Row ss:StyleID="Header">${cols.map((c) => cellXml(c.label, { style: "Header" })).join("")}</Row>`;
  const body = rows.map((t) => {
    const hot = t.days !== "" && t.days >= 0 && t.days <= highlightDays;
    const style = hot ? "Hot" : undefined;
    const cells = cols.map((c) => {
      if (c.field === "link" && t.link) return cellXml("Open", { href: t.link, style });
      if (c.field === "days") return cellXml(String(t.days ?? ""), { number: t.days !== "", style });
      return cellXml(String((t as Record<string, unknown>)[c.field] ?? ""), { style });
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");
  return `<Worksheet ss:Name="${xmlEsc(name.slice(0, 28))}"><Table>${widths}${head}${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
}

/** Workbook with a "Todays Tenders" sheet and "Earlier Tenders" sheet(s), same columns. */
export function buildWorkbook(today: TenderRow[], earlier: TenderRow[], opts: ExcelOptions, cols?: ExcelColumn[]) {
  const active = (cols && cols.length ? cols : DEFAULT_COLUMNS).filter((c) => c.on);
  if (!active.length) throw new Error("Enable at least one column on the Excel file tab.");
  const hi = Number.isFinite(+opts.highlightDays) ? +opts.highlightDays : 14;
  const tSorted = sortRows(today.slice(), opts.sort);
  const eSorted = sortRows(earlier.slice(), opts.sort);

  const sheets: string[] = [];
  const used = new Set<string>();
  const pushSheet = (name: string, rows: TenderRow[]) => {
    let n = name, i = 2;
    while (used.has(n.toLowerCase())) n = `${name.slice(0, 24)} ${i++}`;
    used.add(n.toLowerCase());
    sheets.push(sheetXml(n, rows, active, hi));
  };

  pushSheet("Todays Tenders", tSorted);
  if (opts.splitByPortal) {
    const groups = new Map<string, TenderRow[]>();
    for (const t of eSorted) {
      const k = t.source || "Other";
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    for (const [k, list] of groups) pushSheet(k, list);
  } else {
    pushSheet("Earlier Tenders", eSorted);
  }

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/><Interior ss:Color="#046A38" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="Hot"><Interior ss:Color="#FFF2B3" ss:Pattern="Solid"/><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
 </Styles>
 ${sheets.join("\n")}
</Workbook>`;
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return { xml, filename: `${opts.prefix || "EnerScope_Digest"}_${stamp}.xls` };
}

export function resolveColumns(opts: ExcelOptions): ExcelColumn[] {
  return opts.columns && opts.columns.length ? opts.columns : DEFAULT_COLUMNS;
}

export function withDays(rows: TenderRow[]): TenderRow[] {
  const now = new Date();
  return rows.map((t) => ({ ...t, days: daysLeft(t.deadline, now) }));
}
