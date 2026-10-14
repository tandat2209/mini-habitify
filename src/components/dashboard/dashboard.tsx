"use client";
import { useState } from "react";
import {
  CalendarDays,
  LayoutGrid,
  Archive,
  Palette,
  Plus,
  Leaf,
  LogOut,
  Sun,
  Check,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { signOut } from "@/lib/auth/actions";
import {
  isScheduled,
  progress,
  type Tracker,
  type Log,
} from "@/features/tracker-engine/engine";
import type { Preferences } from "@/features/trackers/validation";
import { Activity, ProgressRing } from "./activity";
import { TrackerCard } from "@/components/trackers/tracker-card";
import { TrackerForm } from "@/components/trackers/tracker-form";
import { TrackerHistory } from "@/components/trackers/tracker-history";
import { Appearance } from "@/components/appearance/appearance";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
interface Data {
  email: string;
  timezone: string;
  today: string;
  trackers: Tracker[];
  logs: Log[];
  preferences: Preferences;
}
export function Dashboard({ data }: { data: Data }) {
  const [preview, setPreview] = useState(data.preferences);
  const [appearance, setAppearance] = useState(false);
  const [create, setCreate] = useState(false);
  const [editId, setEditId] = useState<string>();
  const [detailId, setDetailId] = useState<string>();
  const [view, setView] = useState<"today" | "all" | "archive">("today");
  const active = data.trackers.filter((t) => !t.archived_at);
  const scheduled = active.filter((t) => isScheduled(t, data.today));
  const goals = scheduled.filter((t) => t.target !== null);
  const completed = goals.filter(
    (t) => progress(t, data.logs, data.today).complete,
  ).length;
  const list =
    view === "today"
      ? scheduled
      : view === "archive"
        ? data.trackers.filter((t) => t.archived_at)
        : active;
  const date = new Date(`${data.today}T12:00:00Z`);
  const name = data.email.split("@")[0];
  const detail = data.trackers.find((t) => t.id === detailId);
  const edit = data.trackers.find((t) => t.id === editId);
  const recent = [...data.logs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  return (
    <div
      className="app"
      data-theme={preview.theme}
      data-layout={preview.layout}
      data-presentation={preview.presentation}
    >
      <aside className="sidebar">
        <Brand />
        <div>
          <p className="sidebar-label mb-4">Your space</p>
          <nav className="nav" aria-label="Main navigation">
            <button
              aria-label="Today"
              onClick={() => setView("today")}
              aria-current={view === "today" ? "page" : undefined}
            >
              <Sun size={18} />
              <span>Today</span>
            </button>
            <button
              aria-label="All trackers"
              onClick={() => setView("all")}
              aria-current={view === "all" ? "page" : undefined}
            >
              <LayoutGrid size={18} />
              <span>All trackers</span>
            </button>
            <button
              aria-label="Archive"
              onClick={() => setView("archive")}
              aria-current={view === "archive" ? "page" : undefined}
            >
              <Archive size={18} />
              <span>Archive</span>
            </button>
            <button
              onClick={() => setAppearance(true)}
              aria-label="Customize your space"
            >
              <Palette size={18} />
              <span>Make it yours</span>
            </button>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={20} className="mb-3" />
            <strong className="text-foreground">A little is enough.</strong>
            <br />
            Good days grow from small things. Go at your own pace.
          </div>
          <div className="account">
            <div className="avatar">{name[0]?.toUpperCase()}</div>
            <div className="account-text">
              <strong>{name}</strong>
              <div className="muted truncate">{data.email}</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="date-label">
            <CalendarDays size={15} />
            {date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAppearance(true)}
            >
              <Palette data-icon="inline-start" />
              Appearance
            </Button>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="Sign out"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        <main className="main">
          <section className="hero">
            <div>
              <p className="eyebrow">
                {preview.presentation === "developer"
                  ? "~/your-everyday"
                  : `Hello, ${name.length > 24 ? name.slice(0, 24) + "…" : name}`}
              </p>
              <h1>A little progress, every day.</h1>
              <p>
                {preview.presentation === "playful"
                  ? "Pick a little step. Give it a try. Make today your own."
                  : "Make time for what matters. The small things count."}
              </p>
            </div>
            <div className="hero-decoration" aria-hidden>
              <Leaf size={54} strokeWidth={1.2} />
            </div>
          </section>
          <section className="summary" aria-label="Today’s summary">
            <div className="summary-cell">
              <ProgressRing
                ratio={goals.length ? completed / goals.length : 0}
              />
              <div>
                <div className="summary-value">
                  {completed}
                  <span className="muted text-lg"> / {goals.length}</span>
                </div>
                <div className="summary-caption">goals complete today</div>
              </div>
            </div>
            <div className="summary-cell">
              <div>
                <div className="summary-value">{active.length}</div>
                <div className="summary-caption">
                  things you’re making time for
                </div>
              </div>
            </div>
            <div className="summary-cell">
              <div>
                <div className="summary-value">
                  {
                    data.logs.filter((l) => l.tracking_date === data.today)
                      .length
                  }
                </div>
                <div className="summary-caption">check-ins today</div>
              </div>
            </div>
          </section>
          <div className="section-head">
            <div>
              <h2>
                {view === "today"
                  ? "Your today"
                  : view === "all"
                    ? "All your trackers"
                    : "A little history"}
              </h2>
              <p>
                {view === "today"
                  ? "One small step at a time."
                  : view === "all"
                    ? "Everything you’re building a rhythm around."
                    : "Archived trackers keep their stories."}
              </p>
            </div>
            <div className="section-tools">
              <Button size="sm" onClick={() => setCreate(true)}>
                <Plus data-icon="inline-start" />
                New tracker
              </Button>
            </div>
          </div>
          {list.length === 0 ? (
            <Empty className="panel empty-state">
              <EmptyHeader>
                <div className="empty-illustration">
                  <Leaf size={36} strokeWidth={1.4} />
                </div>
                <EmptyTitle>
                  {view === "archive"
                    ? "No archived trackers"
                    : active.length
                      ? "A little breathing room."
                      : "What would you like to make time for?"}
                </EmptyTitle>
                <EmptyDescription>
                  {view === "archive"
                    ? "Your archived trackers will appear here."
                    : active.length
                      ? "Nothing is scheduled for today. You can still browse all your trackers."
                      : "A chapter of a book. A glass of water. A moment outside. Start with something small that matters to you."}
                </EmptyDescription>
              </EmptyHeader>
              {view !== "archive" && (
                <EmptyContent>
                  <Button
                    onClick={() =>
                      active.length ? setView("all") : setCreate(true)
                    }
                  >
                    {active.length
                      ? "See all trackers"
                      : "Create your first tracker"}
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="tracker-grid">
              {list.map((t) =>
                t.archived_at ? (
                  <article className="tracker-card" key={t.id}>
                    <h3>{t.name}</h3>
                    <p className="muted">Archived · history preserved</p>
                    <Button variant="outline" onClick={() => setDetailId(t.id)}>
                      View history
                    </Button>
                  </article>
                ) : (
                  <TrackerCard
                    key={t.id}
                    tracker={t}
                    logs={data.logs}
                    today={data.today}
                    onDetails={() => setDetailId(t.id)}
                  />
                ),
              )}
            </div>
          )}
          <div className="lower-grid">
            {preview.show_activity && (
              <Activity
                trackers={active}
                logs={data.logs}
                today={data.today}
                presentation={preview.presentation}
              />
            )}
            <section className="panel">
              <div className="panel-title">
                <h2>Little moments, lately</h2>
                <Clock3 size={15} className="muted" />
              </div>
              {recent.length === 0 ? (
                <p className="muted text-sm leading-7">
                  Your check-ins will find a home here.
                  <br />
                  Every little moment counts.
                </p>
              ) : (
                recent.map((log) => {
                  const t = data.trackers.find((t) => t.id === log.tracker_id);
                  return (
                    <div className="activity-row" key={log.id}>
                      <span className="activity-dot" />
                      <div>
                        <strong>{t?.name || "Tracker"}</strong>
                        <div className="muted mt-1">
                          {t?.type === "habit"
                            ? "Checked in"
                            : `${t?.type === "duration" ? log.value / 60 : log.value} ${t?.type === "duration" ? "min" : t?.unit || ""}`}
                        </div>
                      </div>
                      <time>
                        {log.tracking_date === data.today
                          ? "Today"
                          : log.tracking_date}
                      </time>
                    </div>
                  );
                })
              )}
            </section>
          </div>
          <p className="footer-note">
            <Check size={12} />
            Your progress is saved in your space. <span>· {data.timezone}</span>
          </p>
        </main>
      </div>
      {create && (
        <TrackerForm open theme={preview.theme} onOpenChange={setCreate} />
      )}{" "}
      {edit && (
        <TrackerForm
          key={edit.id}
          open
          theme={preview.theme}
          tracker={edit}
          onOpenChange={(open) => {
            if (!open) setEditId(undefined);
          }}
        />
      )}
      {detail && (
        <TrackerHistory
          tracker={detail}
          logs={data.logs}
          today={data.today}
          theme={preview.theme}
          onClose={() => setDetailId(undefined)}
          onEdit={() => {
            setEditId(detail.id);
            setDetailId(undefined);
          }}
        />
      )}
      {appearance && (
        <Appearance
          saved={data.preferences}
          preview={preview}
          onPreview={setPreview}
          onClose={() => setAppearance(false)}
        />
      )}
    </div>
  );
}
