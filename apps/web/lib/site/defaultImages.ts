// Default stock imagery for site sections whose image slot the host left empty.
//
// Contract: a host-provided image ALWAYS wins. These defaults only fill a slot
// that would otherwise render empty (e.g. an experience card with no photo), so a
// freshly-built site never shows a blank gradient tile. All URLs are free-to-use
// Unsplash photos (the same source the theme sample data already uses, so they are
// proven to load) served at a sensible width.
//
// "Relevant to the copy": each default is chosen by keyword-matching the item's
// own title/body against a small category map, falling back to a rotating set of
// warm, on-brand lodge/stay images when nothing matches — so the picture at least
// fits the section, and usually fits the specific card. Categories hold SEVERAL
// images and rotate by index, so a set of cards that all match one category (e.g.
// three safari experiences) don't repeat a single photo.

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Keyword → images (rotated by index). First matching category wins; order = priority. */
const CATEGORIES: { keys: RegExp; imgs: string[] }[] = [
  {
    keys: /safari|game drive|big five|wildlife|bush|lion|elephant|leopard|rhino|buffalo|ranger|tracker|reserve/i,
    imgs: [
      U("photo-1516426122078-c23e76319801"),
      U("photo-1547970810-dc1eac37d174"),
      U("photo-1534177616072-ef7dc120449d"),
    ],
  },
  {
    keys: /walk|hike|trail|mountain|forest|nature|trek|summit|valley|karoo|fynbos/i,
    imgs: [
      U("photo-1469474968028-56623f02e42e"),
      U("photo-1466692476868-aef1dfb1e735"),
    ],
  },
  {
    keys: /dinner|dining|food|boma|meal|supper|feast|breakfast|restaurant|chef|cuisine|table/i,
    imgs: [
      U("photo-1414235077428-338989a2e8c0"),
      U("photo-1559339352-11d035aa65de"),
    ],
  },
  {
    keys: /star|night|sky|astronom|sleep out|milky way|constellat/i,
    imgs: [U("photo-1502602898657-3e91760cbb34")],
  },
  {
    keys: /beach|ocean|sea|coast|shore|tide|surf|sand|dune/i,
    imgs: [U("photo-1505228395891-9a51e7e86bf6")],
  },
  {
    keys: /pool|swim|plunge|lido/i,
    imgs: [U("photo-1571003123894-1f0594d2b5d9")],
  },
  {
    keys: /spa|wellness|massage|sauna|yoga|treatment|unwind/i,
    imgs: [U("photo-1540541338287-41700207dee6")],
  },
  {
    keys: /wine|vineyard|cellar|tasting|estate/i,
    imgs: [U("photo-1506377247377-2a5b3b417ebb")],
  },
  {
    keys: /sunset|sundowner|dusk|golden hour|horizon/i,
    imgs: [U("photo-1504870712357-65ea720d6078")],
  },
  {
    keys: /fire|boma fire|firepit|campfire|hearth/i,
    imgs: [U("photo-1475738972911-5b44ce984c42")],
  },
  {
    keys: /river|lake|water|canoe|kayak|paddle|dam/i,
    imgs: [U("photo-1455587734955-081b22074882")],
  },
];

/** A rotating fallback set of warm, generic stay/lodge images (no keyword match). */
const FALLBACK = [
  U("photo-1566073771259-6a8506099945"), // hotel exterior / stay
  U("photo-1564501049412-61c2a3083791"), // cabin in nature
  U("photo-1520250497591-112f2f40a3f4"), // suite interior
];

/**
 * A default image for a text-bearing card (experience / highlight / feature) whose
 * host image is empty. `text` is the card's own copy (title + body) so the pick is
 * relevant to what it describes; `index` rotates within the matched category (and
 * the fallback) so a set of cards doesn't repeat a single photo.
 */
export function defaultCardImage(text: string, index = 0): string {
  const hay = (text || "").toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keys.test(hay)) return cat.imgs[index % cat.imgs.length];
  }
  return FALLBACK[index % FALLBACK.length];
}
