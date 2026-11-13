"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRupees } from "@/lib/utils";

export type PackageDraft = {
  key: string;
  id?: string;
  name: string;
  /** Rupees as typed in the UI (converted to paise on submit). */
  priceRupees: string;
  deliverables: string;
  slotsTotal: string;
};

interface Props {
  packages: PackageDraft[];
  onChange: (next: PackageDraft[]) => void;
  disabled?: boolean;
}

export function PackageEditor({ packages, onChange, disabled }: Props) {
  const t = useTranslations("events.packages");

  function update(index: number, patch: Partial<PackageDraft>) {
    const next = packages.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next);
  }

  function add() {
    onChange([
      ...packages,
      {
        key: `new-${Date.now()}`,
        name: "",
        priceRupees: "",
        deliverables: "",
        slotsTotal: "",
      },
    ]);
  }

  function remove(index: number) {
    if (packages.length <= 1) return;
    onChange(packages.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          {t("add")}
        </Button>
      </div>

      {packages.map((pkg, index) => {
        const paise = Math.round(Number(pkg.priceRupees.replace(/,/g, "") || 0) * 100);
        return (
          <div key={pkg.key} className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t("itemLabel", { n: index + 1 })}
              </p>
              {packages.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={disabled}
                >
                  {t("remove")}
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pkg-name-${pkg.key}`}>{t("name")}</Label>
              <Input
                id={`pkg-name-${pkg.key}`}
                value={pkg.name}
                onChange={(e) => update(index, { name: e.target.value })}
                disabled={disabled}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pkg-price-${pkg.key}`}>{t("priceRupees")}</Label>
              <Input
                id={`pkg-price-${pkg.key}`}
                inputMode="decimal"
                value={pkg.priceRupees}
                onChange={(e) => update(index, { priceRupees: e.target.value })}
                disabled={disabled}
                required
              />
              {Number.isFinite(paise) && paise >= 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("pricePreview", { amount: formatRupees(paise) })}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pkg-del-${pkg.key}`}>{t("deliverables")}</Label>
              <Textarea
                id={`pkg-del-${pkg.key}`}
                value={pkg.deliverables}
                onChange={(e) => update(index, { deliverables: e.target.value })}
                disabled={disabled}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pkg-slots-${pkg.key}`}>{t("slots")}</Label>
              <Input
                id={`pkg-slots-${pkg.key}`}
                inputMode="numeric"
                value={pkg.slotsTotal}
                onChange={(e) => update(index, { slotsTotal: e.target.value })}
                disabled={disabled}
                placeholder={t("slotsOptional")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function packagesToJsonPayload(packages: PackageDraft[]): string {
  return JSON.stringify(
    packages.map((p) => {
      const price = Math.round(Number(String(p.priceRupees).replace(/,/g, "")) * 100);
      const slotsRaw = p.slotsTotal.trim();
      const slots =
        slotsRaw === "" ? null : Number.isFinite(Number(slotsRaw)) ? Number(slotsRaw) : null;
      return {
        ...(p.id ? { id: p.id } : {}),
        name: p.name.trim(),
        price_paise: Number.isFinite(price) ? price : -1,
        deliverables: p.deliverables.trim() || null,
        slots_total: slots && slots > 0 ? slots : null,
      };
    }),
  );
}
