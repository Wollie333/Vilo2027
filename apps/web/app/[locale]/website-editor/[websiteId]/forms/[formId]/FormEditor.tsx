"use client";

import {
  ArrowLeft,
  BedDouble,
  Calendar,
  CalendarRange,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronsUpDown,
  CircleDot,
  ClipboardList,
  Copy,
  Eye,
  Hash,
  Heading,
  Loader2,
  Mail,
  Minus,
  MoveDown,
  MoveUp,
  Phone,
  Pilcrow,
  Plus,
  PlusSquare,
  Settings2,
  SquareCheck,
  Trash2,
  Type as TypeIcon,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { saveWebsiteFormAction } from "@/app/[locale]/dashboard/website/actions";
import {
  isChoiceField,
  isLayoutField,
  type FormField,
  type FormFieldType,
  type FormSettings,
  type FormType,
} from "@/lib/website/forms.schema";

const nid = () => crypto.randomUUID();

const CATS: Array<{ key: string; types: FormFieldType[] }> = [
  { key: "contact", types: ["text", "email", "phone", "textarea"] },
  {
    key: "choice",
    types: ["select", "radio", "checkboxes", "number", "consent"],
  },
  { key: "stay", types: ["dates", "date", "guests", "rooms"] },
  { key: "layout", types: ["heading", "paragraph", "divider"] },
];

const ICONS: Record<FormFieldType, LucideIcon> = {
  text: TypeIcon,
  email: Mail,
  phone: Phone,
  textarea: ClipboardList,
  select: ChevronsUpDown,
  radio: CircleDot,
  checkboxes: CheckSquare,
  number: Hash,
  consent: SquareCheck,
  checkbox: SquareCheck,
  dates: CalendarRange,
  date: Calendar,
  guests: Users,
  rooms: BedDouble,
  heading: Heading,
  paragraph: Pilcrow,
  divider: Minus,
};

export function FormEditor({
  websiteId,
  formId,
  formType,
  subdomain,
  initialName,
  initialFields,
  initialSettings,
}: {
  websiteId: string;
  formId: string;
  formType: FormType;
  subdomain: string;
  initialName: string;
  initialFields: FormField[];
  initialSettings: FormSettings;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState<FormSettings>(initialSettings);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, startSave] = useTransition();

  const selected = selectedId
    ? (fields.find((f) => f.id === selectedId) ?? null)
    : null;
  const inputCount = fields.filter((f) => !isLayoutField(f.type)).length;

  function fieldLabel(type: FormFieldType) {
    return t(`fieldType_${type}`);
  }

  function addField(type: FormFieldType) {
    const f: FormField = {
      id: nid(),
      type,
      label: isLayoutField(type)
        ? type === "heading"
          ? t("formEditorHeadingDefault")
          : type === "paragraph"
            ? t("formEditorTextDefault")
            : ""
        : fieldLabel(type),
      required: false,
      width: "full",
    };
    if (isChoiceField(type)) {
      f.options =
        type === "rooms"
          ? [t("formEditorRoomA"), t("formEditorRoomB")]
          : [t("formEditorOption1"), t("formEditorOption2")];
    }
    if (type === "consent") f.optLabel = t("formEditorConsentDefault");
    const at = selectedId
      ? fields.findIndex((x) => x.id === selectedId) + 1
      : fields.length;
    setFields((fs) => [...fs.slice(0, at), f, ...fs.slice(at)]);
    setSelectedId(f.id);
  }

  function patchField(id: string, patch: Partial<FormField>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function move(id: string, dir: -1 | 1) {
    setFields((fs) => {
      const i = fs.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function dup(id: string) {
    const i = fields.findIndex((f) => f.id === id);
    if (i < 0) return;
    const copy = { ...structuredClone(fields[i]), id: nid() };
    setFields((fs) => [...fs.slice(0, i + 1), copy, ...fs.slice(i + 1)]);
    setSelectedId(copy.id);
  }
  function del(id: string) {
    setFields((fs) => fs.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function onSave() {
    startSave(async () => {
      const res = await saveWebsiteFormAction({
        websiteId,
        formId,
        name: name.trim() || t("formsDefaultName"),
        type: formType,
        fields,
        settings,
      });
      if (!res.ok) {
        toast.error(t("formsSaveError"));
        return;
      }
      toast.success(t("formsSaved"));
      router.refresh();
    });
  }

  return (
    <div
      className="vilo-builder"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header className="etop">
        <Link href={`/dashboard/website/${websiteId}/forms`} className="eback">
          <ArrowLeft style={{ width: 16, height: 16 }} />
          {t("formsHeading")}
        </Link>
        <div className="epage">
          <span className="pico">
            <ClipboardList style={{ width: 16, height: 16 }} />
          </span>
          <div>
            <div className="ptit">{name || t("formsDefaultName")}</div>
            <div className="psub">{subdomain}</div>
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span className="savedot">
            <i />
            {t("formEditorFieldCount", { count: inputCount })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setPreviewing((v) => !v);
              setSelectedId(null);
            }}
          >
            <Eye style={{ width: 15, height: 15 }} />
            {previewing ? t("exitPreview") : t("previewCta")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2
                className="animate-spin"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <Check style={{ width: 15, height: 15 }} />
            )}
            {t("save")}
          </button>
        </div>
      </header>

      <div className="ebody">
        {/* palette */}
        {!previewing ? (
          <aside className="epanel l">
            <div className="epanel-h">
              <PlusSquare style={{ width: 16, height: 16, color: "#10B981" }} />
              <h3>{t("formEditorAddField")}</h3>
            </div>
            <div className="epanel-b thin">
              {CATS.map((c) => (
                <div key={c.key}>
                  <div className="pal-cat">{t(`formEditorCat_${c.key}`)}</div>
                  <div className="pal-list">
                    {c.types.map((type) => {
                      const Ico = ICONS[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          className="pal-item"
                          onClick={() => addField(type)}
                        >
                          <span className="pi-ic">
                            <Ico style={{ width: 16, height: 16 }} />
                          </span>
                          <span className="pi-nm">{fieldLabel(type)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        ) : null}

        {/* canvas */}
        <div className="form-wrap thin">
          <div className="form-doc">
            <div className="fd-accent" />
            <div className="fd-head">
              <input
                className="fd-title"
                value={name}
                placeholder={t("formEditorTitlePh")}
                onChange={(e) => setName(e.target.value)}
                readOnly={previewing}
              />
              <textarea
                className="fd-desc"
                value={settings.description}
                placeholder={t("formEditorDescPh")}
                rows={2}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, description: e.target.value }))
                }
                readOnly={previewing}
              />
            </div>
            <div className="fd-body">
              {fields.length === 0 ? (
                <div className="canvas-empty" style={{ width: "100%" }}>
                  <div className="ce-ic">
                    <Plus style={{ width: 24, height: 24 }} />
                  </div>
                  <p style={{ marginTop: 8 }}>{t("formEditorEmpty")}</p>
                </div>
              ) : (
                fields.map((f) => (
                  <FieldBlock
                    key={f.id}
                    field={f}
                    selected={selectedId === f.id}
                    previewing={previewing}
                    onSelect={() => setSelectedId(f.id)}
                    onUp={() => move(f.id, -1)}
                    onDown={() => move(f.id, 1)}
                    onDup={() => dup(f.id)}
                    onDel={() => del(f.id)}
                  />
                ))
              )}
            </div>
            <div className="fd-foot">
              <div className="fd-submit">
                {settings.submitLabel || t("formEditorSend")}
              </div>
            </div>
          </div>
        </div>

        {/* inspector */}
        {!previewing ? (
          <aside className="epanel r">
            <div className="epanel-h">
              <Settings2 style={{ width: 16, height: 16, color: "#10B981" }} />
              <h3>
                {selected
                  ? fieldLabel(selected.type)
                  : t("formEditorFormSettings")}
              </h3>
            </div>
            <div className="epanel-b thin">
              {selected ? (
                <FieldInspector
                  field={selected}
                  onPatch={(p) => patchField(selected.id, p)}
                  onDelete={() => del(selected.id)}
                />
              ) : (
                <FormInspector
                  settings={settings}
                  onPatch={(p) => setSettings((s) => ({ ...s, ...p }))}
                />
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {previewing ? (
        <button
          type="button"
          className="btn btn-dark exitpv"
          onClick={() => setPreviewing(false)}
        >
          <X style={{ width: 15, height: 15 }} />
          {t("exitPreview")}
        </button>
      ) : null}
    </div>
  );
}

// ── canvas field block ──────────────────────────────────────
function FieldBlock({
  field,
  selected,
  previewing,
  onSelect,
  onUp,
  onDown,
  onDup,
  onDel,
}: {
  field: FormField;
  selected: boolean;
  previewing: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDup: () => void;
  onDel: () => void;
}) {
  const t = useTranslations("website");
  const cls = `ff ${field.width === "half" ? "half" : ""} ${selected ? "sel" : ""} ${field.required ? "req" : ""}`;

  const tools = previewing ? null : (
    <div className="ff-tools">
      <button
        type="button"
        title={t("moveUp")}
        onClick={(e) => (e.stopPropagation(), onUp())}
      >
        <MoveUp style={{ width: 15, height: 15 }} />
      </button>
      <button
        type="button"
        title={t("moveDown")}
        onClick={(e) => (e.stopPropagation(), onDown())}
      >
        <MoveDown style={{ width: 15, height: 15 }} />
      </button>
      <button
        type="button"
        title={t("duplicateSection")}
        onClick={(e) => (e.stopPropagation(), onDup())}
      >
        <Copy style={{ width: 14, height: 14 }} />
      </button>
      <button
        type="button"
        className="del"
        title={t("deleteSection")}
        onClick={(e) => (e.stopPropagation(), onDel())}
      >
        <Trash2 style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );

  if (field.type === "heading") {
    return (
      <div className={cls} onClick={onSelect}>
        {tools}
        <div className="fheading">
          {field.label || t("formEditorHeadingDefault")}
        </div>
      </div>
    );
  }
  if (field.type === "paragraph") {
    return (
      <div className={cls} onClick={onSelect}>
        {tools}
        <div className="ftext">{field.label || t("formEditorTextDefault")}</div>
      </div>
    );
  }
  if (field.type === "divider") {
    return (
      <div className={cls} style={{ padding: "18px 14px" }} onClick={onSelect}>
        {tools}
        <div className="fdiv" />
      </div>
    );
  }
  const isConsent = field.type === "consent" || field.type === "checkbox";
  return (
    <div className={cls} onClick={onSelect}>
      {tools}
      {isConsent ? null : (
        <label className="flabel">
          {field.label || t(`fieldType_${field.type}`)}
        </label>
      )}
      <FieldPreview field={field} />
      {field.help ? <div className="fhelp">{field.help}</div> : null}
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  const opts = field.options ?? [];
  switch (field.type) {
    case "textarea":
      return <div className="finput area">{field.placeholder}</div>;
    case "select":
    case "rooms":
      return (
        <div className="finput sel-in">
          <span>{opts[0] || "Choose…"}</span>
          <ChevronDown style={{ width: 16, height: 16 }} />
        </div>
      );
    case "radio":
      return (
        <div className="fopts">
          {opts.map((o, i) => (
            <div className="fopt" key={i}>
              <span className="mk r" />
              {o}
            </div>
          ))}
        </div>
      );
    case "checkboxes":
      return (
        <div className="fopts">
          {opts.map((o, i) => (
            <div className="fopt" key={i}>
              <span className="mk c" />
              {o}
            </div>
          ))}
        </div>
      );
    case "consent":
    case "checkbox":
      return (
        <div className="fopt">
          <span className="mk c" />
          {field.optLabel || field.label || "I agree"}
        </div>
      );
    case "dates":
      return (
        <div className="frow2">
          <div className="finput sel-in">
            <span>Check-in</span>
            <Calendar style={{ width: 15, height: 15 }} />
          </div>
          <div className="finput sel-in">
            <span>Check-out</span>
            <Calendar style={{ width: 15, height: 15 }} />
          </div>
        </div>
      );
    case "date":
      return (
        <div className="finput sel-in">
          <span>Pick a date</span>
          <Calendar style={{ width: 15, height: 15 }} />
        </div>
      );
    case "guests":
      return (
        <div className="fstep">
          <b>–</b>
          <span>2 guests</span>
          <b>+</b>
        </div>
      );
    default:
      return <div className="finput">{field.placeholder || "Your answer"}</div>;
  }
}

// ── inspectors ──────────────────────────────────────────────
function Sw({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={on ? "sw on" : "sw"}
      aria-pressed={on}
      onClick={onClick}
    />
  );
}

function FieldInspector({
  field,
  onPatch,
  onDelete,
}: {
  field: FormField;
  onPatch: (p: Partial<FormField>) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("website");
  const hasOpts = isChoiceField(field.type);
  const isLayout = isLayoutField(field.type);
  const isConsent = field.type === "consent" || field.type === "checkbox";
  const opts = field.options ?? [];

  return (
    <>
      <div className="insp-sec">
        {field.type === "heading" || field.type === "paragraph" ? (
          <div className="fld">
            <label>{t("formEditorTextLabel")}</label>
            <textarea
              value={field.label}
              onChange={(e) => onPatch({ label: e.target.value })}
            />
          </div>
        ) : field.type === "divider" ? (
          <p className="isec-t">{t("formEditorDividerHint")}</p>
        ) : isConsent ? (
          <div className="fld">
            <label>{t("formEditorConsentText")}</label>
            <textarea
              value={field.optLabel ?? ""}
              onChange={(e) => onPatch({ optLabel: e.target.value })}
            />
          </div>
        ) : (
          <>
            <div className="fld">
              <label>{t("formEditorLabel")}</label>
              <input
                type="text"
                value={field.label}
                onChange={(e) => onPatch({ label: e.target.value })}
              />
            </div>
            {["text", "email", "phone", "number", "textarea"].includes(
              field.type,
            ) ? (
              <div className="fld">
                <label>{t("formEditorPlaceholder")}</label>
                <input
                  type="text"
                  value={field.placeholder ?? ""}
                  onChange={(e) => onPatch({ placeholder: e.target.value })}
                />
              </div>
            ) : null}
            <div className="fld">
              <label>{t("formEditorHelp")}</label>
              <input
                type="text"
                value={field.help ?? ""}
                placeholder={t("formEditorHelpPh")}
                onChange={(e) => onPatch({ help: e.target.value })}
              />
            </div>
          </>
        )}
      </div>

      {hasOpts ? (
        <div className="insp-sec">
          <div className="isec-t">{t("formEditorOptions")}</div>
          {opts.map((o, i) => (
            <div className="optrow" key={i}>
              <input
                type="text"
                value={o}
                onChange={(e) => {
                  const next = [...opts];
                  next[i] = e.target.value;
                  onPatch({ options: next });
                }}
              />
              <button
                type="button"
                onClick={() =>
                  onPatch({ options: opts.filter((_, j) => j !== i) })
                }
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="addopt"
            onClick={() =>
              onPatch({ options: [...opts, t("formEditorNewOption")] })
            }
          >
            <Plus style={{ width: 14, height: 14 }} />
            {t("formEditorAddOption")}
          </button>
        </div>
      ) : null}

      {!isLayout ? (
        <div className="insp-sec">
          <div className="isec-t">{t("formEditorField")}</div>
          <div className="fld">
            <div className="fld-row">
              <label style={{ margin: 0 }}>{t("formEditorRequired")}</label>
              <Sw
                on={field.required}
                onClick={() => onPatch({ required: !field.required })}
              />
            </div>
          </div>
          {!isConsent ? (
            <div className="fld">
              <label>{t("formEditorWidth")}</label>
              <div className="choice">
                <button
                  type="button"
                  className={field.width !== "half" ? "on" : ""}
                  onClick={() => onPatch({ width: "full" })}
                >
                  {t("formEditorWidthFull")}
                </button>
                <button
                  type="button"
                  className={field.width === "half" ? "on" : ""}
                  onClick={() => onPatch({ width: "half" })}
                >
                  {t("formEditorWidthHalf")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="insp-sec">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ width: "100%", color: "#EF4444", borderColor: "#F6D9D9" }}
          onClick={onDelete}
        >
          <Trash2 style={{ width: 14, height: 14 }} />
          {t("formEditorDeleteField")}
        </button>
      </div>
    </>
  );
}

function FormInspector({
  settings,
  onPatch,
}: {
  settings: FormSettings;
  onPatch: (p: Partial<FormSettings>) => void;
}) {
  const t = useTranslations("website");
  return (
    <>
      <div className="insp-sec">
        <div className="isec-t">{t("formEditorGeneral")}</div>
        <div className="fld">
          <label>{t("formEditorSubmitText")}</label>
          <input
            type="text"
            value={settings.submitLabel}
            onChange={(e) => onPatch({ submitLabel: e.target.value })}
          />
        </div>
      </div>
      <div className="insp-sec">
        <div className="isec-t">{t("formEditorAfterSubmit")}</div>
        <div className="fld">
          <label>{t("formAfterSubmitAction")}</label>
          <select
            value={settings.afterSubmit}
            onChange={(e) =>
              onPatch({
                afterSubmit: e.target.value as FormSettings["afterSubmit"],
              })
            }
          >
            <option value="message">{t("formAfterSubmit_message")}</option>
            <option value="page">{t("formAfterSubmit_page")}</option>
            <option value="url">{t("formAfterSubmit_url")}</option>
          </select>
        </div>
        {settings.afterSubmit !== "url" ? (
          <div className="fld">
            <label>{t("formEditorSuccess")}</label>
            <textarea
              value={settings.successMessage}
              onChange={(e) => onPatch({ successMessage: e.target.value })}
            />
          </div>
        ) : null}
        {settings.afterSubmit === "page" ? (
          <>
            <div className="fld">
              <label>{t("formGoal")}</label>
              <select
                value={settings.goal}
                onChange={(e) =>
                  onPatch({ goal: e.target.value as FormSettings["goal"] })
                }
              >
                <option value="enquiry">{t("formGoal_enquiry")}</option>
                <option value="quote">{t("formGoal_quote")}</option>
                <option value="subscribe">{t("formGoal_subscribe")}</option>
                <option value="general">{t("formGoal_general")}</option>
              </select>
              <p style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>
                {t("formGoalHint")}
              </p>
            </div>
            <div className="fld">
              <label>{t("formThankYouHeading")}</label>
              <input
                type="text"
                value={settings.thankYouHeading}
                placeholder={t("formThankYouHeadingPh")}
                onChange={(e) => onPatch({ thankYouHeading: e.target.value })}
              />
            </div>
          </>
        ) : null}
        {settings.afterSubmit === "url" ? (
          <div className="fld">
            <label>{t("formRedirectUrl")}</label>
            <input
              type="text"
              value={settings.redirectUrl}
              placeholder="https://…"
              onChange={(e) => onPatch({ redirectUrl: e.target.value })}
            />
          </div>
        ) : null}
      </div>
      <div className="insp-sec">
        <div className="isec-t">{t("formEditorRouting")}</div>
        <div className="fld">
          <div className="fld-row">
            <label style={{ margin: 0 }}>{t("formEditorNotifyInbox")}</label>
            <Sw
              on={settings.notifyInbox}
              onClick={() => onPatch({ notifyInbox: !settings.notifyInbox })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
