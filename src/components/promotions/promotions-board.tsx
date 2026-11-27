"use client";

import { BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Gift, Hash, Pencil, PhoneCall, Plus, Save, Settings, Trash2, TrendingUp, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { TimeField } from "@/components/employees/time-field";
import { SwitchButton } from "@/components/employees/switch-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  callsWaiting,
  eachDay,
  monthBounds,
  orderPromotionEntries,
  pricePromotion,
  promotionInsights,
  promotionStats,
  requirementFor,
  type PromotionEntryInput,
  type PromotionRecord,
  type Settle,
} from "@/lib/promotions/rules";
import type { PromotionError } from "@/lib/promotions/validation";
import { cn } from "@/lib/utils";
import {
  createPromotionAction,
  deletePromotionAction,
  deletePromotionEntryAction,
  savePromotionEntryAction,
} from "@/server/actions/promotions";

export type PromotionCopy = {
  headline: string;
  subtitle: string;
  newPromotion: string;
  emptyPromos: string;
  empty: string;
  createTitle: string;
  createHint: string;
  name: string;
  from: string;
  to: string;
  kind: string;
  instant: string;
  cumulative: string;
  besthand: string;
  instantHint: string;
  cumulativeHint: string;
  besthandHint: string;
  ruleBesthand: string;
  player: string;
  phone: string;
  hand: string;
  paidTonight: string;
  callTomorrow: string;
  toCall: string;
  paidLater: string;
  markPaid: string;
  call: string;
  nobodyWaiting: string;
  dayTaken: string;
  lastWinner: string;
  prize: string;
  status: string;
  requirement: string;
  payout: string;
  addRequirement: string;
  opening: string;
  climbsBy: string;
  sameEveryDay: string;
  differentEachDay: string;
  save: string;
  cancel: string;
  add: string;
  edit: string;
  remove: string;
  date: string;
  time: string;
  comment: string;
  won: string;
  amount: string;
  hour: string;
  minute: string;
  current: string;
  totalPaid: string;
  hits: string;
  lastPayout: string;
  lastWon: string;
  climbed: string;
  todayRequirement: string;
  keyStats: string;
  settings: string;
  trends: string;
  highest: string;
  average: string;
  favorite: string;
  loggedDays: string;
  lines: string;
  perDay: string;
  closed: string;
  none: string;
  deletePromo: string;
  kept: string;
  confirmEntryTitle: string;
  confirmEntryBody: string;
  confirmPromoTitle: string;
  confirmPromoBody: string;
  previous: string;
  next: string;
  promotion: string;
  ruleInstant: string;
  ruleCumulative: string;
  errors: Record<PromotionError, string>;
};

type DraftRow = { key: string; label: string; payout: string; appliesOn: string | null };

