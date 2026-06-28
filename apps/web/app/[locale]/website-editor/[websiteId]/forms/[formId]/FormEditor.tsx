"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  GripVertical,
  Hash,
  Heading,
  Loader2,
  Mail,
  Minus,
  Phone,
  Pilcrow,
  Plus,
  PlusSquare,
  Search,
  Settings2,
  SquareCheck,
  Trash2,
  Type as TypeIcon,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
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
  type FormStyle,
  type FormType,
} from "@/lib/website/forms.schema";
import { formStyleVars } from "@/lib/website/formStyle";

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
  roomNames = [],
  embedded = false,
  onClose,
}: {
  websiteId: string;
  formId: string;
  formType: FormType;
  subdomain: string;
  initialName: string;
  initialFields: FormField[];
  initialSettings: FormSettings;
  /** The host's live visible rooms — what a `rooms` field auto-fills with. */
  roomNames?: string[];
  /** When mounted inside the page builder (modal/overlay) rather than its own
   *  route — swaps the "back to forms" link for a Close action. */
  embedded?: boolean;
  onClose?: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState<FormSettings>(initialSettings);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  // When set, the next palette pick inserts at this index (set by the per-field
  // "+" affordance), mirroring the page builder's insert-between.
  const [insertAt, setInsertAt] = useState<number | null>(null);
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
    // `rooms` auto-fills from the host's live rooms — no stored options.
    if (isChoiceField(type) && type !== "rooms") {
      f.options = [t("formEditorOption1"), t("formEditorOption2")];
    }
    if (type === "consent") f.optLabel = t("formEditorConsentDefault");
    // Insert position: an explicit "+" target wins; else after the selected
    // field; else append.
    const at =
      insertAt !== null
        ? insertAt
        : selectedId
          ? fields.findIndex((x) => x.id === selectedId) + 1
          : fields.length;
    setFields((fs) => [...fs.slice(0, at), f, ...fs.slice(at)]);
    setSelectedId(f.id);
    setInsertAt(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function patchField(id: string, patch: Partial<FormField>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFields((fs) => {
      const oldIndex = fs.findIndex((f) => f.id === active.id);
      const newIndex = fs.findIndex((f) => f.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return fs;
      return arrayMove(fs, oldIndex, newIndex);
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
        {embedded ? (
          <button type="button" className="eback" onClick={onClose}>
            <X style={{ width: 16, height: 16 }} />
            {t("close")}
          </button>
        ) : (
          <Link
            href={`/dashboard/website/${websiteId}/forms`}
            className="eback"
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {t("formsHeading")}
          </Link>
        )}
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
              {/* Search every field type by name (mirrors the page builder). */}
              <div className="pal-search-wrap">
                <Search
                  className="pal-search-ic"
                  style={{ width: 14, height: 14 }}
                />
                <input
                  type="text"
                  className="pal-search"
                  placeholder={t("formEditorSearchPh")}
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                />
                {paletteQuery ? (
                  <button
                    type="button"
                    className="pal-search-x"
                    onClick={() => setPaletteQuery("")}
                    aria-label={t("formEditorSearchClear")}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                ) : null}
              </div>

              {insertAt !== null ? (
                <div className="pal-cat" style={{ color: "#064E3B" }}>
                  {t("formEditorInsertHint")}
                </div>
              ) : null}

              {(() => {
                const q = paletteQuery.trim().toLowerCase();
                const card = (type: FormFieldType) => {
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
                };
                if (q) {
                  const hits = CATS.flatMap((c) => c.types).filter(
                    (type) =>
                      fieldLabel(type).toLowerCase().includes(q) ||
                      type.replace(/_/g, " ").includes(q),
                  );
                  return hits.length === 0 ? (
                    <div className="pal-cat" style={{ fontWeight: 400 }}>
                      {t("formEditorNoFields")}
                    </div>
                  ) : (
                    <div className="pal-grid">{hits.map(card)}</div>
                  );
                }
                return CATS.map((c) => (
                  <div key={c.key}>
                    <div className="pal-cat">{t(`formEditorCat_${c.key}`)}</div>
                    <div className="pal-grid">{c.types.map(card)}</div>
                  </div>
                ));
              })()}
            </div>
          </aside>
        ) : null}

        {/* canvas */}
        <div className="form-wrap thin">
          <div className="form-doc" style={formStyleVars(settings.style)}>
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
                <DndContext
                  id="form-fields"
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={rectSortingStrategy}
                  >
                    {fields.map((f, i) => (
                      <SortableField
                        key={f.id}
                        field={f}
                        typeName={fieldLabel(f.type)}
                        roomNames={roomNames}
                        selected={selectedId === f.id}
                        previewing={previewing}
                        onSelect={() => {
                          setSelectedId(f.id);
                          setInsertAt(null);
                        }}
                        onInsertBefore={() => setInsertAt(i)}
                        onDup={() => dup(f.id)}
                        onDel={() => del(f.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <div
              className="fd-foot"
              style={{
                display: "flex",
                justifyContent:
                  settings.style?.buttonAlign === "center"
                    ? "center"
                    : settings.style?.buttonAlign === "right"
                      ? "flex-end"
                      : settings.style?.buttonAlign === "full"
                        ? "stretch"
                        : "flex-start",
              }}
            >
              <div
                className="fd-submit"
                style={
                  settings.style?.buttonAlign === "full"
                    ? { width: "100%" }
                    : undefined
                }
              >
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
                  roomNames={roomNames}
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

// ── sortable wrapper ────────────────────────────────────────
// Threads dnd-kit's node ref + transform onto the `.ff` block itself (NOT a
// wrapping div) so the half-width flex layout in `.fd-body` is preserved. The
// grip carries the drag listeners; the rest of the block stays clickable to
// select. Hidden in preview, where no editing tools show.
function SortableField(props: {
  field: FormField;
  typeName: string;
  roomNames: string[];
  selected: boolean;
  previewing: boolean;
  onSelect: () => void;
  onInsertBefore: () => void;
  onDup: () => void;
  onDel: () => void;
}) {
  const t = useTranslations("website");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.field.id });
  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };
  // The grip lives inside the type-label tab (mirrors the page builder's
  // .bk-label > .bl-grip), and carries the drag listeners.
  const grip = props.previewing ? null : (
    <span
      className="fl-grip"
      title={t("dragToReorder")}
      aria-label={t("dragToReorder")}
      onClick={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <GripVertical style={{ width: 13, height: 13 }} />
    </span>
  );
  return (
    <FieldBlock
      {...props}
      dragRef={setNodeRef}
      dragStyle={dragStyle}
      grip={grip}
    />
  );
}

// ── canvas field block ──────────────────────────────────────
function FieldBlock({
  field,
  typeName,
  roomNames,
  selected,
  previewing,
  onSelect,
  onInsertBefore,
  onDup,
  onDel,
  dragRef,
  dragStyle,
  grip,
}: {
  field: FormField;
  typeName: string;
  roomNames: string[];
  selected: boolean;
  previewing: boolean;
  onSelect: () => void;
  onInsertBefore: () => void;
  onDup: () => void;
  onDel: () => void;
  dragRef?: Ref<HTMLDivElement>;
  dragStyle?: CSSProperties;
  grip?: ReactNode;
}) {
  const t = useTranslations("website");
  const cls = `ff ${field.width === "half" ? "half" : ""} ${selected ? "sel" : ""} ${field.required ? "req" : ""}`;
  const isConsent = field.type === "consent" || field.type === "checkbox";

  // Type label tag (with the drag grip) + insert-above affordance — both mirror
  // the page builder's .bk-label / .bk-insert chrome.
  const label = previewing ? null : (
    <div className="ff-label">
      {grip}
      {typeName}
    </div>
  );
  const insert = previewing ? null : (
    <button
      type="button"
      className="ff-insert"
      title={t("formEditorInsertHere")}
      aria-label={t("formEditorInsertHere")}
      onClick={(e) => (e.stopPropagation(), onInsertBefore())}
    >
      <Plus style={{ width: 14, height: 14 }} />
    </button>
  );

  const tools = previewing ? null : (
    <div className="ff-tools">
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

  let inner: ReactNode;
  if (field.type === "heading") {
    inner = (
      <div className="fheading">
        {field.label || t("formEditorHeadingDefault")}
      </div>
    );
  } else if (field.type === "paragraph") {
    inner = (
      <div className="ftext">{field.label || t("formEditorTextDefault")}</div>
    );
  } else if (field.type === "divider") {
    inner = <div className="fdiv" />;
  } else {
    inner = (
      <>
        {isConsent ? null : (
          <label className="flabel">
            {field.label || t(`fieldType_${field.type}`)}
          </label>
        )}
        <FieldPreview field={field} roomNames={roomNames} />
        {field.help ? <div className="fhelp">{field.help}</div> : null}
      </>
    );
  }

  return (
    <div
      ref={dragRef}
      className={cls}
      style={{
        ...dragStyle,
        ...(field.type === "divider" ? { padding: "18px 14px" } : null),
      }}
      onClick={onSelect}
    >
      {label}
      {insert}
      {tools}
      {inner}
    </div>
  );
}

function FieldPreview({
  field,
  roomNames,
}: {
  field: FormField;
  roomNames: string[];
}) {
  // A `rooms` field renders the host's LIVE rooms — never the stored options.
  const opts = field.type === "rooms" ? roomNames : (field.options ?? []);
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
          <span>
            {field.optLabel || field.label || "I agree"}
            {field.linkUrl?.trim() ? (
              <>
                {" "}
                <span style={{ color: "#10B981", textDecoration: "underline" }}>
                  {field.linkLabel?.trim() || "Terms & Conditions"}
                </span>
              </>
            ) : null}
          </span>
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
  roomNames,
  onPatch,
  onDelete,
}: {
  field: FormField;
  roomNames: string[];
  onPatch: (p: Partial<FormField>) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("website");
  const isRooms = field.type === "rooms";
  // A `rooms` field auto-fills from live rooms — its choices aren't host-edited.
  const hasOpts = isChoiceField(field.type) && !isRooms;
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
          <>
            <div className="fld">
              <label>{t("formEditorConsentText")}</label>
              <textarea
                value={field.optLabel ?? ""}
                onChange={(e) => onPatch({ optLabel: e.target.value })}
              />
            </div>
            <div className="fld">
              <label>{t("formEditorConsentLinkUrl")}</label>
              <input
                type="text"
                value={field.linkUrl ?? ""}
                placeholder={t("formEditorConsentLinkUrlPh")}
                onChange={(e) => onPatch({ linkUrl: e.target.value })}
              />
            </div>
            {field.linkUrl?.trim() ? (
              <div className="fld">
                <label>{t("formEditorConsentLinkLabel")}</label>
                <input
                  type="text"
                  value={field.linkLabel ?? ""}
                  placeholder={t("formEditorConsentLinkLabelPh")}
                  onChange={(e) => onPatch({ linkLabel: e.target.value })}
                />
              </div>
            ) : null}
            <div className="fld">
              <div className="fld-row">
                <label style={{ margin: 0 }}>
                  {t("formEditorConsentMarketing")}
                </label>
                <Sw
                  on={Boolean(field.marketing)}
                  onClick={() => onPatch({ marketing: !field.marketing })}
                />
              </div>
              <p className="fhelp" style={{ marginTop: 4 }}>
                {t("formEditorConsentMarketingHint")}
              </p>
            </div>
          </>
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

      {isRooms ? (
        <div className="insp-sec">
          <div className="isec-t">{t("formEditorRoomsAuto")}</div>
          <p className="isec-t" style={{ fontWeight: 400, opacity: 0.75 }}>
            {t("formEditorRoomsAutoHint")}
          </p>
          {roomNames.length > 0 ? (
            <div className="fopts" style={{ marginTop: 6 }}>
              {roomNames.map((name, i) => (
                <div className="fopt" key={i}>
                  <span className="mk r" />
                  {name}
                </div>
              ))}
            </div>
          ) : (
            <p className="isec-t" style={{ fontWeight: 400, color: "#EF4444" }}>
              {t("formEditorRoomsAutoEmpty")}
            </p>
          )}
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
  const [tab, setTab] = useState<"settings" | "styles">("settings");

  const tabs: ReadonlyArray<readonly [typeof tab, string]> = [
    ["settings", t("formTabSettings")],
    ["styles", t("formTabStyles")],
  ];

  return (
    <>
      <div
        role="tablist"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          margin: "12px 14px 2px",
        }}
        className="overflow-hidden rounded-[10px] border border-brand-line"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-2 py-1.5 text-[12.5px] font-semibold transition ${
              tab === key
                ? "bg-brand-light text-brand-secondary"
                : "bg-white text-brand-mute hover:text-brand-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "styles" ? (
        <FormStyles settings={settings} onPatch={onPatch} />
      ) : (
        <FormSettingsPanel settings={settings} onPatch={onPatch} />
      )}
    </>
  );
}

function FormSettingsPanel({
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
      <div className="insp-sec">
        <div className="isec-t">{t("formEditorSpam")}</div>
        <div className="fld">
          <div className="fld-row">
            <label style={{ margin: 0 }}>{t("formEditorSpamProtect")}</label>
            <Sw
              on={settings.spamProtection !== false}
              onClick={() =>
                onPatch({ spamProtection: settings.spamProtection === false })
              }
            />
          </div>
          <p className="fhelp" style={{ marginTop: 4 }}>
            {t("formEditorSpamProtectHint")}
          </p>
        </div>
      </div>
    </>
  );
}

// ── Styles tab ──────────────────────────────────────────────
// Per-form overrides of the themed look. Each writes to settings.style; the
// canvas (.form-doc) + the public FormSection both apply them as `--vform-*`
// vars (lib/website/formStyle.ts), so the canvas previews changes instantly.
function ColorRow({
  label,
  value,
  fallback,
  onChange,
  onReset,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const t = useTranslations("website");
  return (
    <div className="fld">
      <div className="fld-row">
        <label style={{ margin: 0 }}>{label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="color"
            value={value ?? fallback}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: 34,
              height: 26,
              padding: 0,
              border: "1px solid var(--line)",
              borderRadius: 7,
              background: "none",
              cursor: "pointer",
            }}
          />
          {value ? (
            <button
              type="button"
              title={t("formStyleResetField")}
              aria-label={t("formStyleResetField")}
              onClick={onReset}
              style={{
                display: "flex",
                color: "var(--mute)",
                background: "none",
                border: 0,
                cursor: "pointer",
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const RADII = ["sharp", "rounded", "pill"] as const;
const BTN_ALIGNS = ["left", "center", "right", "full"] as const;

function FormStyles({
  settings,
  onPatch,
}: {
  settings: FormSettings;
  onPatch: (p: Partial<FormSettings>) => void;
}) {
  const t = useTranslations("website");
  const s = settings.style ?? {};
  const patchStyle = (p: Partial<FormStyle>) =>
    onPatch({ style: { ...s, ...p } });
  const hasAny = Object.values(s).some((v) => v !== undefined && v !== "");

  return (
    <>
      <div className="insp-sec">
        <div className="isec-t">{t("formStyleFields")}</div>
        <ColorRow
          label={t("formStyleAccent")}
          value={s.accent}
          fallback="#16A34A"
          onChange={(v) => patchStyle({ accent: v })}
          onReset={() => patchStyle({ accent: undefined })}
        />
        <div className="fld">
          <label>{t("formStyleCorners")}</label>
          <div className="choice">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                className={s.fieldRadius === r ? "on" : ""}
                onClick={() => patchStyle({ fieldRadius: r })}
              >
                {t(`formStyleCorner_${r}`)}
              </button>
            ))}
          </div>
        </div>
        <ColorRow
          label={t("formStyleFieldBg")}
          value={s.fieldBg}
          fallback="#FFFFFF"
          onChange={(v) => patchStyle({ fieldBg: v })}
          onReset={() => patchStyle({ fieldBg: undefined })}
        />
        <ColorRow
          label={t("formStyleFieldBorder")}
          value={s.fieldBorder}
          fallback="#D8E6DF"
          onChange={(v) => patchStyle({ fieldBorder: v })}
          onReset={() => patchStyle({ fieldBorder: undefined })}
        />
      </div>

      <div className="insp-sec">
        <div className="isec-t">{t("formStyleButton")}</div>
        <ColorRow
          label={t("formStyleButtonColor")}
          value={s.buttonBg}
          fallback="#16A34A"
          onChange={(v) => patchStyle({ buttonBg: v })}
          onReset={() => patchStyle({ buttonBg: undefined })}
        />
        <div className="fld">
          <label>{t("formStyleButtonAlign")}</label>
          <div className="choice">
            {BTN_ALIGNS.map((a) => (
              <button
                key={a}
                type="button"
                className={s.buttonAlign === a ? "on" : ""}
                onClick={() => patchStyle({ buttonAlign: a })}
              >
                {t(`formStyleAlign_${a}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="insp-sec">
        <p className="fhelp" style={{ marginBottom: 8 }}>
          {t("formStyleHint")}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ width: "100%" }}
          disabled={!hasAny}
          onClick={() => onPatch({ style: {} })}
        >
          {t("formStyleReset")}
        </button>
      </div>
    </>
  );
}
