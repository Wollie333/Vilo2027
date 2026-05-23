"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { finalizeOnboardingAction } from "./actions";
import {
  ACCOMMODATION_TYPES,
  EXPERIENCE_TYPES,
  PLANS,
  firstListingSchema,
  personalDetailsSchema,
  planSchema,
  propertyTypeSchema,
  type FirstListingInput,
  type OnboardingInput,
  type PersonalDetailsInput,
  type PlanInput,
  type PropertyTypeInput,
} from "./schemas";

type StepNumber = 1 | 2 | 3 | 4 | 5;

const STEPS: { n: StepNumber; label: string }[] = [
  { n: 1, label: "Your details" },
  { n: 2, label: "Listing type" },
  { n: 3, label: "First listing" },
  { n: 4, label: "Plan" },
  { n: 5, label: "Welcome" },
];

type WizardState = Partial<
  PersonalDetailsInput & PropertyTypeInput & FirstListingInput & PlanInput
>;

export function Wizard({ userEmail }: { userEmail: string }) {
  const [step, setStep] = useState<StepNumber>(1);
  const [state, setState] = useState<WizardState>({ plan: "free" });
  const [isFinalizing, startFinalize] = useTransition();

  function advance(patch: Partial<WizardState>, next: StepNumber) {
    setState((s) => ({ ...s, ...patch }));
    setStep(next);
  }

  function back() {
    if (step > 1) setStep((step - 1) as StepNumber);
  }

  function finalize() {
    startFinalize(async () => {
      const result = await finalizeOnboardingAction(state as OnboardingInput);
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          ← Vilo
        </Link>
        <span className="font-mono text-xs text-brand-mute">{userEmail}</span>
      </div>

      <StepIndicator current={step} />

      {step === 1 ? (
        <PersonalDetailsStep
          defaults={state}
          onNext={(values) => advance(values, 2)}
        />
      ) : null}

      {step === 2 ? (
        <PropertyTypeStep
          defaults={state}
          onBack={back}
          onNext={(values) => advance(values, 3)}
        />
      ) : null}

      {step === 3 ? (
        <FirstListingStep
          defaults={state}
          onBack={back}
          onNext={(values) => advance(values, 4)}
        />
      ) : null}

      {step === 4 ? (
        <PlanStep
          defaults={state}
          onBack={back}
          onNext={(values) => advance(values, 5)}
        />
      ) : null}

      {step === 5 ? (
        <WelcomeStep
          isFinalizing={isFinalizing}
          onBack={back}
          onFinish={finalize}
        />
      ) : null}
    </div>
  );
}

function StepIndicator({ current }: { current: StepNumber }) {
  return (
    <ol className="mb-8 flex items-center justify-between gap-2">
      {STEPS.map((s) => {
        const isDone = s.n < current;
        const isCurrent = s.n === current;
        return (
          <li
            key={s.n}
            className="flex flex-1 items-center gap-2"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                isDone
                  ? "bg-brand-primary text-white"
                  : isCurrent
                    ? "bg-brand-primary text-white ring-4 ring-brand-primary/15"
                    : "bg-brand-accent text-brand-mute"
              }`}
            >
              {isDone ? <Check className="h-4 w-4" /> : s.n}
            </span>
            <span
              className={`hidden text-xs font-medium sm:inline ${
                isCurrent ? "text-brand-dark" : "text-brand-mute"
              }`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PersonalDetailsStep({
  defaults,
  onNext,
}: {
  defaults: WizardState;
  onNext: (values: PersonalDetailsInput) => void;
}) {
  const form = useForm<PersonalDetailsInput>({
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: {
      full_name: defaults.full_name ?? "",
      phone: defaults.phone ?? "",
    },
  });

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl font-bold text-brand-dark">
          Tell us about you
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Guests will see your name on bookings and messages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onNext)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your full name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder="Lerato Mahlangu"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone number{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+27 82 123 4567"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" className="gap-1.5">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function PropertyTypeStep({
  defaults,
  onBack,
  onNext,
}: {
  defaults: WizardState;
  onBack: () => void;
  onNext: (values: PropertyTypeInput) => void;
}) {
  const form = useForm<PropertyTypeInput>({
    resolver: zodResolver(propertyTypeSchema),
    defaultValues: {
      listing_type: defaults.listing_type ?? "accommodation",
      accommodation_type: defaults.accommodation_type,
      experience_type: defaults.experience_type,
    },
  });

  const listingType = form.watch("listing_type");

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl font-bold text-brand-dark">
          What are you listing?
        </CardTitle>
        <CardDescription className="text-brand-mute">
          You can add more types later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onNext)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="listing_type"
              render={({ field }) => (
                <FormItem>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["accommodation", "experience"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => field.onChange(t)}
                        className={`rounded-card border p-4 text-left transition-colors ${
                          field.value === t
                            ? "border-brand-primary bg-brand-accent/50"
                            : "border-brand-line bg-white hover:bg-brand-light/60"
                        }`}
                      >
                        <div className="font-display text-base font-semibold capitalize text-brand-dark">
                          {t === "accommodation"
                            ? "A place to stay"
                            : "An experience"}
                        </div>
                        <div className="mt-1 text-xs text-brand-mute">
                          {t === "accommodation"
                            ? "Cottage, B&B, lodge, self-catering, etc."
                            : "Tours, workshops, transfers, activities."}
                        </div>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {listingType === "accommodation" ? (
              <FormField
                control={form.control}
                name="accommodation_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accommodation type</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ACCOMMODATION_TYPES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                            field.value === opt.value
                              ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                              : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {listingType === "experience" ? (
              <FormField
                control={form.control}
                name="experience_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experience type</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {EXPERIENCE_TYPES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                            field.value === opt.value
                              ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                              : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="submit" size="lg" className="gap-1.5">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function FirstListingStep({
  defaults,
  onBack,
  onNext,
}: {
  defaults: WizardState;
  onBack: () => void;
  onNext: (values: FirstListingInput) => void;
}) {
  const form = useForm<FirstListingInput>({
    resolver: zodResolver(firstListingSchema),
    defaultValues: {
      display_name: defaults.display_name ?? defaults.full_name ?? "",
      name: defaults.name ?? "",
      description: defaults.description ?? "",
    },
  });

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl font-bold text-brand-dark">
          Your first listing
        </CardTitle>
        <CardDescription className="text-brand-mute">
          A draft — you can polish photos, pricing and policies after this.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onNext)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host display name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Karoo Cottages"
                      autoComplete="organization"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-brand-mute">
                    Shown on your booking page. Your Vilo URL handle is derived
                    from this — you can rename it later.
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing name</FormLabel>
                  <FormControl>
                    <Input placeholder="Karoo Stargazer Cottage" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="A short paragraph — what makes this place special?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="submit" size="lg" className="gap-1.5">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function PlanStep({
  defaults,
  onBack,
  onNext,
}: {
  defaults: WizardState;
  onBack: () => void;
  onNext: (values: PlanInput) => void;
}) {
  const form = useForm<PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: { plan: defaults.plan ?? "free" },
  });

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl font-bold text-brand-dark">
          Pick your plan
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Start free — upgrade from settings whenever you&rsquo;re ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onNext)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="plan"
              render={({ field }) => (
                <FormItem>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PLANS.map((p) => {
                      const isSelected = field.value === p.value;
                      const isLocked = !p.available;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() => field.onChange(p.value)}
                          className={`relative rounded-card border p-4 text-left transition-colors ${
                            isLocked
                              ? "cursor-not-allowed border-brand-line bg-brand-light/40 opacity-60"
                              : isSelected
                                ? "border-brand-primary bg-brand-accent/50"
                                : "border-brand-line bg-white hover:bg-brand-light/60"
                          }`}
                        >
                          {isLocked ? (
                            <span className="absolute right-3 top-3 rounded-pill bg-brand-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-mute">
                              After launch
                            </span>
                          ) : null}
                          <div className="font-display text-base font-bold text-brand-dark">
                            {p.name}
                          </div>
                          <div className="mt-1 text-xs text-brand-mute">
                            {p.tagline}
                          </div>
                          <div className="mt-3 flex items-baseline gap-1">
                            <span className="font-display text-xl font-bold text-brand-dark">
                              {p.price}
                            </span>
                            <span className="text-xs text-brand-mute">
                              {p.cadence}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded border border-brand-line bg-brand-accent/40 px-4 py-3 text-xs text-brand-ink">
              Paid plans land when subscription billing ships (Phase 3). Start
              free now — your data carries over.
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="submit" size="lg" className="gap-1.5">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function WelcomeStep({
  isFinalizing,
  onBack,
  onFinish,
}: {
  isFinalizing: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <CardTitle className="font-display text-2xl font-bold text-brand-dark">
          You&rsquo;re ready to launch
        </CardTitle>
        <CardDescription className="text-brand-mute">
          We&rsquo;ll create your host profile, your first draft listing, and
          your free plan in one go.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-2 text-sm text-brand-dark">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            Host profile with an auto-generated Vilo URL handle (you can rename
            it later)
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            First listing as a <strong>draft</strong> — guests can&rsquo;t see
            it until you publish
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            Free plan, no card required
          </li>
        </ul>

        <label className="flex items-start gap-3 rounded-card border border-brand-line bg-brand-light/60 p-3">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm text-brand-ink">
            I&rsquo;ll keep my listing accurate and respond to guests within 24
            hours.
          </span>
        </label>

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isFinalizing}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onFinish}
            disabled={!acknowledged || isFinalizing}
            className="gap-1.5"
          >
            {isFinalizing ? "Creating…" : "Create my host profile"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
