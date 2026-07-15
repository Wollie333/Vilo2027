import { Section, Text } from "@react-email/components";
import * as React from "react";

// Label→value detail table in the Wielo email style — a bordered card where each
// row is a muted label cell + a value cell. Used inside Shell body content.

const BORDER = "#DCEAE0";
const LABEL_BG = "#F0FDF4";
const INK = "#052E1F";
const SECONDARY = "#064E3B";

export type DetailRow = {
  label: string;
  /** String, or any node (e.g. a <Link> for emails). */
  value: React.ReactNode;
};

export default function DetailTable({
  label,
  rows,
}: {
  /** Optional small uppercase heading above the table. */
  label?: string;
  rows: DetailRow[];
}) {
  const visible = rows.filter((r) => r.value !== null && r.value !== undefined);
  if (visible.length === 0) return null;
  return (
    <>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
      <Section style={styles.table}>
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={styles.tableEl}
        >
          <tbody>
            {visible.map((r, i) => {
              const last = i === visible.length - 1;
              return (
                <tr key={i}>
                  <td
                    style={{
                      ...styles.labelCell,
                      borderBottom: last ? "none" : `1px solid ${BORDER}`,
                    }}
                  >
                    {r.label}
                  </td>
                  <td
                    style={{
                      ...styles.valueCell,
                      borderBottom: last ? "none" : `1px solid ${BORDER}`,
                    }}
                  >
                    {r.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </>
  );
}

const styles = {
  sectionLabel: {
    margin: "0 0 10px",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#10B981",
    fontWeight: 700,
  },
  table: {
    border: `1px solid ${BORDER}`,
    borderRadius: "6px",
    overflow: "hidden",
    marginBottom: "24px",
  },
  tableEl: {
    borderCollapse: "collapse" as const,
  },
  labelCell: {
    width: "34%",
    backgroundColor: LABEL_BG,
    padding: "12px 16px",
    borderRight: `1px solid ${BORDER}`,
    fontSize: "11px",
    fontWeight: 700,
    color: SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    verticalAlign: "top" as const,
  },
  valueCell: {
    backgroundColor: "#FFFFFF",
    padding: "12px 16px",
    fontSize: "14px",
    color: INK,
    verticalAlign: "top" as const,
  },
};
