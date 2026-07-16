// The nine South African provinces — the single region vocabulary shared by the
// Looking-For post form (what a guest picks) and the host alert form (what a host
// filters on). Keeping ONE list is what makes exact region matching reliable: the
// alert matcher compares these strings, so both sides must draw from here.
export const SA_PROVINCES = [
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "KwaZulu-Natal",
  "Free State",
  "North West",
  "Gauteng",
  "Mpumalanga",
  "Limpopo",
] as const;

// The Looking-For post categories a guest can choose — shared so host alerts can
// filter on the exact same set (an alert category that isn't a real post category
// could never match).
export const LOOKING_FOR_CATEGORIES = [
  { value: "accommodation", label: "Accommodation" },
  { value: "experience", label: "Experience" },
  { value: "venue", label: "Venue" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const;
