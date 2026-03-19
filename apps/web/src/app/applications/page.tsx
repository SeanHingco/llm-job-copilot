"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ✅ IMPORTANT: adjust this import path to your actual api.ts location
// Common options:
// - import { apiFetch } from "@/lib/api";
// - import { apiFetch } from "../../lib/api";
import { apiFetch } from "@/lib/api";

type ApplicationStatus =
  | "drafting"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "archived";

type JobApplication = {
  id: string;
  user_id: string;

  company_name: string;
  job_title: string;
  job_link?: string | null;

  status: ApplicationStatus;
  notes?: string | null;

  applied_at?: string | null;
  last_activity_at?: string | null;

  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  "drafting",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "archived",
];

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong";
}

async function loadApplications(limit: number, status?: ApplicationStatus) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (status) qs.set("status", status);

  const res = await apiFetch<JobApplication[]>(`/applications?${qs.toString()}`);
  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to fetch applications");
  }
  return res.data || [];
}

async function patchApplication(id: string, patch: Partial<JobApplication>) {
  const res = await apiFetch<JobApplication>(`/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to update application");
  }
  return res.data;
}

async function deleteApplication(id: string) {
  const res = await apiFetch<{ success: boolean; deleted_id: string }>(`/applications/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Failed to delete application");
  }
  return res.data;
}


export default function ApplicationsPage() {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [search, setSearch] = useState("");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (a.company_name || "").toLowerCase().includes(q) ||
        (a.job_title || "").toLowerCase().includes(q) ||
        (a.job_link || "").toLowerCase().includes(q)
      );
    });
  }, [apps, statusFilter, search]);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await loadApplications(200, statusFilter === "all" ? undefined : statusFilter);
      setApps(data);
    } catch (e: unknown) {
      console.error(e);
      setErr(getErrorMessage(e) || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateStatus = async (id: string, nextStatus: ApplicationStatus) => {
    setSavingId(id);
    setErr(null);

    // optimistic UI update
    setApps((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: nextStatus, last_activity_at: new Date().toISOString() } : a
      )
    );

    try {
      const updated = await patchApplication(id, { status: nextStatus });
      if (updated?.id) {
        setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
    } catch (e: unknown) {
      console.error(e);
      setErr(getErrorMessage(e) || "Failed to update status");
      await refresh();
    } finally {
      setSavingId(null);
    }
  };

  const onDelete = async (id: string) => {
    const ok = window.confirm("Delete this application? This can’t be undone.");
    if (!ok) return;

    setDeletingId(id);
    setErr(null);

    // optimistic remove
    const prev = apps;
    setApps((p) => p.filter((a) => a.id !== id));

    try {
        await deleteApplication(id);
    } catch (e: any) {
        console.error(e);
        setErr(getErrorMessage(e) || "Failed to delete application");
        setApps(prev);
    } finally {
        setDeletingId(null);
    }
    };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Application Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Applications created from your Resume Bender drafts.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, title, link…"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm sm:w-72"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ApplicationStatus | "all")
            }
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={refresh}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    No applications found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.company_name || "Unknown Company"}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">{a.job_title || "Unknown Role"}</div>
                      {a.notes ? (
                        <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{a.notes}</div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={a.status}
                          onChange={(e) => updateStatus(a.id, e.target.value as ApplicationStatus)}
                          disabled={savingId === a.id}
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        {savingId === a.id ? (
                          <span className="text-xs text-muted-foreground">Saving…</span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.last_activity_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.created_at)}</td>

                    <td className="px-4 py-3">
                      {a.job_link ? (
                        <a
                          href={a.job_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-indigo-600 hover:underline dark:text-indigo-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                        <button
                            onClick={() => onDelete(a.id)}
                            disabled={deletingId === a.id}
                            className="rounded-md border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
                        >
                            {deletingId === a.id ? "Deleting…" : "Delete"}
                        </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{filtered.length}</span> /{" "}
            <span className="font-medium text-foreground">{apps.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/history" className="hover:underline">
              Draft history
            </Link>
            <Link href="/draft" className="hover:underline">
              New draft
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
