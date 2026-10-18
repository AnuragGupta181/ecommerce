"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { downloadHref } from "@/lib/download-href";

const PRESETS = [
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Choose dates" },
] as const;

type Target = { label: string; path: string };

/** Excel workbooks stream from the backend through the portal's download route. */
export function ReportPicker({ base, targets, contents }: { base: "/download" | "/vendor/download"; targets: Target[]; contents: string }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["value"]>("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState(targets[0]?.path ?? "");
  const ready = preset !== "custom" || (from && to && from <= to);
  const href = downloadHref(base, target, { preset, from: preset === "custom" ? from : undefined, to: preset === "custom" ? to : undefined });

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-ink-700">{contents}</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {targets.length > 1 ? (
            <Field label="Report" htmlFor="report-target">
              <Select id="report-target" value={target} onChange={(event) => setTarget(event.target.value)}>
                {targets.map((option) => (
                  <option key={option.path} value={option.path}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Period" htmlFor="report-preset">
            <Select id="report-preset" value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)}>
              {PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          {preset === "custom" ? (
            <>
              <Field label="From" htmlFor="report-from">
                <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="To" htmlFor="report-to">
                <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </Field>
            </>
          ) : null}
        </div>
        <div>
          <a
            href={ready ? href : undefined}
            aria-disabled={!ready}
            className={`inline-flex h-10 items-center gap-2 rounded-control bg-brand-500 px-4 font-semibold text-ink-900 hover:bg-brand-400 ${ready ? "" : "pointer-events-none opacity-50"}`}
          >
            <Download size={16} /> Download Excel
          </a>
        </div>
      </div>
    </Card>
  );
}
