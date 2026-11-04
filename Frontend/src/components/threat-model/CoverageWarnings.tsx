"use client";

import { useTranslations } from "next-intl";
import {
  BoxedAccordion,
  BoxedAccordionItem,
  IconAlertRegular,
  Stack,
  Text2,
  skinVars,
} from "@telefonica/mistica";
import type { CoverageWarning } from "@/lib/api/types";

interface CoverageWarningsProps {
  warnings: CoverageWarning[];
}

function CoverageWarnings({ warnings }: CoverageWarningsProps) {
  const t = useTranslations("results.coverage");
  const unreachable = [...new Set(warnings.filter((w) => w.kind === "not_expressible").flatMap((w) => w.rules))];
  const declarable = warnings.filter((w) => w.kind === "needs_declaration");
  const ignored = warnings.filter((w) => w.kind === "ignored_property");
  const ruleCount = new Set([...unreachable, ...declarable.flatMap((w) => w.rules)]).size;
  const summary = [
    ruleCount > 0 && t("rulesSummary", { count: ruleCount }),
    ignored.length > 0 && t("ignoredSummary", { count: ignored.length }),
  ].filter(Boolean).join(" · ");

  return (
    <BoxedAccordion dataAttributes={{ testid: "coverage-warnings" }}>
      <BoxedAccordionItem
        title={ruleCount > 0 ? t("title") : t("ignoredTitle")}
        subtitle={summary}
        asset={<IconAlertRegular color={skinVars.colors.warning} />}
        content={
          <Stack space={16}>
            {unreachable.length > 0 && (
              <Stack space={4}>
                <Text2 medium>{t("unreachableTitle")}</Text2>
                <Text2 regular color={skinVars.colors.textSecondary}>{unreachable.join(", ")}</Text2>
              </Stack>
            )}
            {declarable.length > 0 && (
              <Stack space={4}>
                <Text2 medium>{t("declarableTitle")}</Text2>
                {declarable.map((w) => (
                  <Text2 key={w.rules.join()} regular color={skinVars.colors.textSecondary}>
                    {t("declarable", { rules: w.rules.join(", "), properties: w.properties.join(", ") })}
                  </Text2>
                ))}
              </Stack>
            )}
            {ignored.length > 0 && (
              <Stack space={4}>
                {ruleCount > 0 && <Text2 medium>{t("ignoredTitle")}</Text2>}
                {ignored.map((w, i) => {
                  const values = { property: w.properties.join(", "), node: w.node ?? "" };
                  return (
                    <Text2 key={`${values.node}-${values.property}-${i}`} regular color={skinVars.colors.textSecondary}>
                      {w.suggestion
                        ? t("ignoredWithSuggestion", { ...values, suggestion: w.suggestion })
                        : t("ignored", values)}
                    </Text2>
                  );
                })}
              </Stack>
            )}
          </Stack>
        }
      />
    </BoxedAccordion>
  );
}

export default CoverageWarnings;
