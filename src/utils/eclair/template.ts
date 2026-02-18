
export interface EclairTemplate {
  title: string;
  kind: EclairTemplateKind;
  description: string;
  authors: string[];
  provides: Map<string, AnyDataValue>;
  requires: Map<string, AnyDataValue>;
  deps: string[];
  options: EclairTemplateOption[];
  content: EclairTemplateContent;
}

export type AnyDataValue = string | number | boolean | null | AnyDataValue[] | { [key: string]: AnyDataValue };

export const all_eclair_template_kinds = ["ruleset", "variant", "tailoring"] as const;
export type EclairTemplateKind = typeof all_eclair_template_kinds[number];

export type EclairTemplateOption = {
  id: string;
  title?: string;
  variant: EclairTemplateOptionVariant;
};

export type EclairTemplateOptionVariant =
  EclairTemplateGroupOption |
  EclairTemplateFlagOption;

export type EclairTemplateGroupOption = {
  kind: "group";
  children: EclairTemplateOption[];
};

export type EclairTemplateFlagOption = {
  kind: "flag";
  default?: boolean;
};

export type EclairTemplateContent =
  EclairTemplateStringValueContent |
  EclairTemplateJoinedListContent |
  EclairTemplateConditionalContent |
  EclairTemplateForEachContent;

export type EclairTemplateStringValueContent = {
  kind: "string_value";
  value: string;
};

export type EclairTemplateJoinedListContent = {
  kind: "joined_list";
  items: EclairTemplateContent[];
};

export type EclairTemplateConditionalContent = {
  kind: "conditional";
  condition: EclairTemplateCondition;
  then_content?: EclairTemplateContent;
  else_content?: EclairTemplateContent;
};

export type EclairTemplateForEachContent = {
  kind: "for_each";
  item: string;
  in: "ALL_FLAGS";
  yield: EclairTemplateContent;
};

/**
 * All the available predicates that can be used in "if" conditions.
 */
export type EclairTemplateCondition = {
  kind: "flag";
  flag_id: string;
} | {
  kind: "any_of";
  conditions: EclairTemplateCondition[];
} | {
  kind: "all_of";
  conditions: EclairTemplateCondition[];
} | {
  kind: "not";
  condition: EclairTemplateCondition;
} | {
  kind: "starts_with";
  str: string;
  prefix: string;
};

