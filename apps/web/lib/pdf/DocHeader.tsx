import { Image, Text, View } from "@react-pdf/renderer";

import { styles } from "./styles";

/**
 * Shared branded header for every financial document (invoice / quote / credit
 * note). Shows the host's logo when present (else a lettered square), the
 * business name as the wordmark, and a small Vilo attribution tagline.
 */
export function DocHeader({
  logoUrl,
  businessName,
  tagline = "Powered by Vilo",
}: {
  logoUrl?: string | null;
  businessName: string;
  tagline?: string;
}) {
  const name = businessName?.trim() || "Vilo";
  const initial = name[0]?.toUpperCase() ?? "V";
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
        <Text style={styles.brandTag}>{tagline}</Text>
      </View>
    </View>
  );
}