export function PromotionsBoard({
  promotions: initialPromotions,
  entries: initialEntries,
  locale,
  copy,
}: {
  promotions: PromotionRecord[];
  entries: PromotionEntryInput[];
  locale: string;
  copy: PromotionCopy;
}) {
  const today = useMemo(() => localToday(), []);
  const [promotions, setPromotions] = useState(initialPromotions);
  const [entries, setEntries] = useState(initialEntries);
  const [selectedId, setSelectedId] = useState(() => initialId(initialPromotions, today));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PromotionEntryInput | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PromotionEntryInput | null>(null);
  const [pendingPromoDelete, setPendingPromoDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selected = promotions.find((promotion) => promotion.id === selectedId) ?? null;
  const index = promotions.findIndex((promotion) => promotion.id === selectedId);
  const rows = useMemo(
    () => (selected ? orderPromotionEntries(pricePromotion(selected, entries)) : []),
    [selected, entries],
  );
  const stats = useMemo(() => (selected ? promotionStats(selected, entries, today) : null), [selected, entries, today]);
  const insights = useMemo(() => (selected ? promotionInsights(selected, entries, today) : null), [selected, entries, today]);
  const hasLog = selected ? entries.some((entry) => entry.promotionId === selected.id) : false;
  const waiting = useMemo(
    () =>
      callsWaiting(entries).flatMap((entry) => {
        const promotion = promotions.find((item) => item.id === entry.promotionId && item.kind === "besthand");
        return promotion ? [{ entry, promotion }] : [];
      }),
    [entries, promotions],
  );

  async function markPaid(entry: PromotionEntryInput) {
    if (!entry.requirementId) return;
    setPayingId(entry.id);
    const result = await savePromotionEntryAction({
      id: entry.id,
      promotionId: entry.promotionId,
      date: entry.date,
      time: entry.time,
      requirementId: entry.requirementId,
      won: true,
      comment: entry.comment,
      kind: "besthand",
      playerName: entry.playerName,
      playerPhone: entry.playerPhone,
      hand: entry.hand,
      settle: "settled",
    });
    setPayingId(null);
    if (!result.ok) {
      setError(copy.errors[result.error]);
      return;
    }
    setEntries((current) => place(current, result.entry));
    setError("");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-950/50">
            <Gift size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-white">{copy.headline}</h1>
            <p className="text-sm text-violet-100/60">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="h-10 rounded-full px-4" onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden="true" />
            {copy.newPromotion}
          </Button>
          {promotions.length > 0 ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                className="size-10 rounded-full px-0"
                aria-label={copy.previous}
                disabled={index < 0 || index >= promotions.length - 1}
                onClick={() => {
                  const next = promotions[index + 1];
                  if (next) setSelectedId(next.id);
                }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <label className="relative">
                <span className="sr-only">{copy.promotion}</span>
                <select
                  value={selectedId ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="max-w-64 appearance-none rounded-full border border-white/10 bg-[#141226] py-2 pr-8 pl-4 text-sm font-semibold text-white outline-none [color-scheme:dark] focus:border-violet-400/60"
                >
                  {promotions.map((promotion) => (
                    <option key={promotion.id} value={promotion.id}>
                      {promotion.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                className="size-10 rounded-full px-0"
                aria-label={copy.next}
                disabled={index <= 0}
                onClick={() => {
                  const next = promotions[index - 1];
                  if (next) setSelectedId(next.id);
                }}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
          {selected ? <p className="text-sm text-violet-100/70">{formatRange(selected.startsOn, selected.endsOn, locale)}</p> : null}
        </div>
      </header>

      {waiting.length > 0 ? (
        <section className="shrink-0 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
            <PhoneCall size={15} aria-hidden="true" />
            {copy.toCall}
          </h2>
          <ul className="mt-2 grid max-h-40 gap-2 overflow-y-auto">
            {waiting.map(({ entry, promotion }) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="min-w-0 text-left text-sm text-white" onClick={() => setSelectedId(promotion.id)}>
                  <span className="font-semibold">{entry.playerName}</span>
                  <span className="text-amber-100/80">
                    {" "}
                    · {entry.playerPhone} · {entry.hand} · {formatShort(entry.date, locale)} · {promotion.name}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <a href={phoneHref(entry.playerPhone)} className="text-sm font-semibold text-amber-100 underline-offset-2 hover:underline">
                    {copy.call}
                  </a>
                  <Button type="button" className="h-8 rounded-full px-3" disabled={payingId === entry.id} onClick={() => void markPaid(entry)}>
                    {copy.markPaid}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selected && stats ? (
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
            <LogForm
              key={selected.id}
              promotion={selected}
              entries={entries}
              copy={copy}
              error={error}
              onError={setError}
              onSaved={(entry) => {
                setEntries((current) => place(current, entry));
                setError("");
              }}
            />
            <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
              {stats.kind === "instant" ? (
                <>
                  <Metric label={copy.totalPaid} value={money(stats.totalPaid, locale)} highlight />
                  <Metric label={copy.hits} value={String(stats.hits)} />
                  <Metric label={copy.lastPayout} value={stats.lastPayout === null ? copy.none : money(stats.lastPayout, locale)} />
                </>
              ) : stats.kind === "besthand" ? (
                <>
                  <Metric label={copy.toCall} value={String(stats.toCall)} highlight={stats.toCall > 0} />
                  <Metric label={copy.paidTonight} value={String(stats.paidTonight)} />
                  <Metric label={copy.paidLater} value={String(stats.paidLater)} />
                  <Metric label={copy.totalPaid} value={money(stats.totalPaid, locale)} />
                </>
              ) : (
                <>
                  <Metric label={copy.current} value={stats.current === null ? copy.closed : money(stats.current, locale)} highlight />
                  <Metric label={copy.perDay} value={money(stats.climb, locale)} />
                  <Metric label={copy.lastWon} value={stats.lastWon === null ? copy.none : money(stats.lastWon, locale)} />
                  <Metric label={copy.climbed} value={String(stats.climbedDays)} />
                </>
              )}
            </div>
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141226]">
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                {rows.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-violet-100/70">{copy.empty}</p>
                ) : selected.kind === "besthand" ? (
                  <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10 bg-[#141226] text-left text-xs text-violet-100/55">
                      <tr>
                        <th className="px-4 py-3 font-medium">{copy.date}</th>
                        <th className="px-3 py-3 font-medium">{copy.player}</th>
                        <th className="px-3 py-3 font-medium">{copy.phone}</th>
                        <th className="px-3 py-3 font-medium">{copy.hand}</th>
                        <th className="px-3 py-3 font-medium">{copy.amount}</th>
                        <th className="px-3 py-3 font-medium">{copy.status}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((entry) => (
                        <tr key={entry.id} className={entry.settle === "call" ? "bg-amber-400/10" : undefined}>
                          <td className="border-t border-white/5 px-4 py-3 text-white">
                            {formatDate(entry.date, locale)}
                            <span className="mt-0.5 block text-xs tabular-nums text-violet-100/50">{entry.time}</span>
                          </td>
                          <td className="border-t border-white/5 px-3 py-3 font-semibold text-white">{entry.playerName}</td>
                          <td className="border-t border-white/5 px-3 py-3 text-violet-100/80">
                            {entry.playerPhone ? (
                              <a href={phoneHref(entry.playerPhone)} className="underline-offset-2 hover:underline">
                                {entry.playerPhone}
                              </a>
                            ) : (
                              copy.none
                            )}
                          </td>
                          <td className="max-w-40 truncate border-t border-white/5 px-3 py-3 text-violet-100/80">{entry.hand}</td>
                          <td className="border-t border-white/5 px-3 py-3 font-semibold tabular-nums text-white">{money(entry.amount, locale)}</td>
                          <td className="border-t border-white/5 px-3 py-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-semibold",
                                entry.settle === "call" ? "bg-amber-400/15 text-amber-100" : "bg-emerald-400/10 text-emerald-200",
                              )}
                            >
                              {settleLabel(entry.settle, copy)}
                            </span>
                          </td>
                          <td className="border-t border-white/5 px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {entry.settle === "call" ? (
                                <Button type="button" className="rounded-full" disabled={payingId === entry.id} onClick={() => void markPaid(entry)}>
                                  {copy.markPaid}
                                </Button>
                              ) : null}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10 bg-[#141226] text-left text-xs text-violet-100/55">
                      <tr>
                        <th className="px-4 py-3 font-medium">{copy.date}</th>
                        <th className="px-3 py-3 font-medium">{copy.time}</th>
                        <th className="px-3 py-3 font-medium">{copy.requirement}</th>
                        <th className="px-3 py-3 font-medium">{copy.amount}</th>
                        <th className="px-3 py-3 font-medium">{copy.comment}</th>
                        {selected.kind === "cumulative" ? <th className="px-3 py-3 font-medium">{copy.won}</th> : null}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((entry) => (
                        <tr key={entry.id}>
                          <td className="border-t border-white/5 px-4 py-3 text-white">{formatDate(entry.date, locale)}</td>
                          <td className="border-t border-white/5 px-3 py-3 tabular-nums text-white">{entry.time}</td>
                          <td className="border-t border-white/5 px-3 py-3 text-violet-100/80">{entry.requirement || copy.none}</td>
                          <td className="border-t border-white/5 px-3 py-3 font-semibold tabular-nums text-white">{money(entry.amount, locale)}</td>
                          <td className="max-w-48 truncate border-t border-white/5 px-3 py-3 text-violet-100/70">{entry.comment || copy.none}</td>
                          {selected.kind === "cumulative" ? (
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
                          ) : null}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">
            {selected.kind === "besthand" ? (
              <section className="rounded-2xl border border-amber-300/25 bg-[#141226] p-4">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                  <PhoneCall size={16} className="text-amber-200" aria-hidden="true" />
                  {copy.toCall}
                </h2>
                {waiting.filter((item) => item.promotion.id === selected.id).length === 0 ? (
                  <p className="mt-2 text-sm text-violet-100/60">{copy.nobodyWaiting}</p>
                ) : (
                  <ul className="mt-2 grid gap-3">
                    {waiting
                      .filter((item) => item.promotion.id === selected.id)
                      .map(({ entry }) => (
                        <li key={entry.id} className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3">
                          <p className="font-semibold text-white">{entry.playerName}</p>
                          <p className="mt-1 text-sm text-amber-100/80">
                            {entry.hand} · {formatShort(entry.date, locale)}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <a href={phoneHref(entry.playerPhone)} className="text-sm font-semibold text-amber-100 underline-offset-2 hover:underline">
                              {entry.playerPhone}
                            </a>
                            <Button type="button" className="h-8 rounded-full px-3" disabled={payingId === entry.id} onClick={() => void markPaid(entry)}>
                              {copy.markPaid}
                            </Button>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            ) : null}
            {insights ? (
              <>
                <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                    <BarChart3 size={16} className="text-violet-300" aria-hidden="true" />
                    {copy.keyStats}
                  </h2>
                  <dl className="mt-2">
                    {stats?.kind === "besthand" ? (
                      <>
                        <KeyStat icon={PhoneCall} label={copy.toCall} value={String(stats.toCall)} />
                        <KeyStat icon={Check} label={copy.paidTonight} value={String(stats.paidTonight)} />
                        <KeyStat icon={PhoneCall} label={copy.paidLater} value={String(stats.paidLater)} />
                        <KeyStat
                          icon={Trophy}
                          label={copy.lastWinner}
                          value={stats.lastPlayer ? `${stats.lastPlayer}${stats.lastDate ? ` · ${formatShort(stats.lastDate, locale)}` : ""}` : copy.none}
                        />
                        <KeyStat icon={Gift} label={copy.hand} value={stats.lastHand ?? copy.none} />
                        <KeyStat icon={Hash} label={copy.prize} value={money(stats.prize, locale)} />
                      </>
                    ) : (
                      <>
                        <KeyStat
                          icon={Trophy}
                          label={copy.highest}
                          value={insights.highest ? `${formatDate(insights.highest.date, locale)} · ${money(insights.highest.amount, locale)}` : copy.none}
                        />
                        <KeyStat
                          icon={Trophy}
                          label={selected.kind === "instant" ? copy.lastPayout : copy.lastWon}
                          value={insights.last ? `${formatDate(insights.last.date, locale)} · ${money(insights.last.amount, locale)}` : copy.none}
                        />
                        <KeyStat icon={Hash} label={selected.kind === "instant" ? copy.hits : copy.won} value={String(insights.wins)} />
                        <KeyStat icon={BarChart3} label={copy.average} value={insights.average === null ? copy.none : money(insights.average, locale)} />
                        <KeyStat
                          icon={Gift}
                          label={copy.favorite}
                          value={insights.favorite ? `${insights.favorite.label} · ${insights.favorite.count}` : copy.none}
                        />
                        {stats?.kind === "cumulative" ? (
                          <KeyStat icon={TrendingUp} label={copy.todayRequirement} value={stats.todayRequirement ?? copy.none} />
                        ) : null}
                      </>
                    )}
                  </dl>
                </section>
                <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                    <TrendingUp size={16} className="text-violet-300" aria-hidden="true" />
                    {copy.trends}
                  </h2>
                  <TrendChart points={insights.trend} locale={locale} />
                </section>
                <div className="grid grid-cols-3 gap-2">
                  <Mini label={copy.totalPaid} value={money(insights.totalPaid, locale)} />
                  <Mini
                    label={stats?.kind === "besthand" ? copy.toCall : copy.lines}
                    value={stats?.kind === "besthand" ? String(stats.toCall) : String(insights.lines)}
                  />
                  <Mini label={copy.loggedDays} value={String(insights.loggedDays)} />
                </div>
              </>
            ) : null}
            <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
              <button
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-2 font-display text-base font-semibold text-white">
                  <Settings size={16} className="text-violet-300" aria-hidden="true" />
                  {copy.settings}
                </span>
                <ChevronDown size={16} className={cn("text-violet-200 transition", settingsOpen && "rotate-180")} aria-hidden="true" />
              </button>
              {settingsOpen ? (
                <div className="mt-3">
                  <p className="text-sm text-violet-100/60">
                    {selected.kind === "instant" ? copy.ruleInstant : selected.kind === "besthand" ? copy.ruleBesthand : copy.ruleCumulative}
                  </p>
                  <dl className="mt-3">
                    <Stat
                      label={copy.kind}
                      value={selected.kind === "instant" ? copy.instant : selected.kind === "besthand" ? copy.besthand : copy.cumulative}
                    />
                    <Stat label={copy.from} value={formatDate(selected.startsOn, locale)} />
                    <Stat label={copy.to} value={formatDate(selected.endsOn, locale)} />
                    {stats?.kind === "besthand" ? <Stat label={copy.prize} value={money(stats.prize, locale)} /> : null}
                    {stats?.kind === "cumulative" ? (
                      <>
                        <Stat label={copy.opening} value={money(stats.opening, locale)} />
                        <Stat label={copy.climbsBy} value={money(stats.climb, locale)} />
                        <Stat label={copy.requirement} value={selected.climbMode === "daily" ? copy.differentEachDay : copy.sameEveryDay} />
                      </>
                    ) : null}
                  </dl>
                  <ul className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
                    {selected.requirements.map((requirement) => (
                      <li key={requirement.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-violet-100/75">
                          {requirement.appliesOn ? `${formatShort(requirement.appliesOn, locale)} · ` : ""}
                          {requirement.label}
                        </span>
                        {requirement.payout !== null ? (
                          <span className="shrink-0 font-semibold tabular-nums text-white">{money(requirement.payout, locale)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {hasLog ? (
                    <p className="mt-4 text-sm text-violet-100/60">{copy.kept}</p>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-4 rounded-full text-rose-100"
                      onClick={() => setPendingPromoDelete(true)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      {copy.deletePromo}
                    </Button>
                  )}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-6">
          <p className="max-w-xl text-sm text-violet-100/75">{copy.emptyPromos}</p>
        </section>
      )}

      {creating ? (
        <CreateDialog
          today={today}
          locale={locale}
          copy={copy}
          onClose={() => setCreating(false)}
          onCreated={(promotion) => {
            setPromotions((current) => [promotion, ...current].sort((left, right) => right.startsOn.localeCompare(left.startsOn) || left.name.localeCompare(right.name)));
            setSelectedId(promotion.id);
            setCreating(false);
          }}
        />
      ) : null}
      {editing && selected ? (
        <EntryDialog
          promotion={selected}
          entry={editing}
          entries={entries}
          copy={copy}
          onClose={() => setEditing(null)}
          onSaved={(entry) => {
            setEntries((current) => place(current, entry));
            setEditing(null);
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title={copy.confirmEntryTitle}
          body={copy.confirmEntryBody}
          confirmLabel={copy.remove}
          cancelLabel={copy.cancel}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            const entry = pendingDelete;
            setPendingDelete(null);
            setEntries((current) => current.filter((item) => item.id !== entry.id));
            void deletePromotionEntryAction(entry.id).then((result) => {
              if (!result.ok) setEntries((current) => place(current, entry));
            });
          }}
        />
      ) : null}
      {pendingPromoDelete && selected ? (
        <ConfirmDialog
          title={copy.confirmPromoTitle}
          body={copy.confirmPromoBody}
          confirmLabel={copy.deletePromo}
          cancelLabel={copy.cancel}
          onClose={() => setPendingPromoDelete(false)}
          onConfirm={() => {
            const promotion = selected;
            setPendingPromoDelete(false);
            setPromotions((current) => current.filter((item) => item.id !== promotion.id));
            setEntries((current) => current.filter((item) => item.promotionId !== promotion.id));
            setSelectedId((current) => {
              const rest = promotions.filter((item) => item.id !== promotion.id);
              return rest.find((item) => item.startsOn <= today && today <= item.endsOn)?.id ?? rest[0]?.id ?? null;
            });
            void deletePromotionAction(promotion.id).then((result) => {
              if (!result.ok) {
                setPromotions((current) => [promotion, ...current]);
                setEntries((current) => [...current, ...entries.filter((item) => item.promotionId === promotion.id)]);
                setSelectedId(promotion.id);
                setError(copy.errors[result.error]);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

function LogForm({
  promotion,
  entries,
  copy,
  error,
  onError,
  onSaved,
}: {
  promotion: PromotionRecord;
  entries: PromotionEntryInput[];
  copy: PromotionCopy;
  error: string;
  onError: (value: string) => void;
  onSaved: (entry: PromotionEntryInput) => void;
}) {
  const draft = useMemo(() => nowDraft(), []);
  const [date, setDate] = useState(inside(promotion, draft.date) ? draft.date : promotion.startsOn);
  const [time, setTime] = useState(draft.time);
  const [requirementId, setRequirementId] = useState(requirementIdFor(promotion, inside(promotion, draft.date) ? draft.date : promotion.startsOn, ""));
  const [won, setWon] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [hand, setHand] = useState("");
  const [settle, setSettle] = useState<"" | "tonight" | "call">("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const nextDate = inside(promotion, date) ? date : promotion.startsOn;
    if (nextDate !== date) setDate(nextDate);
    setRequirementId((current) => requirementIdFor(promotion, nextDate, current));
  }, [promotion, date]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await savePromotionEntryAction({
      id: null,
      promotionId: promotion.id,
      date,
      time,
      requirementId,
      won: promotion.kind === "instant" ? true : won,
      comment,
      kind: promotion.kind,
      playerName,
      playerPhone,
      hand,
      settle,
    });
    setPending(false);
    if (!result.ok) {
      onError(copy.errors[result.error]);
      return;
    }
    onSaved(result.entry);
    setComment("");
    setWon(false);
    setPlayerName("");
    setPlayerPhone("");
    setHand("");
    setSettle("");
  }

  const standing = promotion.kind === "cumulative" ? requirementFor(promotion, date) : null;
  const dayTaken = promotion.kind === "besthand" && entries.some((entry) => entry.promotionId === promotion.id && entry.date === date);

  return (
    <section className="shrink-0 rounded-2xl border border-white/10 bg-[#141226] p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
        <span className="grid size-7 place-items-center rounded-full bg-white/5 text-violet-200">
          <Plus size={15} aria-hidden="true" />
        </span>
        {copy.add}
      </h2>
      <form onSubmit={(event) => void submit(event)} className="mt-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={copy.date} className="w-40">
            <Input
              type="date"
              required
              min={promotion.startsOn}
              max={promotion.endsOn}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-full [color-scheme:dark]"
            />
          </Field>
          <Field label={copy.time} className="w-32">
            <TimeField label={copy.time} value={time} onChange={setTime} hourLabel={copy.hour} minuteLabel={copy.minute} className="rounded-full" />
          </Field>
          {promotion.kind === "besthand" ? (
            <>
              <Field label={copy.player} className="min-w-36 flex-1">
                <Input required value={playerName} onChange={(event) => setPlayerName(event.target.value)} className="rounded-full" />
              </Field>
              <Field label={copy.phone} className="min-w-36 flex-1">
                <Input required={settle === "call"} type="tel" value={playerPhone} onChange={(event) => setPlayerPhone(event.target.value)} className="rounded-full" />
              </Field>
              <Field label={copy.hand} className="min-w-40 flex-1">
                <Input required value={hand} onChange={(event) => setHand(event.target.value)} className="rounded-full" />
              </Field>
            </>
          ) : promotion.kind === "instant" ? (
            <Field label={copy.requirement} className="min-w-44 flex-1">
              <select
                required
                value={requirementId}
                onChange={(event) => setRequirementId(event.target.value)}
                className="w-full rounded-full border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
              >
                {promotion.requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={copy.requirement} className="min-w-44 flex-1">
              <p className="flex h-10 items-center rounded-full border border-white/10 px-3 text-sm text-white">{standing?.label || copy.none}</p>
            </Field>
          )}
          <Field label={copy.comment} className="min-w-40 flex-1">
            <Input value={comment} onChange={(event) => setComment(event.target.value)} className="rounded-full" />
          </Field>
          {promotion.kind === "cumulative" ? (
            <SwitchButton pressed={won} onPressedChange={setWon} className="h-10 rounded-full px-4">
              {copy.won}
            </SwitchButton>
          ) : null}
          {promotion.kind === "besthand" ? (
            <>
              <SwitchButton pressed={settle === "tonight"} onPressedChange={() => setSettle("tonight")} className="h-10 rounded-full px-4">
                {copy.paidTonight}
              </SwitchButton>
              <SwitchButton pressed={settle === "call"} onPressedChange={() => setSettle("call")} className="h-10 rounded-full px-4">
                {copy.callTomorrow}
              </SwitchButton>
            </>
          ) : null}
          <Button type="submit" disabled={pending || !requirementId || dayTaken || (promotion.kind === "besthand" && settle === "")} className="h-10 rounded-full px-4">
            <Save size={15} aria-hidden="true" />
            {copy.save}
          </Button>
        </div>
        {dayTaken ? <p className="mt-2 text-sm text-amber-100">{copy.dayTaken}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
      </form>
    </section>
  );
}

function CreateDialog({
  today,
  locale,
  copy,
  onClose,
  onCreated,
}: {
  today: string;
  locale: string;
  copy: PromotionCopy;
  onClose: () => void;
  onCreated: (promotion: PromotionRecord) => void;
}) {
  const bounds = monthBounds(today);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(bounds.start);
  const [endsOn, setEndsOn] = useState(bounds.end);
  const [kind, setKind] = useState<"instant" | "cumulative" | "besthand">("instant");
  const [climbMode, setClimbMode] = useState<"steady" | "daily">("steady");
  const [startAmount, setStartAmount] = useState("300");
  const [climbAmount, setClimbAmount] = useState("50");
  const [rows, setRows] = useState<DraftRow[]>([{ key: "instant-1", label: "", payout: "", appliesOn: null }]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function chooseKind(next: "instant" | "cumulative" | "besthand") {
    setKind(next);
    if (next === "cumulative") setRows(climbMode === "daily" ? dailyRows(startsOn, endsOn, []) : [{ key: "steady", label: "", payout: "", appliesOn: null }]);
    else setRows([{ key: next, label: "", payout: "", appliesOn: null }]);
  }

  function chooseMode(next: "steady" | "daily") {
    setClimbMode(next);
    setRows(next === "daily" ? dailyRows(startsOn, endsOn, rows) : [{ key: "steady", label: rows[0]?.label ?? "", payout: "", appliesOn: null }]);
  }

  function changeDates(start: string, end: string) {
    setStartsOn(start);
    setEndsOn(end);
    if (kind === "cumulative" && climbMode === "daily") setRows(dailyRows(start, end, rows));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await createPromotionAction({
      name,
      kind,
      startsOn,
      endsOn,
      climbMode: kind === "cumulative" ? climbMode : "",
      startAmount: kind === "cumulative" ? startAmount : "",
      climbAmount: kind === "cumulative" ? climbAmount : "",
      requirements: rows.map((row) => ({ label: row.label, payout: row.payout, appliesOn: row.appliesOn })),
    });
    setPending(false);
    if (!result.ok) {
      setError(copy.errors[result.error]);
      return;
    }
    onCreated(result.promotion);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-create-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="promotion-create-title" className="font-display text-lg font-semibold text-white">
          {copy.createTitle}
        </h2>
        <p className="mt-2 text-sm text-violet-100/70">{copy.createHint}</p>
        <div className="mt-4 grid gap-3">
          <Field label={copy.name}>
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.from}>
              <Input type="date" required value={startsOn} onChange={(event) => changeDates(event.target.value, endsOn)} className="[color-scheme:dark]" />
            </Field>
            <Field label={copy.to}>
              <Input type="date" required value={endsOn} onChange={(event) => changeDates(startsOn, event.target.value)} className="[color-scheme:dark]" />
            </Field>
          </div>
          <div className="grid gap-2">
            <SwitchButton pressed={kind === "instant"} onPressedChange={() => chooseKind("instant")}>
              {copy.instant}
            </SwitchButton>
            <SwitchButton pressed={kind === "cumulative"} onPressedChange={() => chooseKind("cumulative")}>
              {copy.cumulative}
            </SwitchButton>
            <SwitchButton pressed={kind === "besthand"} onPressedChange={() => chooseKind("besthand")}>
              {copy.besthand}
            </SwitchButton>
          </div>
          <p className="text-sm text-violet-100/60">{kind === "instant" ? copy.instantHint : kind === "besthand" ? copy.besthandHint : copy.cumulativeHint}</p>
          {kind === "cumulative" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={copy.opening}>
                  <Input inputMode="decimal" required value={startAmount} onChange={(event) => setStartAmount(event.target.value)} />
                </Field>
                <Field label={copy.climbsBy}>
                  <Input inputMode="decimal" required value={climbAmount} onChange={(event) => setClimbAmount(event.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SwitchButton pressed={climbMode === "steady"} onPressedChange={() => chooseMode("steady")}>
                  {copy.sameEveryDay}
                </SwitchButton>
                <SwitchButton pressed={climbMode === "daily"} onPressedChange={() => chooseMode("daily")}>
                  {copy.differentEachDay}
                </SwitchButton>
              </div>
            </>
          ) : null}
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {rows.map((row, index) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
                <Field label={row.appliesOn ? formatShort(row.appliesOn, locale) : copy.requirement}>
                  <Input
                    required
                    value={row.label}
                    placeholder={index === 0 ? (kind === "besthand" ? copy.besthand : "Straight flush") : ""}
                    onChange={(event) => setRows((current) => current.map((item) => (item.key === row.key ? { ...item, label: event.target.value } : item)))}
                  />
                </Field>
                {kind !== "cumulative" ? (
                  <Field label={copy.payout}>
                    <Input
                      inputMode="decimal"
                      required
                      value={row.payout}
                      placeholder={index === 0 ? "300" : ""}
                      onChange={(event) => setRows((current) => current.map((item) => (item.key === row.key ? { ...item, payout: event.target.value } : item)))}
                    />
                  </Field>
                ) : (
                  <span />
                )}
                {kind === "instant" && rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-10 rounded-full px-0"
                    aria-label={copy.remove}
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  >
                    <X size={14} aria-hidden="true" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
          {kind === "instant" ? (
            <Button
              type="button"
              variant="ghost"
              className="justify-start rounded-full"
              onClick={() => setRows((current) => [...current, { key: `row-${current.length}-${Date.now()}`, label: "", payout: "", appliesOn: null }])}
            >
              <Plus size={14} aria-hidden="true" />
              {copy.addRequirement}
            </Button>
          ) : null}
          {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={pending} className="rounded-full">
            {copy.save}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EntryDialog({
  promotion,
  entry,
  entries,
  copy,
  onClose,
  onSaved,
}: {
  promotion: PromotionRecord;
  entry: PromotionEntryInput;
  entries: PromotionEntryInput[];
  copy: PromotionCopy;
  onClose: () => void;
  onSaved: (entry: PromotionEntryInput) => void;
}) {
  const [date, setDate] = useState(entry.date);
  const [time, setTime] = useState(entry.time);
  const [requirementId, setRequirementId] = useState(entry.requirementId ?? promotion.requirements[0]?.id ?? "");
  const [won, setWon] = useState(entry.won);
  const [playerName, setPlayerName] = useState(entry.playerName);
  const [playerPhone, setPlayerPhone] = useState(entry.playerPhone);
  const [hand, setHand] = useState(entry.hand);
  const [settle, setSettle] = useState<Settle>(entry.settle ?? "call");
  const [comment, setComment] = useState(entry.comment);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const standing = promotion.kind === "cumulative" ? requirementFor(promotion, date) : null;
  const dayTaken = promotion.kind === "besthand" && entries.some((item) => item.promotionId === promotion.id && item.date === date && item.id !== entry.id);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextRequirement = promotion.kind === "cumulative" ? (standing?.id ?? "") : requirementId;
    setPending(true);
    const result = await savePromotionEntryAction({
      id: entry.id,
      promotionId: promotion.id,
      date,
      time,
      requirementId: nextRequirement,
      won: promotion.kind === "instant" ? true : won,
      comment,
      kind: promotion.kind,
      playerName,
      playerPhone,
      hand,
      settle,
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
        aria-labelledby="promotion-edit-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141226] p-5"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="promotion-edit-title" className="font-display text-lg font-semibold text-white">
          {copy.edit}
        </h2>
        <div className="mt-4 grid gap-3">
          <Field label={copy.date}>
            <Input type="date" required min={promotion.startsOn} max={promotion.endsOn} value={date} onChange={(event) => setDate(event.target.value)} className="[color-scheme:dark]" />
          </Field>
          <Field label={copy.time}>
            <TimeField label={copy.time} value={time} onChange={setTime} hourLabel={copy.hour} minuteLabel={copy.minute} />
          </Field>
          {promotion.kind === "besthand" ? (
            <>
              <Field label={copy.player}>
                <Input required value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
              </Field>
              <Field label={copy.phone}>
                <Input required={settle === "call"} type="tel" value={playerPhone} onChange={(event) => setPlayerPhone(event.target.value)} />
              </Field>
              <Field label={copy.hand}>
                <Input required value={hand} onChange={(event) => setHand(event.target.value)} />
              </Field>
              <div className="grid gap-2">
                <SwitchButton pressed={settle === "tonight"} onPressedChange={() => setSettle("tonight")}>
                  {copy.paidTonight}
                </SwitchButton>
                <SwitchButton pressed={settle === "call"} onPressedChange={() => setSettle("call")}>
                  {copy.callTomorrow}
                </SwitchButton>
                <SwitchButton pressed={settle === "settled"} onPressedChange={() => setSettle("settled")}>
                  {copy.paidLater}
                </SwitchButton>
              </div>
            </>
          ) : promotion.kind === "instant" ? (
            <Field label={copy.requirement}>
              <select
                required
                value={requirementId}
                onChange={(event) => setRequirementId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
              >
                {promotion.requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={copy.requirement}>
              <p className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white">{standing?.label || copy.none}</p>
            </Field>
          )}
          <Field label={copy.comment}>
            <Input value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          {promotion.kind === "cumulative" ? (
            <SwitchButton pressed={won} onPressedChange={setWon}>
              {copy.won}
            </SwitchButton>
          ) : null}
          {dayTaken ? <p className="text-sm text-amber-100">{copy.dayTaken}</p> : null}
          {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={pending || dayTaken} className="rounded-full">
            {copy.save}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
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
        aria-labelledby="promotion-confirm-title"
        aria-describedby="promotion-confirm-body"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141226] p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="promotion-confirm-title" className="font-display text-lg font-semibold text-white">
          {title}
        </h2>
        <p id="promotion-confirm-body" className="mt-2 text-sm text-violet-100/70">
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" className="rounded-full" onClick={onConfirm}>
            <Trash2 size={14} aria-hidden="true" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
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

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-3 py-3", highlight ? "border-violet-400/80 bg-violet-600/15" : "border-white/10 bg-[#141226]")}>
      <span className="block truncate text-xs text-violet-100/60">{label}</span>
      <span className="mt-1 block font-display text-base font-semibold leading-tight tabular-nums text-white">{value}</span>
    </div>
  );
}

function KeyStat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-b-0">
      <dt className="flex min-w-0 items-center gap-2 text-violet-100/70">
        <Icon size={15} className="shrink-0 text-violet-300" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="max-w-[12rem] truncate text-right font-semibold text-white">{value}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141226] px-3 py-3">
      <p className="truncate text-[11px] text-violet-100/55">{label}</p>
      <p className="truncate font-display text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function TrendChart({ points, locale }: { points: { date: string; amount: number }[]; locale: string }) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(1, ...points.map((point) => point.amount));
  const step = Math.pow(10, Math.floor(Math.log10(peak))) / 2 || 1;
  const max = Math.ceil(peak / step) * step;
  const width = 120;
  const height = 52;
  const left = 22;
  const coords = points.map((point, index) => {
    const x = points.length <= 1 ? left + (width - left) / 2 : left + (index / (points.length - 1)) * (width - left);
    const y = height - 4 - (point.amount / max) * (height - 8);
    return { x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const area = coords.length
    ? `${line} L ${coords[coords.length - 1]?.x.toFixed(2) ?? left} ${height} L ${coords[0]?.x.toFixed(2) ?? left} ${height} Z`
    : "";
  const ticks = [0, 1, 2, 3, 4].map((index) => Math.round((max / 4) * index));
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((index, position, all) => index >= 0 && all.indexOf(index) === position);
  const hovered = active !== null ? points[active] : null;

  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        onPointerMove={(event) => {
          if (points.length === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = rect.width === 0 ? left : ((event.clientX - rect.left) / rect.width) * width;
          const index = points.length <= 1 ? 0 : Math.round(((x - left) / (width - left)) * (points.length - 1));
          setActive(Math.max(0, Math.min(points.length - 1, index)));
        }}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id="promotion-trend-fill" x1="0" y1="0" x2="0" y2="1">
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
        {area ? <path d={area} fill="url(#promotion-trend-fill)" /> : null}
        {line ? <path d={line} fill="none" stroke="#c4b5fd" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.length <= 40
          ? coords.map((point, index) => <circle key={points[index]?.date ?? index} cx={point.x} cy={point.y} r="1.1" fill="#ddd6fe" />)
          : null}
        {active !== null && coords[active] ? <circle cx={coords[active].x} cy={coords[active].y} r="1.8" fill="#ffffff" stroke="#c4b5fd" strokeWidth="0.6" /> : null}
      </svg>
      <div className="flex justify-between pl-8 text-[11px] text-violet-100/45">
        {labels.map((index) => (
          <span key={points[index]?.date ?? index}>{points[index] ? formatShort(points[index].date, locale) : ""}</span>
        ))}
      </div>
      <p className="mt-1 text-right text-xs tabular-nums text-violet-100/70">
        {hovered ? `${formatShort(hovered.date, locale)} · ${money(hovered.amount, locale)}` : ""}
      </p>
    </figure>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-sm last:border-b-0">
      <dt className="text-violet-100/70">{label}</dt>
      <dd className="text-right font-semibold text-white">{value}</dd>
    </div>
  );
}

function dailyRows(start: string, end: string, current: DraftRow[]) {
  return eachDay(start, end).map((date) => {
    const existing = current.find((row) => row.appliesOn === date);
    return existing ?? { key: date, label: "", payout: "", appliesOn: date };
  });
}

function requirementIdFor(promotion: PromotionRecord, date: string, selected: string) {
  if (promotion.kind === "instant") {
    return promotion.requirements.some((requirement) => requirement.id === selected) ? selected : (promotion.requirements[0]?.id ?? "");
  }
  return requirementFor(promotion, date)?.id ?? promotion.requirements[0]?.id ?? "";
}

function inside(promotion: PromotionRecord, date: string) {
  return date >= promotion.startsOn && date <= promotion.endsOn;
}

function initialId(promotions: PromotionRecord[], today: string) {
  return promotions.find((promotion) => promotion.startsOn <= today && today <= promotion.endsOn)?.id ?? promotions[0]?.id ?? null;
}

function place(entries: PromotionEntryInput[], entry: PromotionEntryInput) {
  const previous = entries.find((item) => item.id === entry.id);
  return [...entries.filter((item) => item.id !== entry.id), { ...entry, createdAt: entry.createdAt || previous?.createdAt || new Date().toISOString() }];
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nowDraft() {
  const now = new Date();
  const minute = Math.floor(now.getMinutes() / 5) * 5;
  return { date: localToday(), time: `${pad(now.getHours())}:${pad(minute)}` };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function settleLabel(settle: Settle | null, copy: PromotionCopy) {
  if (settle === "tonight") return copy.paidTonight;
  if (settle === "settled") return copy.paidLater;
  return copy.toCall;
}

function formatDate(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatShort(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)));
}

function formatRange(start: string, end: string, locale: string) {
  return `${formatShort(start, locale)} – ${formatDate(end, locale)}`;
}

function money(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
