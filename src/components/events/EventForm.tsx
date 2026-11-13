"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PackageEditor,
  packagesToJsonPayload,
  type PackageDraft,
} from "@/components/events/PackageEditor";
import {
  createEvent,
  submitPublishedChangeRequest,
  updateDraftOrRejectedEvent,
} from "@/app/actions/events";

export type EventFormMode = "create" | "edit-draft" | "edit-rejected" | "change-request";

export interface EventFormValues {
  eventId?: string;
  title: string;
  description: string;
  eventTypeId: string;
  cityId: string;
  venue: string;
  season: string;
  startDate: string;
  endDate: string;
  expectedAudience: string;
  audienceNotes: string;
  visibility: "public" | "private";
  packages: PackageDraft[];
  hasAuthorityLetter: boolean;
}

interface Lookup {
  id: number;
  name: string;
}

interface Props {
  mode: EventFormMode;
  locale: string;
  initial: EventFormValues;
  cities: Lookup[];
  eventTypes: Lookup[];
}

export function EventForm({ mode, locale, initial, cities, eventTypes }: Props) {
  const t = useTranslations("events.form");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [eventTypeId, setEventTypeId] = useState(initial.eventTypeId);
  const [cityId, setCityId] = useState(initial.cityId);
  const [venue, setVenue] = useState(initial.venue);
  const [season, setSeason] = useState(initial.season);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [expectedAudience, setExpectedAudience] = useState(initial.expectedAudience);
  const [audienceNotes, setAudienceNotes] = useState(initial.audienceNotes);
  const [visibility, setVisibility] = useState<"public" | "private">(initial.visibility);
  const [packages, setPackages] = useState<PackageDraft[]>(initial.packages);
  const [letterFile, setLetterFile] = useState<File | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const fd = new FormData();
    if (initial.eventId) fd.set("eventId", initial.eventId);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("event_type_id", eventTypeId);
    fd.set("city_id", cityId);
    fd.set("venue", venue);
    fd.set("season", season);
    fd.set("start_date", startDate);
    fd.set("end_date", endDate);
    fd.set("expected_audience", expectedAudience);
    fd.set("audience_notes", audienceNotes);
    fd.set("visibility", visibility);
    fd.set("packages", packagesToJsonPayload(packages));
    if (letterFile) fd.set("authority_letter", letterFile);

    startTransition(async () => {
      const action =
        mode === "create"
          ? createEvent
          : mode === "change-request"
            ? submitPublishedChangeRequest
            : updateDraftOrRejectedEvent;

      const result = await action(fd);
      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      const id = result.eventId ?? initial.eventId;
      router.push(id ? `/${locale}/organizer/events/${id}` : `/${locale}/organizer/events`);
      router.refresh();
    });
  }

  const submitLabel =
    mode === "create"
      ? t("submitCreate")
      : mode === "change-request"
        ? t("submitChangeRequest")
        : t("submitSave");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{tCommon("error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "change-request" ? (
        <Alert>
          <AlertTitle>{t("changeRequestNoticeTitle")}</AlertTitle>
          <AlertDescription>{t("changeRequestNoticeBody")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">{t("title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isPending}
        />
        {fieldErrors["title"] ? (
          <p className="text-sm text-destructive">{fieldErrors["title"]?.join(" ")}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={isPending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("eventType")}</Label>
          <Select value={eventTypeId} onValueChange={setEventTypeId} disabled={isPending}>
            <SelectTrigger>
              <SelectValue placeholder={t("eventTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((et) => (
                <SelectItem key={et.id} value={String(et.id)}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("city")}</Label>
          <Select value={cityId} onValueChange={setCityId} disabled={isPending}>
            <SelectTrigger>
              <SelectValue placeholder={t("cityPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue">{t("venue")}</Label>
        <Input
          id="venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="season">{t("season")}</Label>
        <Input
          id="season"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder={t("seasonPlaceholder")}
          disabled={isPending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">{t("startDate")}</Label>
          <Input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">{t("endDate")}</Label>
          <Input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            disabled={isPending}
          />
          {fieldErrors["end_date"] ? (
            <p className="text-sm text-destructive">{fieldErrors["end_date"]?.join(" ")}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expected_audience">{t("expectedAudience")}</Label>
        <Input
          id="expected_audience"
          inputMode="numeric"
          value={expectedAudience}
          onChange={(e) => setExpectedAudience(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="audience_notes">{t("audienceNotes")}</Label>
        <Textarea
          id="audience_notes"
          value={audienceNotes}
          onChange={(e) => setAudienceNotes(e.target.value)}
          rows={2}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("visibility")}</Label>
        <Select
          value={visibility}
          onValueChange={(v) => setVisibility(v as "public" | "private")}
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">{t("visibilityPublic")}</SelectItem>
            <SelectItem value="private">{t("visibilityPrivate")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("visibilityHelp")}</p>
      </div>

      <p className="text-xs text-muted-foreground">{t("ticketingHidden")}</p>

      <PackageEditor packages={packages} onChange={setPackages} disabled={isPending} />

      <div className="space-y-2">
        <Label htmlFor="authority_letter">{t("authorityLetter")}</Label>
        <p className="text-xs text-muted-foreground">{t("authorityLetterHelp")}</p>
        {initial.hasAuthorityLetter ? (
          <p className="text-sm">{t("authorityLetterPresent")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("authorityLetterMissing")}</p>
        )}
        <Input
          id="authority_letter"
          type="file"
          accept="application/pdf"
          disabled={isPending}
          onChange={(e) => setLetterFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Button type="submit" disabled={isPending || !eventTypeId || !cityId}>
        {isPending ? tCommon("loading") : submitLabel}
      </Button>
    </form>
  );
}
