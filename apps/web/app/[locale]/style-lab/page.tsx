// Standalone review page for the unified styling-control library (SSOT).
// Route: /<locale>/style-lab. Not linked in any nav — a design review surface.
import { StyleLab } from "./StyleLab";
// The builder chrome tokens (--line/--ink/--mute/--primary/--light) so the review
// matches the real builder; the controls also carry standalone fallbacks.
import "../builder/builder-chrome.css";
import "./style-lab.css";

export const metadata = { title: "Styling controls — review" };

export default function StyleLabPage() {
  return <StyleLab />;
}
