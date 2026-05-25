"use client";

import { AlertCircle, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import type {
  HelpCommunityThread,
  HelpContactSettings,
} from "@/lib/help/types";

import { saveCommunity, saveContact, saveTrending } from "./actions";

type Props = {
  trending: string[];
  contact: HelpContactSettings;
  community: HelpCommunityThread[];
};

export function SettingsEditor({ trending, contact, community }: Props) {
  return (
    <div className="space-y-6">
      <TrendingPanel initial={trending} />
      <ContactPanel initial={contact} />
      <CommunityPanel initial={community} />
    </div>
  );
}

function FlashStrip({
  pending,
  okMsg,
  error,
}: {
  pending: boolean;
  okMsg: string | null;
  error: string | null;
}) {
  if (pending) return null;
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{" "}
        <span>{error}</span>
      </div>
    );
  }
  if (okMsg) {
    return (
      <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{" "}
        <span>{okMsg}</span>
      </div>
    );
  }
  return null;
}

function TrendingPanel({ initial }: { initial: string[] }) {
  const [list, setList] = useState<string[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await saveTrending({
        trending: list.filter((s) => s.trim()),
      });
      if (!res.ok) setError(res.error);
      else setOkMsg("Trending pills saved.");
    });
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Hero
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Trending searches
          </h3>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      </header>

      <p className="mt-2 text-[12.5px] text-brand-mute">
        The pills shown next to the search bar. Max 10. Each click pre-fills the
        query.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {list.map((value, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) =>
                setList((p) =>
                  p.map((v, i) => (i === idx ? e.target.value : v)),
                )
              }
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setList((p) => p.filter((_, i) => i !== idx))}
              className="rounded border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {list.length < 10 ? (
        <button
          type="button"
          onClick={() => setList((p) => [...p, ""])}
          className="mt-3 inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-2.5 py-1 text-xs font-medium text-brand-primary hover:bg-brand-accent/40"
        >
          <Plus className="h-3 w-3" /> Add pill
        </button>
      ) : null}

      <div className="mt-3">
        <FlashStrip pending={pending} okMsg={okMsg} error={error} />
      </div>
    </section>
  );
}

function ContactPanel({ initial }: { initial: HelpContactSettings }) {
  const [liveChat, setLiveChat] = useState(initial.live_chat_online);
  const [callback, setCallback] = useState(initial.callback_enabled);
  const [email, setEmail] = useState(initial.support_email);
  const [median, setMedian] = useState(initial.median_response_minutes);
  const [memberCount, setMemberCount] = useState(
    initial.community_member_count,
  );
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await saveContact({
        liveChatOnline: liveChat,
        callbackEnabled: callback,
        supportEmail: email,
        medianResponseMinutes: median,
        communityMemberCount: memberCount,
      });
      if (!res.ok) setError(res.error);
      else setOkMsg("Contact settings saved.");
    });
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Contact
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Live chat, email, community
          </h3>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={liveChat}
            onChange={(e) => setLiveChat(e.target.checked)}
            className="rounded border-brand-line"
          />
          Live chat online
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={callback}
            onChange={(e) => setCallback(e.target.checked)}
            className="rounded border-brand-line"
          />
          Callback option enabled
        </label>
        <Field label="Support email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
          />
        </Field>
        <Field label="Median response (minutes)">
          <input
            type="number"
            min={1}
            max={180}
            value={median}
            onChange={(e) => setMedian(Number(e.target.value))}
            className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
          />
        </Field>
        <Field label="Community member count">
          <input
            type="number"
            min={0}
            value={memberCount}
            onChange={(e) => setMemberCount(Number(e.target.value))}
            className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
          />
        </Field>
      </div>

      <div className="mt-3">
        <FlashStrip pending={pending} okMsg={okMsg} error={error} />
      </div>
    </section>
  );
}

function CommunityPanel({ initial }: { initial: HelpCommunityThread[] }) {
  const [list, setList] = useState<HelpCommunityThread[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<HelpCommunityThread>) {
    setList((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function save() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await saveCommunity({ community: list });
      if (!res.ok) setError(res.error);
      else setOkMsg("Community threads saved.");
    });
  }

  function addRow() {
    setList((p) => [
      ...p,
      {
        title: "",
        author: "",
        replies: 0,
        ago: "today",
        initials: "??",
        accent: "secondary",
      },
    ]);
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Community
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Featured forum threads
          </h3>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      </header>

      <div className="mt-4 space-y-3">
        {list.map((t, idx) => (
          <div
            key={idx}
            className="rounded border border-brand-line bg-brand-light/40 p-3"
          >
            <div className="grid gap-2 lg:grid-cols-[1fr_200px]">
              <input
                value={t.title}
                onChange={(e) => update(idx, { title: e.target.value })}
                placeholder="Thread title"
                className="rounded border border-brand-line bg-white px-2 py-1.5 text-sm font-medium text-brand-ink focus:border-brand-primary focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={t.author}
                  onChange={(e) => update(idx, { author: e.target.value })}
                  placeholder="Author"
                  className="rounded border border-brand-line bg-white px-2 py-1.5 text-sm focus:border-brand-primary focus:outline-none"
                />
                <input
                  value={t.initials}
                  onChange={(e) =>
                    update(idx, {
                      initials: e.target.value.slice(0, 2).toUpperCase(),
                    })
                  }
                  placeholder="NN"
                  maxLength={2}
                  className="rounded border border-brand-line bg-white px-2 py-1.5 text-center font-mono text-sm focus:border-brand-primary focus:outline-none"
                />
                <input
                  type="number"
                  min={0}
                  value={t.replies}
                  onChange={(e) =>
                    update(idx, { replies: Number(e.target.value) })
                  }
                  placeholder="Replies"
                  className="num rounded border border-brand-line bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-primary focus:outline-none"
                />
                <input
                  value={t.ago}
                  onChange={(e) => update(idx, { ago: e.target.value })}
                  placeholder="2h"
                  className="rounded border border-brand-line bg-white px-2 py-1.5 text-sm focus:border-brand-primary focus:outline-none"
                />
                <select
                  value={t.accent}
                  onChange={(e) =>
                    update(idx, {
                      accent: e.target.value as HelpCommunityThread["accent"],
                    })
                  }
                  className="col-span-2 rounded border border-brand-line bg-white px-2 py-1.5 text-sm capitalize"
                >
                  <option value="primary">primary</option>
                  <option value="secondary">secondary</option>
                  <option value="mute">mute</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setList((p) => p.filter((_, i) => i !== idx))}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-700 hover:underline"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-2.5 py-1 text-xs font-medium text-brand-primary hover:bg-brand-accent/40"
      >
        <Plus className="h-3 w-3" /> Add thread
      </button>

      <div className="mt-3">
        <FlashStrip pending={pending} okMsg={okMsg} error={error} />
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
