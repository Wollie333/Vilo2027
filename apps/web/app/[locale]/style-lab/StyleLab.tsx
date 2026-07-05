"use client";

// Standalone REVIEW page for the unified styling-control library (SSOT).
// Renders the REAL controls (components/builder/controls) so the founder can
// review look + behaviour before they're wired into the builders. Once approved,
// wiring = importing these same components into the page/nav/header/footer builders.

import { useState } from "react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";

import {
  ColorControl,
  ControlGroup,
  ControlRow,
  MediaControl,
  NumberControl,
  SegmentedControl,
  SelectControl,
  SliderControl,
  SpacingControl,
  StyleControlsProvider,
  ToggleControl,
} from "@/components/builder/controls/StyleControls";

// A representative theme palette (Business Principle #6 — real builders pass the
// active theme's swatches).
const SAMPLE_SWATCHES = [
  "#0F766E",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#111827",
  "#F4EEE6",
  "#FFFFFF",
];

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sl-card">
      <div className="sl-card-head">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      <div className="sl-card-body">{children}</div>
    </div>
  );
}

export function StyleLab() {
  const [tone, setTone] = useState<string>("#10B981");
  const [bg, setBg] = useState<string | undefined>("transparent");
  const [accent, setAccent] = useState<string | undefined>("#F59E0B");
  const [overlay, setOverlay] = useState<string | undefined>("#11182799");
  const [radius, setRadius] = useState(12);
  const [size, setSize] = useState(16);
  const [sticky, setSticky] = useState(true);
  const [upper, setUpper] = useState(false);
  const [align, setAlign] = useState<"start" | "center" | "end">("start");
  const [weight, setWeight] = useState<"normal" | "medium" | "bold">("medium");
  const [gap, setGap] = useState<number | undefined>(24);
  const [image, setImage] = useState<string | undefined>(undefined);
  const [space, setSpace] = useState<{
    py?: number;
    px?: number;
    mt?: number;
    mb?: number;
  }>({ py: 64, px: 24 });

  return (
    <StyleControlsProvider swatches={SAMPLE_SWATCHES}>
      <div className="sl-root wb">
        <header className="sl-top">
          <div>
            <h1>Styling controls — review</h1>
            <p>
              The single source of truth for every design-styling control across
              the website builders. Review the look &amp; behaviour here; once
              approved these exact components get wired into the page,
              navigation, header and footer builders.
            </p>
          </div>
          <span className="sl-badge">SSOT · draft for review</span>
        </header>

        <div className="sl-grid">
          <Card
            title="Colour"
            desc="Theme circles + a TRANSPARENT circle (a theme colour on every theme) + custom picker, an OPACITY slider, and a hex/rgba field. The popover is portaled above all cards & the canvas (z-index fixed)."
          >
            <ControlRow label="Colour tone" inline>
              <ColorControl
                value={tone}
                fallback="#10B981"
                onChange={setTone}
              />
            </ControlRow>
            <ControlRow label="Background (transparent + opacity)" inline>
              <ColorControl
                value={bg}
                fallback="#FFFFFF"
                onChange={setBg}
                onReset={() => setBg(undefined)}
              />
            </ControlRow>
            <ControlRow label="Accent" inline>
              <ColorControl
                value={accent}
                fallback="#F59E0B"
                onChange={setAccent}
                onReset={() => setAccent(undefined)}
              />
            </ControlRow>
            <ControlRow label="Overlay (colour + opacity)" inline>
              <ColorControl
                value={overlay}
                fallback="#000000"
                onChange={setOverlay}
                onReset={() => setOverlay(undefined)}
              />
            </ControlRow>
            <p className="sl-readout">
              tone <code>{tone}</code> · bg <code>{String(bg)}</code> · overlay{" "}
              <code>{String(overlay)}</code>
            </p>
          </Card>

          <Card
            title="Media / image"
            desc="Upload a file or paste a URL, with a live preview + clear. Wired into a builder, changing this updates the canvas at once (Business Principle #8) — e.g. a section background or a highlights card image."
          >
            <MediaControl
              label="Background image"
              value={image}
              onChange={setImage}
              onUpload={(file) => Promise.resolve(URL.createObjectURL(file))}
              hint="upload or URL"
            />
          </Card>

          <Card
            title="Sliders & numbers"
            desc="Range sliders with a live value read-out, and compact number fields for exact values."
          >
            <SliderControl
              label="Corner radius"
              min={0}
              max={40}
              value={radius}
              suffix="px"
              onChange={setRadius}
            />
            <SliderControl
              label="Font size"
              min={10}
              max={48}
              value={size}
              suffix="px"
              onChange={setSize}
            />
            <NumberControl
              label="Link spacing"
              value={gap}
              min={0}
              max={80}
              suffix="px"
              onChange={setGap}
            />
          </Card>

          <Card
            title="Toggles & segments"
            desc="On/off switches and segmented pickers (with optional icons) for enumerated choices."
          >
            <ToggleControl
              label="Sticky header"
              checked={sticky}
              onChange={setSticky}
            />
            <ToggleControl
              label="Uppercase links"
              hint="all caps"
              checked={upper}
              onChange={setUpper}
            />
            <SegmentedControl
              label="Alignment"
              value={align}
              onChange={setAlign}
              options={[
                {
                  value: "start",
                  icon: <AlignLeft size={15} />,
                  title: "Left",
                },
                {
                  value: "center",
                  icon: <AlignCenter size={15} />,
                  title: "Center",
                },
                {
                  value: "end",
                  icon: <AlignRight size={15} />,
                  title: "Right",
                },
              ]}
            />
            <SegmentedControl
              label="Weight"
              value={weight}
              onChange={setWeight}
              options={[
                { value: "normal", label: "Normal" },
                { value: "medium", label: "Medium" },
                { value: "bold", label: "Bold" },
              ]}
            />
          </Card>

          <Card
            title="Select"
            desc="Dropdown for longer option lists (fonts, layouts, page pickers…)."
          >
            <SelectControl
              label="Header layout"
              value={weight}
              onChange={setWeight}
              options={[
                { value: "normal", label: "Classic" },
                { value: "medium", label: "Centered" },
                { value: "bold", label: "Minimal" },
              ]}
            />
          </Card>

          <Card
            title="Spacing"
            desc="Per-block padding & margin — maps to the --el-* spacing engine."
          >
            <SpacingControl
              value={space}
              onChange={(p) => setSpace((s) => ({ ...s, ...p }))}
            />
          </Card>

          <Card
            title="In-context group"
            desc="How the controls read stacked inside an inspector section — the layout every builder panel will use."
          >
            <ControlGroup title="Section background">
              <ControlRow label="Background" inline>
                <ColorControl value={bg} fallback="#FFFFFF" onChange={setBg} />
              </ControlRow>
              <MediaControl
                label="Background image"
                value={image}
                onChange={setImage}
                onUpload={(file) => Promise.resolve(URL.createObjectURL(file))}
              />
              <ControlRow label="Overlay" inline>
                <ColorControl
                  value={overlay}
                  fallback="#000000"
                  onChange={setOverlay}
                />
              </ControlRow>
              <SliderControl
                label="Corner radius"
                min={0}
                max={40}
                value={radius}
                suffix="px"
                onChange={setRadius}
              />
            </ControlGroup>
          </Card>
        </div>
      </div>
    </StyleControlsProvider>
  );
}
