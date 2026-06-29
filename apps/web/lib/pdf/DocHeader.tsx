import { Image, Text, View } from "@react-pdf/renderer";

import { styles } from "./styles";

/**
 * Shared branded header for every financial document (invoice / quote / credit
 * note). Shows the host's logo when present (else a lettered square), the
 * business name as the wordmark, and a small platform attribution tagline.
 * The platform brand name is configurable (see lib/brand.ts) — never hardcode
 * it; routes pass the resolved value in as `brandName`.
 */
export function DocHeader({
  logoUrl,
  businessName,
  brandName = "Wielo",
  tagline,
}: {
  logoUrl?: string | null;
  businessName: string;
  brandName?: string;
  tagline?: string;
}) {
  const name = businessName?.trim() || brandName;
  const initial = name[0]?.toUpperCase() ?? "V";
  const tag = tagline ?? `Powered by ${brandName}`;
  return (
    <View style={styles.brandBlock}>
      {logoUrl ? (
        // @react-pdf Image (not an HTML img) — alt-text rule doesn't apply.
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={logoUrl} style={styles.brandLogo} />
      ) : (
        <Text style={styles.brandSquare}>{initial}</Text>
      )}
      <View>
        <Text style={styles.brandWordmark}>{name}</Text>
        <Text style={styles.brandTag}>{tag}</Text>
      </View>
    </View>
  );
}
