"use client";

import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Library,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Opt-in image embeds: upload a picked File → return its public URL (or null
   * on failure). When provided, an "Insert image" toolbar button appears. Omit
   * it (e.g. listing descriptions) and the editor behaves exactly as before.
   */
  onImageUpload?: (file: File) => Promise<string | null>;
  /**
   * Opt-in "insert from media library": opens the caller's media picker and
   * resolves the chosen image (url + its stored alt), or null if cancelled. When
   * provided, a "Choose from library" toolbar button appears alongside upload.
   */
  onPickFromLibrary?: () => Promise<{ url: string; alt?: string } | null>;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  onImageUpload,
  onPickFromLibrary,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit's HorizontalRule + Code are useful but rarely needed for
        // a listing description; keep them in for parity with what the
        // sanitiser allows.
        heading: { levels: [2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // Tailwind doesn't have a prose plugin installed; replicate just
        // enough typography so the editor reads like the final article.
        class:
          "min-h-[180px] max-h-[640px] overflow-y-auto rounded border border-brand-line bg-white p-3 text-sm leading-relaxed text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15 [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-brand-mute [&_strong]:font-semibold [&_p]:my-2 [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded",
        "aria-label": "Description editor",
      },
    },
    onUpdate({ editor }) {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
  });

  // Keep the editor in sync if the caller resets the value (e.g. form reset).
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div className="space-y-2">
      <Toolbar
        editor={editor}
        disabled={!!disabled}
        onImageUpload={onImageUpload}
        onPickFromLibrary={onPickFromLibrary}
      />
      <div className="relative">
        <EditorContent editor={editor} />
        {editor && editor.isEmpty && placeholder ? (
          <div
            aria-hidden
            className="pointer-events-none absolute left-3 top-3 text-sm text-brand-mute"
          >
            {placeholder}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  disabled,
  onImageUpload,
  onPickFromLibrary,
}: {
  editor: Editor | null;
  disabled: boolean;
  onImageUpload?: (file: File) => Promise<string | null>;
  onPickFromLibrary?: () => Promise<{ url: string; alt?: string } | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  async function onPickImage(file: File) {
    if (!editor || !onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      if (url) editor.chain().focus().setImage({ src: url }).run();
    } finally {
      setUploading(false);
    }
  }

  async function onBrowse() {
    if (!editor || !onPickFromLibrary) return;
    setBrowsing(true);
    try {
      const img = await onPickFromLibrary();
      if (img)
        editor.chain().focus().setImage({ src: img.url, alt: img.alt }).run();
    } finally {
      setBrowsing(false);
    }
  }

  if (!editor) {
    return (
      <div className="flex h-9 items-center gap-1 rounded border border-brand-line bg-brand-light/40 px-2" />
    );
  }
  const buttons: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }[] = [
    {
      icon: Bold,
      label: "Bold",
      isActive: editor.isActive("bold"),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: "Italic",
      isActive: editor.isActive("italic"),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Strikethrough,
      label: "Strikethrough",
      isActive: editor.isActive("strike"),
      onClick: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      icon: Heading2,
      label: "Heading",
      isActive: editor.isActive("heading", { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Heading3,
      label: "Subheading",
      isActive: editor.isActive("heading", { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: List,
      label: "Bullet list",
      isActive: editor.isActive("bulletList"),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: "Numbered list",
      isActive: editor.isActive("orderedList"),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: "Quote",
      isActive: editor.isActive("blockquote"),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded border border-brand-line bg-brand-light/40 p-1">
      {buttons.map((b) => {
        const Icon = b.icon;
        return (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            disabled={disabled}
            aria-label={b.label}
            title={b.label}
            aria-pressed={b.isActive}
            className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
              b.isActive
                ? "bg-brand-primary text-white"
                : "text-brand-mute hover:bg-white hover:text-brand-ink"
            } disabled:opacity-50`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}

      <span aria-hidden className="mx-1 h-5 w-px bg-brand-line" />

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={disabled || !editor.can().undo()}
        aria-label="Undo"
        title="Undo"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute transition-colors hover:bg-white hover:text-brand-ink disabled:opacity-30"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={disabled || !editor.can().redo()}
        aria-label="Redo"
        title="Redo"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute transition-colors hover:bg-white hover:text-brand-ink disabled:opacity-30"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      {onImageUpload ? (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-brand-line" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
            aria-label="Insert image"
            title="Insert image"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute transition-colors hover:bg-white hover:text-brand-ink disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
              e.target.value = "";
            }}
          />
        </>
      ) : null}

      {onPickFromLibrary ? (
        <button
          type="button"
          onClick={onBrowse}
          disabled={disabled || browsing}
          aria-label="Insert image from library"
          title="Insert image from library"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute transition-colors hover:bg-white hover:text-brand-ink disabled:opacity-50"
        >
          {browsing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Library className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
    </div>
  );
}
