import { z } from "zod";

export const EclairPresetTemplateSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("system-path"),
    path: z.string(),
  }),
  z.object({
    type: z.literal("repo-rev-path"),
    repo: z.string(),
    rev: z.string(),
    path: z.string(),
  }),
]);

export type EclairPresetTemplateSource = z.infer<typeof EclairPresetTemplateSourceSchema>;

export const PresetSelectionStateSchema = z.object({
  source: EclairPresetTemplateSourceSchema,
  edited_flags: z.record(z.string(), z.boolean()),
});

export type PresetSelectionState = z.infer<typeof PresetSelectionStateSchema>;

export const EclairScaPresetConfigSchema = z.object({
  ruleset: PresetSelectionStateSchema,
  variants: z.array(PresetSelectionStateSchema),
  tailorings: z.array(PresetSelectionStateSchema),
});

export type EclairScaPresetConfig = z.infer<typeof EclairScaPresetConfigSchema>;

export const EclairScaCustomEclConfigSchema = z.object({
  ecl_path: z.string(),
});

export type EclairScaCustomEclConfig = z.infer<typeof EclairScaCustomEclConfigSchema>;

export const EclairScaZephyrRulesetConfigSchema = z.object({
  ruleset: z.string(),
  userRulesetName: z.string().optional(),
  userRulesetPath: z.string().optional(),
});

export type EclairScaZephyrRulesetConfig = z.infer<typeof EclairScaZephyrRulesetConfigSchema>;

export const EclairScaMainConfigSchema = z.discriminatedUnion("type", [
  EclairScaPresetConfigSchema.extend({
    type: z.literal("preset"),
  }),
  EclairScaCustomEclConfigSchema.extend({
    type: z.literal("custom-ecl"),
  }),
  EclairScaZephyrRulesetConfigSchema.extend({
    type: z.literal("zephyr-ruleset"),
  }),
]);

export type EclairScaMainConfig = z.infer<typeof EclairScaMainConfigSchema>;

export const ALL_ECLAIR_REPORTS = [
  "ECLAIR_METRICS_TAB",
  "ECLAIR_REPORTS_TAB",
  "ECLAIR_REPORTS_SARIF",
  "ECLAIR_SUMMARY_TXT",
  "ECLAIR_SUMMARY_DOC",
  "ECLAIR_SUMMARY_ODT",
  "ECLAIR_SUMMARY_HTML",
  "ECLAIR_FULL_TXT",
  "ECLAIR_FULL_DOC",
  "ECLAIR_FULL_ODT",
  "ECLAIR_FULL_HTML",
];

export type EclairScaReportOption = typeof ALL_ECLAIR_REPORTS[number];

export const EclairScaConfigSchema = z.object({
  install_path: z.string().optional(),
  config: EclairScaMainConfigSchema,
  extra_config: z.string().optional(),
  // either EclairScaReportOption or "ALL"
  reports: z.array(z.union([z.enum(ALL_ECLAIR_REPORTS), z.literal("ALL")])).optional(),
});

export type EclairScaConfig = z.infer<typeof EclairScaConfigSchema>;
