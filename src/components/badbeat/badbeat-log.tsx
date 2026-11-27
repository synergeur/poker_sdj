"use client";

import {
  BarChart3,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Hash,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Spade,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";

import { SwitchButton } from "@/components/employees/switch-button";
import { TimeField } from "@/components/employees/time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBlob, type DownloadKind } from "@/lib/download";
import { badbeatPdf } from "@/lib/badbeat/pdf";
import { buildBadbeatReport, monthRange, reportCsv, reportXlsx, type BadbeatReportCopy } from "@/lib/badbeat/report";
import {
  badbeatInsights,
  badbeatPeriodRange,
  badbeatStats,
  badbeatTrend,
  orderBadbeat,
  priceBadbeat,
  type BadbeatSortKey,
  type BadbeatTrendPoint,
} from "@/lib/badbeat/stats";
import type { BadbeatError } from "@/lib/badbeat/validation";
import { cn } from "@/lib/utils";
import { deleteBadbeatEntryAction, saveBadbeatEntryAction } from "@/server/actions/badbeat";
import type { BadbeatRow } from "@/server/services/badbeat";

type Copy = {
  headline: string;
  subtitle: string;
  statsTitle: string;
  export: string;
  from: string;
  to: string;
  format: string;
  formatXlsx: string;
  formatCsv: string;
  formatPdf: string;
  download: string;
  invalidRange: string;
  summaryTitle: string;
  registerTitle: string;
  trendsTitle: string;
  summarySheet: string;
  registerSheet: string;
  trendsSheet: string;
  periodPrefix: string;
  asOf: string;
  exportWord: string;
  keyStats: string;
  contextTitle: string;
  bestDay: string;
  highestOn: string;
  busiestOn: string;
  window: string;
  addedToday: string;
  cumul: string;
  addedAmount: string;
  yes: string;
  no: string;
  trends: string;
  period: string;
  thisMonth: string;
  thisWeek: string;
  thisYear: string;
  allTime: string;
  previous: string;
  next: string;
  periodTotal: string;
  periodEntries: string;
  averageCustomers: string;
  add: string;
  edit: string;
  remove: string;
  confirmTitle: string;
  confirmBody: string;
  save: string;
  cancel: string;
  empty: string;
  date: string;
  time: string;
  customers: string;
  won: string;
  rule: string;
  amount: string;
  comment: string;
  hour: string;
  minute: string;
  editTitle: string;
  current: string;
  dayTotal: string;
  dayEntries: string;
  carryover: string;
  lastWon: string;
  highestDay: string;
  medianCustomers: string;
  busiestDay: string;
  averageDay: string;
  wins: string;
  none: string;
  errors: Record<BadbeatError, string>;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function nowDraft() {
  const now = new Date();
  const minute = Math.floor(now.getMinutes() / 5) * 5;
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(minute)}`,
    customers: "",
    comment: "",
  };
}

function formatDate(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function formatRange(start: string, end: string, locale: string) {
  const startLabel = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(utcDay(start));
  const endLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDay(end));
  return `${startLabel} – ${endLabel}`;
}

function formatShort(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(utcDay(date));
}

function utcDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function isoDay(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

type ListPeriod = "month" | "week" | "year";

function shiftAnchor(anchor: string, period: ListPeriod, direction: -1 | 1) {
  const date = utcDay(anchor);
  if (period === "week") date.setUTCDate(date.getUTCDate() + direction * 7);
  else if (period === "year") date.setUTCFullYear(date.getUTCFullYear() + direction, 0, 1);
  else date.setUTCMonth(date.getUTCMonth() + direction, 1);
  return isoDay(date);
}

function periodStarts(period: ListPeriod, firstDate: string | undefined, today: string) {
  const last = badbeatPeriodRange(period, today).start;
  const starts: string[] = [];
  let cursor = badbeatPeriodRange(period, firstDate && firstDate < today ? firstDate : today).start;
  while (cursor <= last && starts.length < 520) {
    starts.push(cursor);
    cursor = shiftAnchor(cursor, period, 1);
  }
  return starts.length > 0 ? starts : [last];
}

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function place(entries: BadbeatRow[], entry: BadbeatRow) {
  const previous = entries.find((item) => item.id === entry.id);
  const createdAt = entry.createdAt || previous?.createdAt || new Date().toISOString();
  return [...entries.filter((item) => item.id !== entry.id), { ...entry, createdAt }];
}

export function BadbeatLog({
  entries,
  canEnter,
  canSeeStats,
  locale,
  copy,
}: {
  entries: BadbeatRow[];
  canEnter: boolean;
  canSeeStats: boolean;
  locale: string;
  copy: Copy;
}) {
  const today = useMemo(() => nowDraft().date, []);
  const [rows, setRows] = useState(entries);
  const [editing, setEditing] = useState<BadbeatRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BadbeatRow | null>(null);
  const seed = useMemo(() => nowDraft(), []);
  const [date, setDate] = useState(seed.date);
  const [time, setTime] = useState(seed.time);
  const [customers, setCustomers] = useState("");
  const [won, setWon] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [period, setPeriod] = useState<ListPeriod>("month");
  const [anchor, setAnchor] = useState(today);
  const listRef = useRef<HTMLDivElement>(null);
  const litScroll = useRef<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportFormat, setExportFormat] = useState<DownloadKind>("pdf");
  const [chart, setChart] = useState<"amount" | "customers">("amount");
  const [litDate, setLitDate] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: BadbeatSortKey; direction: "asc" | "desc" }>({
    key: "date",
    direction: "desc",
  });
  const priced = useMemo(() => priceBadbeat(rows), [rows]);
  const firstDate = useMemo(() => rows.map((row) => row.date).sort()[0], [rows]);
  const range = useMemo(() => badbeatPeriodRange(period, anchor), [period, anchor]);
  const currentRange = useMemo(() => badbeatPeriodRange(period, today), [period, today]);
  const canNext = range.start < currentRange.start;
  const canPrev = firstDate ? badbeatPeriodRange(period, shiftAnchor(anchor, period, -1)).end >= firstDate : false;
  const periodRows = useMemo(
    () => rows.filter((row) => row.date >= range.start && row.date <= range.end),
    [rows, range],
  );
  const ordered = useMemo(
    () => orderBadbeat(priced.filter((entry) => entry.date >= range.start && entry.date <= range.end), sort.key, sort.direction, locale),
    [priced, range, sort, locale],
  );
  const stats = useMemo(() => badbeatStats(rows, today), [rows, today]);
  const insights = useMemo(() => badbeatInsights(periodRows), [periodRows]);
  const trend = useMemo(() => badbeatTrend(rows, range.start, range.end, today), [rows, range, today]);
  const periodCustomers = periodRows.reduce((sum, row) => sum + row.customers, 0);
  const periodTotal = trend.at(-1)?.amount ?? 0;
  const averageCustomers = periodRows.length === 0 ? null : Math.round(periodCustomers / periodRows.length);
  const periods = useMemo(() => periodStarts(period, firstDate, today), [period, firstDate, today]);
  const periodIndex = Math.max(0, periods.indexOf(range.start));
  const historyStart = firstDate && firstDate < today ? firstDate : today;

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [range.start, period]);

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveBadbeatEntryAction({ id: null, date, time, customers, won, comment });
    setPending(false);
    if (!result.ok) {
      setError(copy.errors[result.error]);
      return;
    }
    setRows((current) => place(current, result.entry));
    setCustomers("");
    setComment("");
    setWon(false);
    setError(null);
    setTime(nowDraft().time);
  }

  function chooseSort(key: BadbeatSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" },
    );
  }

  function movePeriod(direction: -1 | 1) {
    setAnchor((current) => shiftAnchor(current, period, direction));
  }

  function hoverTrend(date: string | null) {
    const list = listRef.current;
    const row = date ? list?.querySelector<HTMLElement>(`[data-badbeat-date="${date}"]`) : null;
    const next = row ? date : null;
    setLitDate((current) => (current === next ? current : next));
    if (litScroll.current === next) return;
    litScroll.current = next;
    if (!list || !row) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const header = list.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    if (rowRect.top >= listRect.top + header && rowRect.bottom <= listRect.bottom) return;
    list.scrollTo({ top: Math.max(0, list.scrollTop + rowRect.top - listRect.top - header), behavior: "smooth" });
  }

  async function removeEntry(entry: BadbeatRow) {
    const previous = rows;
    setRows((current) => current.filter((item) => item.id !== entry.id));
    setError(null);
    if (editing?.id === entry.id) setEditing(null);
    const result = await deleteBadbeatEntryAction(entry.id);
    if (!result.ok) {
      setRows(previous);
      setError(copy.errors[result.error]);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-950/50">
            <Spade size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-white">{copy.headline}</h1>
            <p className="text-sm text-violet-100/60">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full px-4"
            onClick={() => {
              const month = monthRange(today);
              setExportFrom(month.start);
              setExportTo(month.end);
              setExportOpen(true);
            }}
          >
            <Download size={15} aria-hidden="true" />
            {copy.export}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="size-10 rounded-full px-0"
              aria-label={copy.previous}
              disabled={!canPrev}
              onClick={() => movePeriod(-1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
            <label className="relative">
              <span className="sr-only">{copy.period}</span>
              <Calendar size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-violet-200" aria-hidden="true" />
              <select
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as ListPeriod);
                  setAnchor(today);
                }}
                className="appearance-none rounded-full border border-white/10 bg-[#141226] py-2 pr-8 pl-9 text-sm font-semibold text-white outline-none [color-scheme:dark] focus:border-violet-400/60"
              >
                <option value="month">{copy.thisMonth}</option>
                <option value="week">{copy.thisWeek}</option>
                <option value="year">{copy.thisYear}</option>
              </select>
            </label>
            <Button
              type="button"
              variant="ghost"
              className="size-10 rounded-full px-0"
              aria-label={copy.next}
              disabled={!canNext}
              onClick={() => movePeriod(1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
          <p className="text-sm text-violet-100/70">{formatRange(range.start, range.end, locale)}</p>
        </div>
      </header>
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-4 overflow-hidden",
          canSeeStats && "grid-rows-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1",
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
          {canEnter ? (
            <section className="shrink-0 rounded-2xl border border-white/10 bg-[#141226] p-4">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <span className="grid size-7 place-items-center rounded-full bg-white/5 text-violet-200">
                  <Plus size={15} aria-hidden="true" />
                </span>
                {copy.add}
              </h2>
              <form onSubmit={(event) => void addEntry(event)} className="mt-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={copy.date} className="w-40">
                    <Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="rounded-full [color-scheme:dark]" />
                  </Field>
                  <Field label={copy.time} className="w-32">
                    <TimeField label={copy.time} value={time} onChange={setTime} hourLabel={copy.hour} minuteLabel={copy.minute} className="rounded-full" />
                  </Field>
                  <Field label={copy.customers} className="w-28">
                    <Input inputMode="numeric" required value={customers} onChange={(event) => setCustomers(event.target.value)} className="rounded-full" />
                  </Field>
                  <Field label={copy.comment} className="min-w-40 flex-1">
                    <Input value={comment} onChange={(event) => setComment(event.target.value)} className="rounded-full" />
                  </Field>
                  <SwitchButton pressed={won} onPressedChange={setWon} className="h-10 rounded-full px-4">
                    {copy.won}
                  </SwitchButton>
                  <Button type="submit" disabled={pending} className="h-10 rounded-full px-4">
                    <Save size={15} aria-hidden="true" />
                    {copy.save}
                  </Button>
                </div>
                {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
              </form>
            </section>
          ) : null}
          {canEnter ? (
            <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Metric icon={Coins} label={copy.current} value={money(stats.current, locale)} highlight />
              <Metric icon={Calendar} label={copy.dayTotal} value={money(stats.dayTotal, locale)} />
              <Metric icon={Users} label={copy.dayEntries} value={String(stats.dayEntries)} />
              <Metric icon={RefreshCw} label={copy.carryover} value={money(stats.carryover, locale)} />
              <Metric icon={Trophy} label={copy.lastWon} value={stats.lastWon === null ? copy.none : money(stats.lastWon, locale)} />
            </div>
          ) : null}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141226]">
            <div ref={listRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
              {ordered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-violet-100/70">{copy.empty}</p>
              ) : (
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10 bg-[#141226] text-left text-violet-100/55">
                    <tr>
                      <th className="px-4 py-3 font-medium"><SortHeader label={copy.date} column="date" sort={sort} onSort={chooseSort} /></th>
                      <th className="px-3 py-3 font-medium"><SortHeader label={copy.time} column="time" sort={sort} onSort={chooseSort} /></th>
                      <th className="px-3 py-3 font-medium"><SortHeader label={copy.customers} column="customers" sort={sort} onSort={chooseSort} /></th>
                      <th className="px-3 py-3 font-medium"><SortHeader label={copy.amount} column="amount" sort={sort} onSort={chooseSort} /></th>
                      <th className="px-3 py-3 font-medium"><SortHeader label={copy.comment} column="comment" sort={sort} onSort={chooseSort} /></th>
                      <th className="px-3 py-3 font-medium">{copy.won}</th>
                      {canEnter ? <th className="px-4 py-3" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {ordered.map((entry) => (
                      <tr
                        key={entry.id}
                        data-badbeat-date={entry.date}
                        className={cn(
                          entry.date === litDate &&
                            "[&>td]:bg-violet-500/25 [&>td]:shadow-[inset_0_0_16px_rgba(196,181,253,0.75)]",
                        )}
                      >
                        <td className="border-t border-white/5 px-4 py-3 text-white">{formatDate(entry.date, locale)}</td>
                        <td className="border-t border-white/5 px-3 py-3 tabular-nums text-white">{entry.time}</td>
                        <td className="border-t border-white/5 px-3 py-3 tabular-nums text-violet-100/80">{entry.customers}</td>
                        <td className="border-t border-white/5 px-3 py-3 font-semibold tabular-nums text-white">{money(entry.amount, locale)}</td>
                        <td className="max-w-48 truncate border-t border-white/5 px-3 py-3 text-violet-100/70">{entry.comment || copy.none}</td>
                        <td className="border-t border-white/5 px-3 py-3">
                          <span
                            className={cn(
                              "grid size-7 place-items-center rounded-full border",
                              entry.won ? "border-emerald-300/40 text-emerald-300" : "border-white/15 text-violet-200/45",
                            )}
                          >
                            {entry.won ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                            <span className="sr-only">{entry.won ? copy.won : copy.none}</span>
                          </span>
                        </td>
                        {canEnter ? (
                          <td className="border-t border-white/5 px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="ghost" className="rounded-full" onClick={() => setEditing(entry)}>
                                <Pencil size={14} aria-hidden="true" />
                                {copy.edit}
                              </Button>
                              <Button type="button" variant="ghost" className="rounded-full text-rose-100" onClick={() => setPendingDelete(entry)}>
                                <Trash2 size={14} aria-hidden="true" />
                                {copy.remove}
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-2">
              <p className="text-sm tabular-nums text-violet-100/60">
                {periodIndex + 1} / {periods.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-3"
                  disabled={!canPrev}
                  onClick={() => movePeriod(-1)}
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                  {copy.previous}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-3"
                  disabled={!canNext}
                  onClick={() => movePeriod(1)}
                >
                  {copy.next}
                  <ChevronRight size={15} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>
        </div>
        {canSeeStats ? (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">
            <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <BarChart3 size={16} className="text-violet-300" aria-hidden="true" />
                {copy.statsTitle}
              </h2>
              <dl className="mt-2">
                <KeyStat icon={Trophy} label={copy.highestDay} value={insights.highestDay ? `${formatDate(insights.highestDay.date, locale)} · ${money(insights.highestDay.added, locale)}` : copy.none} />
                <KeyStat icon={Users} label={copy.medianCustomers} value={insights.medianCustomers === null ? copy.none : String(insights.medianCustomers)} />
                <KeyStat icon={Users} label={copy.busiestDay} value={insights.busiestDay ? `${formatDate(insights.busiestDay.date, locale)} · ${insights.busiestDay.customers}` : copy.none} />
                <KeyStat icon={BarChart3} label={copy.averageDay} value={insights.averageAdded === null ? copy.none : money(insights.averageAdded, locale)} />
                <KeyStat icon={Trophy} label={copy.wins} value={String(insights.wins)} />
              </dl>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                  <TrendingUp size={16} className="text-violet-300" aria-hidden="true" />
                  {copy.trends}
                </h2>
                <div className="flex rounded-full bg-white/5 p-1">
                  <ChartToggle pressed={chart === "amount"} onClick={() => setChart("amount")}>{copy.amount}</ChartToggle>
                  <ChartToggle pressed={chart === "customers"} onClick={() => setChart("customers")}>{copy.customers}</ChartToggle>
                </div>
              </div>
              <TrendChart points={trend} mode={chart} locale={locale} onHover={hoverTrend} />
            </section>
            <div className="grid grid-cols-3 gap-2">
              <Mini icon={Calendar} label={copy.periodTotal} value={money(periodTotal, locale)} />
              <Mini icon={Hash} label={copy.periodEntries} value={String(periodRows.length)} />
              <Mini icon={BarChart3} label={copy.averageCustomers} value={averageCustomers === null ? copy.none : String(averageCustomers)} />
            </div>
          </div>
        ) : null}
      </div>
      {exportOpen ? (
        <ExportDialog
          copy={copy}
          from={exportFrom}
          to={exportTo}
          format={exportFormat}
          onFrom={setExportFrom}
          onTo={setExportTo}
          allFrom={historyStart}
          allTo={today}
          onFormat={setExportFormat}
          onClose={() => setExportOpen(false)}
          onDownload={() => {
            const reportCopy: BadbeatReportCopy = {
              summaryTitle: copy.summaryTitle,
              registerTitle: copy.registerTitle,
              trendsTitle: copy.trendsTitle,
              summarySheet: copy.summarySheet,
              registerSheet: copy.registerSheet,
              trendsSheet: copy.trendsSheet,
              periodPrefix: copy.periodPrefix,
              asOf: copy.asOf,
              exportWord: copy.exportWord,
              keyStats: copy.keyStats,
              context: copy.contextTitle,
              bestDay: copy.bestDay,
              highestOn: copy.highestOn,
              busiestOn: copy.busiestOn,
              window: copy.window,
              current: copy.current,
              addedToday: copy.addedToday,
              carryover: copy.carryover,
              wins: copy.wins,
              periodTotal: copy.periodTotal,
              entries: copy.periodEntries,
              averageCustomers: copy.averageCustomers,
              entriesToday: copy.dayEntries,
              highestDay: copy.highestDay,
              medianCustomers: copy.medianCustomers,
              busiestDay: copy.busiestDay,
              averageDay: copy.averageDay,
              lastWon: copy.lastWon,
              date: copy.date,
              time: copy.time,
              customers: copy.customers,
              cumul: copy.cumul,
              comment: copy.comment,
              won: copy.won,
              added: copy.addedAmount,
              yes: copy.yes,
              no: copy.no,
              none: copy.none,
              rule: copy.rule,
            };
            const report = buildBadbeatReport(rows, today, exportFrom, exportTo, reportCopy, locale);
            const name = `badbeat-${exportFrom}_${exportTo}`;
            if (exportFormat === "csv") downloadBlob(name, reportCsv(report, locale), "csv");
            else if (exportFormat === "pdf") downloadBlob(name, badbeatPdf(report, locale), "pdf");
            else downloadBlob(name, reportXlsx(report), "xlsx");
            setExportOpen(false);
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDelete
          copy={copy}
          summary={`${formatDate(pendingDelete.date, locale)} · ${pendingDelete.time}`}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            const entry = pendingDelete;
            setPendingDelete(null);
            void removeEntry(entry);
          }}
        />
      ) : null}
      {editing ? (
        <EntryModal
          entry={editing}
          copy={copy}
          onClose={() => setEditing(null)}
          onSaved={(entry) => {
            setRows((current) => place(current, entry));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: BadbeatSortKey;
  sort: { key: BadbeatSortKey; direction: "asc" | "desc" };
  onSort: (key: BadbeatSortKey) => void;
}) {
  const active = sort.key === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-pressed={active}
      className={cn("inline-flex items-center gap-1 text-left text-xs font-medium hover:text-white", active ? "text-white" : "text-violet-100/55")}
    >
      <span>{label}</span>
      {active ? <span aria-hidden="true">{sort.direction === "desc" ? "↓" : "↑"}</span> : null}
    </button>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("grid gap-1.5 text-xs text-violet-100/55", className)}>
      {label}
      {children}
    </label>
  );
}

function Metric({ icon: Icon, label, value, highlight = false }: { icon: LucideIcon; label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-3",
        highlight
          ? "border-violet-400/80 bg-violet-600/15 shadow-[0_0_24px_rgba(124,58,237,0.2)]"
          : "border-white/10 bg-[#141226]",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", highlight ? "bg-violet-600 text-white" : "bg-white/5 text-violet-200")}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-violet-100/60">{label}</span>
        <span className="block font-display text-base font-semibold leading-tight tabular-nums text-white">{value}</span>
      </span>
    </div>
  );
}

function KeyStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-b-0">
      <dt className="flex min-w-0 items-center gap-2 text-violet-100/70">
        <Icon size={15} className="shrink-0 text-violet-300" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="shrink-0 text-right font-semibold text-white">{value}</dd>
    </div>
  );
}

function Mini({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141226] px-3 py-3">
      <Icon size={15} className="text-violet-300" aria-hidden="true" />
      <p className="mt-2 truncate text-[11px] text-violet-100/55">{label}</p>
      <p className="truncate font-display text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function ChartToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        pressed ? "bg-violet-600 text-white" : "text-violet-100/70 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function TrendChart({
  points,
  mode,
  locale,
  onHover,
}: {
  points: BadbeatTrendPoint[];
  mode: "amount" | "customers";
  locale: string;
  onHover: (date: string | null) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((point) => (mode === "amount" ? point.amount : point.customers));
  const peak = Math.max(1, ...values);
  const step = Math.pow(10, Math.floor(Math.log10(peak))) / 2 || 1;
  const max = Math.ceil(peak / step) * step;
  const width = 120;
  const height = 52;
  const left = 22;
  const coords = values.map((value, index) => {
    const x = points.length <= 1 ? left + (width - left) / 2 : left + (index / (points.length - 1)) * (width - left);
    const y = height - 4 - (value / max) * (height - 8);
    return { x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const area = coords.length
    ? `${line} L ${coords[coords.length - 1]?.x.toFixed(2) ?? left} ${height} L ${coords[0]?.x.toFixed(2) ?? left} ${height} Z`
    : "";
  const ticks = [0, 1, 2, 3, 4].map((index) => Math.round((max / 4) * index));
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((index, position, all) => index >= 0 && all.indexOf(index) === position);

  function pointIndex(clientX: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const x = rect.width === 0 ? left : ((clientX - rect.left) / rect.width) * width;
    if (points.length <= 1) return 0;
    const index = Math.round(((x - left) / (width - left)) * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, index));
  }

  function hover(event: PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const index = pointIndex(event.clientX, event.currentTarget);
    setActive((current) => (current === index ? current : index));
    onHover(points[index]?.date ?? null);
  }

  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full cursor-pointer"
        role="img"
        onPointerMove={hover}
        onPointerLeave={() => {
          setActive(null);
          onHover(null);
        }}
      >
        <defs>
          <linearGradient id="badbeat-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = height - 4 - (tick / max) * (height - 8);
          return (
            <g key={tick}>
              <line x1={left} x2={width} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
              <text x="0" y={y + 1} fill="rgba(221,214,254,0.45)" fontSize="3.2">
                {tick}
              </text>
            </g>
          );
        })}
        {area ? <path d={area} fill="url(#badbeat-trend-fill)" /> : null}
        {line ? <path d={line} fill="none" stroke="#c4b5fd" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.length <= 40
          ? coords.map((point, index) => (
              <circle key={points[index]?.date ?? index} cx={point.x} cy={point.y} r="1.1" fill="#ddd6fe" />
            ))
          : null}
        {active !== null && coords[active] ? (
          <circle cx={coords[active].x} cy={coords[active].y} r="1.8" fill="#ffffff" stroke="#c4b5fd" strokeWidth="0.6" />
        ) : null}
      </svg>
      <div className="flex justify-between pl-8 text-[11px] text-violet-100/45">
        {labels.map((index) => (
          <span key={points[index]?.date ?? index}>{points[index] ? formatShort(points[index].date, locale) : ""}</span>
        ))}
      </div>
    </figure>
  );
}

function ExportDialog({
  copy,
  from,
  to,
  allFrom,
  allTo,
  format,
  onFrom,
  onTo,
  onFormat,
  onClose,
  onDownload,
}: {
  copy: Copy;
  from: string;
  to: string;
  allFrom: string;
  allTo: string;
  format: DownloadKind;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onFormat: (value: DownloadKind) => void;
  onClose: () => void;
  onDownload: () => void;
}) {
  const invalid = !from || !to || from > to;
  const formats: Array<{ id: DownloadKind; label: string }> = [
    { id: "pdf", label: copy.formatPdf },
    { id: "xlsx", label: copy.formatXlsx },
    { id: "csv", label: copy.formatCsv },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="badbeat-export-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) onDownload();
        }}
      >
        <h2 id="badbeat-export-title" className="font-display text-lg font-semibold text-white">
          {copy.export}
        </h2>
        <button
          type="button"
          aria-pressed={from === allFrom && to === allTo}
          onClick={() => {
            onFrom(allFrom);
            onTo(allTo);
          }}
          className={cn(
            "mt-4 rounded-full px-3 py-1.5 text-sm font-semibold",
            from === allFrom && to === allTo ? "bg-violet-600 text-white" : "bg-white/5 text-violet-100/70 hover:text-white",
          )}
        >
          {copy.allTime}
        </button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="badbeat-export-from">{copy.from}</Label>
            <Input id="badbeat-export-from" type="date" required value={from} onChange={(event) => onFrom(event.target.value)} className="[color-scheme:dark]" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="badbeat-export-to">{copy.to}</Label>
            <Input id="badbeat-export-to" type="date" required value={to} onChange={(event) => onTo(event.target.value)} className="[color-scheme:dark]" />
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm text-violet-100/70">{copy.format}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {formats.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={format === item.id}
                onClick={() => onFormat(item.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold",
                  format === item.id ? "bg-violet-600 text-white" : "bg-white/5 text-violet-100/70 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        {invalid && from && to ? <p className="mt-3 text-sm text-rose-200">{copy.invalidRange}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={invalid}>
            <Download size={15} aria-hidden="true" />
            {copy.download}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDelete({
  copy,
  summary,
  onClose,
  onConfirm,
}: {
  copy: Copy;
  summary: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="badbeat-delete-title"
        aria-describedby="badbeat-delete-body"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="badbeat-delete-title" className="font-display text-lg font-semibold text-white">
          {copy.confirmTitle}
        </h2>
        <p id="badbeat-delete-body" className="mt-2 text-sm text-violet-100/70">
          {copy.confirmBody}
        </p>
        <p className="mt-3 text-sm font-semibold text-white">{summary}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            <Trash2 size={15} aria-hidden="true" />
            {copy.remove}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryModal({
  entry,
  copy,
  onClose,
  onSaved,
}: {
  entry: BadbeatRow;
  copy: Copy;
  onClose: () => void;
  onSaved: (entry: BadbeatRow) => void;
}) {
  const [date, setDate] = useState(entry.date);
  const [time, setTime] = useState(entry.time);
  const [customers, setCustomers] = useState(String(entry.customers));
  const [won, setWon] = useState(entry.won);
  const [comment, setComment] = useState(entry.comment);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveBadbeatEntryAction({
      id: entry.id,
      date,
      time,
      customers,
      won,
      comment,
    });
    setPending(false);
    if (!result.ok) {
      setError(copy.errors[result.error]);
      return;
    }
    onSaved(result.entry);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="badbeat-dialog-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="badbeat-dialog-title" className="font-display text-lg font-semibold text-white">
          {copy.editTitle}
        </h2>
        <p className="mt-1 text-sm text-violet-100/70">{copy.rule}</p>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="badbeat-date">{copy.date}</Label>
            <Input
              id="badbeat-date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{copy.time}</Label>
            <TimeField label={copy.time} value={time} onChange={setTime} hourLabel={copy.hour} minuteLabel={copy.minute} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="badbeat-customers">{copy.customers}</Label>
            <Input
              id="badbeat-customers"
              inputMode="numeric"
              required
              value={customers}
              onChange={(event) => setCustomers(event.target.value)}
            />
          </div>
          <SwitchButton pressed={won} onPressedChange={setWon}>
            {copy.won}
          </SwitchButton>
          <div className="grid gap-1.5">
            <Label htmlFor="badbeat-comment">{copy.comment}</Label>
            <textarea
              id="badbeat-comment"
              value={comment}
              rows={3}
              onChange={(event) => setComment(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
            />
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={pending}>
            {copy.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
