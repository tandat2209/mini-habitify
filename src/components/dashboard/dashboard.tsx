"use client";
import Link from "next/link";
import { Cable } from "lucide-react";
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
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { signOut } from "@/lib/auth/actions";
import { isScheduled, progress } from "@/features/tracker-engine/engine";
import { TemplateLibrary } from "@/components/activity-templates/template-library";
import type {
  ActivityTracker,
  ActivityLog,
  TemplateData,
} from "@/features/activity-templates/types";
import type { Preferences } from "@/features/trackers/validation";
import { SummaryWidget, RecentWidget } from "./widgets";
import type { WidgetKind } from "@/features/themes/presets";
import { Activity } from "./activity";
import { TrackerCard } from "@/components/trackers/tracker-card";
import { TrackerForm } from "@/components/trackers/tracker-form";
import { TrackerHistory } from "@/components/trackers/tracker-history";
import { AppearanceScope } from "@/components/appearance/appearance-scope";
import { InstallApp } from "@/components/pwa/install-app";
import { Appearance } from "@/components/appearance/appearance";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
interface Data extends TemplateData {
  email: string;
  timezone: string;
  today: string;
  trackers: ActivityTracker[];
  logs: ActivityLog[];
  preferences: Preferences;
}
export function Dashboard({ data }: { data: Data }) {
  const [preview, setPreview] = useState(data.preferences);
  const [appearance, setAppearance] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
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
  const visibleWidgets = preview.widget_order.filter((kind) =>
    kind === "summary"
      ? preview.show_summary
      : kind === "activity"
        ? preview.show_activity
        : preview.show_recent,
  );
  function renderWidget(kind: WidgetKind) {
    return (
      <div data-widget={kind} key={kind}>
        {kind === "summary" ? (
          <SummaryWidget
            completed={completed}
            goalCount={goals.length}
            trackerCount={active.length}
            checkIns={
              data.logs.filter((l) => l.tracking_date === data.today).length
            }
          />
        ) : kind === "activity" ? (
          <Activity
            trackers={active}
            logs={data.logs}
            today={data.today}
            presentation={preview.presentation}
          />
        ) : (
          <RecentWidget data={data} />
        )}
      </div>
    );
  }
  return (
    <AppearanceScope
      theme={preview.theme}
      primaryColor={preview.primary_color}
      layout={preview.layout}
      presentation={preview.presentation}
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
            <Link href="/settings/connections" aria-label="Connected apps">
              <Cable size={18} />
              <span>Connected apps</span>
            </Link>
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
              onClick={() => setTemplatesOpen(true)}
            >
              Templates
            </Button>
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
          <div className="widget-overview">
            {visibleWidgets.slice(0, 1).map(renderWidget)}
          </div>
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
                    templateData={data}
                    logs={data.logs}
                    today={data.today}
                    onDetails={() => setDetailId(t.id)}
                  />
                ),
              )}
            </div>
          )}
          <div className="lower-grid">
            {visibleWidgets.slice(1).map(renderWidget)}
          </div>
          <p className="footer-note">
            <Check size={12} />
            Your progress is saved in your space. <span>· {data.timezone}</span>
          </p>
          <InstallApp />
        </main>
      </div>
      {create && (
        <TrackerForm
          open
          theme={preview.theme}
          templates={data.templates}
          onOpenChange={setCreate}
        />
      )}{" "}
      {edit && (
        <TrackerForm
          key={edit.id}
          open
          theme={preview.theme}
          tracker={edit}
          templates={data.templates}
          onOpenChange={(open) => {
            if (!open) setEditId(undefined);
          }}
        />
      )}
      {detail && (
        <TrackerHistory
          tracker={detail}
          templateData={data}
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
      {templatesOpen && (
        <TemplateLibrary
          data={data}
          theme={preview.theme}
          onClose={() => setTemplatesOpen(false)}
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
    </AppearanceScope>
  );
}
