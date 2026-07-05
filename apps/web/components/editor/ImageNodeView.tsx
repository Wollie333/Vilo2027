"use client";

import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Image node view for the rich-text editor: renders the image with hover controls
 * — a pencil (opens the settings modal) and a trash icon (removes the image from
 * the post). Clicking the image also opens the modal, where the author edits the
 * Alt text (SEO) + Title (hover tooltip). The modal is portalled to <body> so its
 * inputs live OUTSIDE the contentEditable surface (no ProseMirror focus fights).
 */
function ImageNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? "";
  const title = (node.attrs.title as string | null) ?? "";

  return (
    <NodeViewWrapper className="rte-image relative my-3">
      <span className="group relative inline-block leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          title={title || undefined}
          onClick={() => setEditing(true)}
          className={`max-w-full cursor-pointer rounded ${
            selected ? "outline outline-2 outline-brand-primary" : ""
          }`}
        />
        <span
          contentEditable={false}
          className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <button
            type="button"
            title="Image settings"
            aria-label="Image settings"
            onClick={() => setEditing(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete image"
            aria-label="Delete image"
            onClick={() => deleteNode()}
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </span>
      {editing
        ? createPortal(
            <ImageSettingsModal
              alt={alt}
              title={title}
              onChange={(patch) => updateAttributes(patch)}
              onDelete={() => {
                setEditing(false);
                deleteNode();
              }}
              onClose={() => setEditing(false)}
            />,
            document.body,
          )
        : null}
    </NodeViewWrapper>
  );
}

function ImageSettingsModal({
  alt,
  title,
  onChange,
  onDelete,
  onClose,
}: {
  alt: string;
  title: string;
  onChange: (patch: { alt?: string; title?: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [a, setA] = useState(alt);
  const [t, setT] = useState(title);
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Image settings"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-brand-ink">
            Image settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] font-medium text-brand-mute">
            Alt text (SEO)
          </span>
          <input
            type="text"
            value={a}
            autoFocus
            onChange={(e) => {
              setA(e.target.value);
              onChange({ alt: e.target.value });
            }}
            placeholder="Describe the image for search engines + screen readers"
            maxLength={200}
            className="w-full rounded border border-brand-line px-2 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-brand-mute">
            Image title (tooltip)
          </span>
          <input
            type="text"
            value={t}
            onChange={(e) => {
              setT(e.target.value);
              onChange({ title: e.target.value });
            }}
            placeholder="Shown when a visitor hovers the image"
            maxLength={200}
            className="w-full rounded border border-brand-line px-2 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </label>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete image
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary btn-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The StarterKit-compatible Image extension wired to render through
 * `ImageNodeView` (hover controls + click-to-edit modal). Keeps the base Image
 * attributes (src, alt, title) + options (inline, allowBase64).
 */
export const ImageWithControls = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
