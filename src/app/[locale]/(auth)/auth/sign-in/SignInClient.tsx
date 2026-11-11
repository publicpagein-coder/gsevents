"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestOtp, verifyOtp } from "@/app/actions/auth";

type Step = "phone" | "role" | "otp";
type Role = "organizer" | "sponsor";

interface SignInClientProps {
  /** Current locale — used for post-auth redirect. */
  locale: string;
}

/**
 * Two-to-three step sign-in / sign-up flow.
 *
 * Returning users:  phone → OTP
 * New users:        phone → role choice → OTP (role is sent with signInWithOtp)
 *
 * Role metadata is included in the requestOtp (signInWithOtp) call so that
 * the handle_new_user DB trigger can read raw_user_meta_data->>'role' when
 * it creates the profiles row. FR-AUTH-01, FR-AUTH-02, FR-AUTH-03.
 */
export function SignInClient({ locale }: SignInClientProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Step 1: Phone entered → for new users go to role choice, else send OTP
  // -------------------------------------------------------------------------
  function handlePhoneNext() {
    setError(null);
    if (isNewUser) {
      // Go to role selection before sending OTP.
      setStep("role");
    } else {
      sendOtp(phone, undefined);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2 (new users): Role chosen → send OTP with role metadata
  // -------------------------------------------------------------------------
  function handleRoleConfirm() {
    if (!selectedRole) {
      setError("Please choose a role to continue.");
      return;
    }
    setError(null);
    sendOtp(phone, selectedRole);
  }

  function sendOtp(phoneNumber: string, role: Role | undefined) {
    startTransition(async () => {
      const result = await requestOtp(phoneNumber, role);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStep("otp");
    });
  }

  // -------------------------------------------------------------------------
  // Step 3: Verify OTP
  // -------------------------------------------------------------------------
  function handleVerifyOtp() {
    setError(null);
    startTransition(async () => {
      const result = await verifyOtp(phone, otp);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/${locale}/`);
      router.refresh();
    });
  }

  // -------------------------------------------------------------------------
  // Resend OTP
  // -------------------------------------------------------------------------
  function handleResend() {
    setError(null);
    setOtp("");
    startTransition(async () => {
      const result = await requestOtp(phone, isNewUser ? (selectedRole ?? undefined) : undefined);
      if (!result.success) {
        setError(result.error);
      } else {
        setInfo(t("otpResent"));
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (step === "phone") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("stepPhone")}</CardTitle>
          <CardDescription>{t("stepPhoneDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("phoneNumber")}</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              autoFocus
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
          </div>

          {/* New-user toggle — moves to role choice before sending OTP */}
          <div className="flex items-center gap-2">
            <input
              id="is-new"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={isNewUser}
              onChange={(e) => setIsNewUser(e.target.checked)}
              disabled={isPending}
            />
            <Label htmlFor="is-new" className="cursor-pointer font-normal">
              {t("noAccount")}
            </Label>
          </div>

          <Button
            className="w-full"
            onClick={handlePhoneNext}
            disabled={isPending || phone.trim() === ""}
          >
            {isPending ? tCommon("loading") : t("sendOtp")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "role") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("stepRole")}</CardTitle>
          <CardDescription>{t("stepRoleDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3">
            <RoleCard
              role="organizer"
              label={t("roleOrganizer")}
              description={t("organizerDesc")}
              selected={selectedRole === "organizer"}
              onSelect={() => setSelectedRole("organizer")}
              disabled={isPending}
            />
            <RoleCard
              role="sponsor"
              label={t("roleSponsor")}
              description={t("sponsorDesc")}
              selected={selectedRole === "sponsor"}
              onSelect={() => setSelectedRole("sponsor")}
              disabled={isPending}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleRoleConfirm}
            disabled={isPending || !selectedRole}
          >
            {isPending ? tCommon("loading") : t("sendOtp")}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
            disabled={isPending}
          >
            {tCommon("back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // step === "otp"
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("stepOtp")}</CardTitle>
        <CardDescription>{t("stepOtpDesc", { phone })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="otp">{t("otp")}</Label>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            autoFocus
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">{t("otpHint")}</p>
        </div>

        <Button
          className="w-full"
          onClick={handleVerifyOtp}
          disabled={isPending || otp.length !== 6}
        >
          {isPending ? tCommon("loading") : t("verifyOtp")}
        </Button>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep(isNewUser ? "role" : "phone");
              setError(null);
            }}
            disabled={isPending}
          >
            {tCommon("back")}
          </Button>
          <Button variant="link" size="sm" onClick={handleResend} disabled={isPending}>
            {t("resendOtp")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Internal: Role selection card
// ---------------------------------------------------------------------------

interface RoleCardProps {
  role: Role;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function RoleCard({ role, label, description, selected, onSelect, disabled }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        "flex w-full flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-accent",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
      <input type="radio" name="role" value={role} checked={selected} readOnly className="sr-only" />
    </button>
  );
}
