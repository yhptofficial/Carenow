"use client";

import { useMemo, useState } from "react";
import { Avatar, Button, Card, Chip, Notice, Sheet, useToast } from "@/components/ui";
import { AlertIcon, ChevronRightIcon, ShieldIcon } from "@/components/Icons";
import { CareNowError, useStore, type AccountRow } from "@/lib/store";
import { isLastAdmin } from "@/lib/rules";
import { initialsOf } from "@/lib/db";

/**
 * People and roles.
 *
 * In production this list is `select * from profiles` — patients, clinicians and
 * staff in one table, with `role` deciding what each of them can reach.
 *
 * There is one admin role and it is not tiered: every seat can verify
 * credentials, read the trail, and hand out or revoke seats. So the only rule
 * this screen enforces is the one about not sawing off the branch — the last
 * admin seat cannot be removed, because that would leave a platform with nobody
 * able to administer it and no in-app way back.
 *
 * Nothing here shows clinical data, which keeps the highest-privilege account in
 * the app out of patient records it has no reason to open.
 */
export function AccountsPanel() {
  const store = useStore();
  const [filter, setFilter] = useState<"all" | "seats" | "patients" | "doctors">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const directory = store.accountDirectory();

  const rows = useMemo(() => {
    if (filter === "seats") return directory.filter((r) => r.admin);
    if (filter === "patients") return directory.filter((r) => r.baseRole === "patient");
    if (filter === "doctors") return directory.filter((r) => r.baseRole === "doctor");
    return directory;
  }, [directory, filter]);

  const open = openId ? (directory.find((r) => r.id === openId) ?? null) : null;
  const seats = directory.filter((r) => r.admin).length;

  return (
    <>
      <div className="chip-row mb-4">
        <Chip label="Everyone" active={filter === "all"} onClick={() => setFilter("all")} />
        <Chip label={`Admins (${seats})`} active={filter === "seats"} onClick={() => setFilter("seats")} />
        <Chip label="Patients" active={filter === "patients"} onClick={() => setFilter("patients")} />
        <Chip label="Clinicians" active={filter === "doctors"} onClick={() => setFilter("doctors")} />
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <AccountCard row={row} onOpen={() => setOpenId(row.id)} />
          </li>
        ))}
      </ul>

      <Notice tone="info" icon={<ShieldIcon size={18} />} title="An admin seat is a master key">
        Any seat can read every health record and prescription on the platform, and can grant the
        same powers to anybody else. Treat it as handing over a key, not a staff badge — grant it to
        the fewest people who need it.
      </Notice>

      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? "Account and access" : undefined}
      >
        {open ? <AccountSheet key={open.id} row={open} onDone={() => setOpenId(null)} /> : null}
      </Sheet>
    </>
  );
}

function AccountCard({ row, onOpen }: { row: AccountRow; onOpen: () => void }) {
  const accent = row.admin ? "purple" : row.baseRole === "doctor" ? "teal" : "blue";

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-card px-3.5 py-3 text-left pressable"
      >
        <Avatar initials={initialsOf(row.fullName)} accent={accent} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{row.fullName}</span>
          <span className="block truncate text-[11px] text-ink-muted">{row.email ?? "No email"}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge label={baseRoleLabel(row)} tone="muted" />
            {row.admin ? <Badge label="Admin" tone="primary" /> : null}
            {row.baseRole === "doctor" ? (
              <Badge
                label={row.verified ? "Listed" : "Unverified"}
                tone={row.verified ? "primary" : "warn"}
              />
            ) : null}
            {row.baseRole === "patient" && row.bookings !== undefined ? (
              <Badge label={`${row.bookings} consultations`} tone="muted" />
            ) : null}
          </span>
        </span>
        <span className="text-ink-muted">
          <ChevronRightIcon size={18} />
        </span>
      </button>
    </Card>
  );
}

function Badge({ label, tone }: { label: string; tone: "primary" | "muted" | "warn" }) {
  const tones = {
    primary: "bg-primary-tint text-primary-dark",
    muted: "bg-canvas text-ink-muted",
    warn: "bg-[#FDF3E3] text-warning",
  }[tone];
  return <span className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${tones}`}>{label}</span>;
}

function baseRoleLabel(row: AccountRow): string {
  if (row.baseRole === "doctor") return "Clinician";
  if (row.baseRole === "staff") return "Operations";
  return "Patient";
}

function AccountSheet({ row, onDone }: { row: AccountRow; onDone: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const holdsSeat = Boolean(row.admin);
  const lastSeat = isLastAdmin(store.accountDirectory().filter((r) => r.admin), row.id);

  function run(fn: () => void, message: string) {
    setError(null);
    try {
      fn();
      toast(message, "ok");
      onDone();
    } catch (e) {
      // CareNowError carries the actionable half in `hint`; anything else is a bug.
      setError(e instanceof CareNowError ? (e.hint ?? e.message) : "Something went wrong.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3.5">
        <Avatar
          initials={initialsOf(row.fullName)}
          accent={row.admin ? "purple" : row.baseRole === "doctor" ? "teal" : "blue"}
          size={48}
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{row.fullName}</p>
          <p className="truncate text-[12px] text-ink-muted">{row.email ?? "No email on file"}</p>
          <p className="truncate text-[11px] text-ink-muted">
            {baseRoleLabel(row)}
            {row.baseRole === "doctor"
              ? row.verified
                ? " · listed to patients"
                : " · not yet verified"
              : ""}
          </p>
        </div>
      </div>

      {holdsSeat ? (
        <>
          <div className="rounded-2xl border border-line p-3.5">
            <p className="text-[12px] text-ink-muted">Holds an admin seat</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">
              Full console access
            </p>
            <p className="mt-1 text-[11px] leading-5 text-ink-muted">
              Granted{" "}
              {new Date(row.admin!.grantedAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {row.admin!.grantedBy ? ` by ${row.admin!.grantedBy}` : " at CareNow launch"}
            </p>
          </div>

          <ul className="space-y-1.5 rounded-2xl bg-canvas p-3.5">
            {[
              "Review and decide clinician credentials",
              "Read the platform audit trail",
              "Grant and revoke admin seats",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12px] leading-5 text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>

          {lastSeat ? (
            <Notice tone="warn" icon={<AlertIcon size={17} />} title="The only admin">
              Removing this seat would leave nobody able to administer CareNow, so the store refuses
              it. Give somebody else a seat first.
            </Notice>
          ) : null}

          <Button
            variant="danger"
            full
            disabled={lastSeat}
            onClick={() =>
              run(() => store.revokeAdmin(row.id), `${row.fullName} no longer has console access`)
            }
          >
            Revoke console access
          </Button>
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-line p-3.5">
            <p className="text-[12px] text-ink-muted">Give this account a seat</p>
            <p className="mt-1 text-[12px] leading-5 text-ink-muted">
              They will be able to verify clinician credentials, read the audit trail, and hand out
              seats to anyone else.
            </p>
          </div>

          <Button
            full
            onClick={() =>
              run(
                () => store.grantAdmin({ accountId: row.id }),
                `${row.fullName} can now sign in to the console`,
              )
            }
          >
            Grant admin access
          </Button>
        </>
      )}

      {error ? (
        <Notice tone="danger" icon={<AlertIcon size={17} />}>
          {error}
        </Notice>
      ) : null}

      <Button variant="ghost" full onClick={onDone}>
        Close
      </Button>
    </div>
  );
}
