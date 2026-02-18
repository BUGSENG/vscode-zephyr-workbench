import {
  AnyDataValue,
  all_eclair_template_kinds,
  EclairTemplate,
  EclairTemplateCondition,
  EclairTemplateContent,
  EclairTemplateKind,
  EclairTemplateOption,
} from "./template";


function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extract_yaml_from_ecl_content(ecl_text: string): string | undefined {
  const lines = ecl_text.split(/\r?\n/);
  const start_markers = new Set(["'meta", "'meta:", "'ECL", "'ECL:"]);
  let start_index = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (start_markers.has(lines[i].trim())) {
      start_index = i + 1;
      break;
    }
  }

  if (start_index === -1) {
    return undefined;
  }

  let end_index = -1;
  for (let i = start_index; i < lines.length; i += 1) {
    if (lines[i].trim() === "'") {
      end_index = i;
      break;
    }
  }

  if (end_index === -1) {
    return undefined;
  }

  return lines.slice(start_index, end_index).join("\n");
}

function parse_string(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid template: ${field} must be a string`);
  }
  return value;
}

function parse_description(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  throw new Error("Invalid template: description must be a string");
}

function parse_authors(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Invalid template: authors must be an array of strings");
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`Invalid template: authors[${index}] must be a string`);
    }
    return item;
  });
}

function parse_map(value: unknown, field: string): Map<string, AnyDataValue> {
  if (value === undefined || value === null) {
    return new Map();
  }
  if (Array.isArray(value)) {
    const entries: [string, AnyDataValue][] = value.map((item) => {
      if (typeof item === "string") {
        return [item, true];
      }
      throw new Error(`Invalid template: ${field} array items must be strings`);
    });
    return new Map(entries);
  }
  if (is_record(value)) {
    return new Map(Object.entries(value) as [string, AnyDataValue][]);
  }
  throw new Error(`Invalid template: ${field} must be an object or an array`);
}

function parse_deps(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Invalid template: deps must be an array of strings");
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`Invalid template: deps[${index}] must be a string`);
    }
    return item;
  });
}

function parse_option(value: unknown): EclairTemplateOption {
  if (!is_record(value)) {
    throw new Error("Invalid template: option must be an object");
  }

  const id = parse_string(value.id, "option.id");
  const title = typeof value.title === "string" ? value.title :
    (typeof value.description === "string" ? value.description : undefined);

  const kind_value = value.kind ?? value.variant;
  if (!is_record(kind_value) && typeof kind_value !== "string") {
    throw new Error("Invalid template: option.kind must be a string or object");
  }

  const kind = typeof kind_value === "string" ? kind_value : kind_value.kind;
  if (kind === "group") {
    const children_raw = typeof kind_value === "string" ? value.children : kind_value.children;
    if (!Array.isArray(children_raw)) {
      throw new Error("Invalid template: group option requires children array");
    }
    const children = children_raw.map(parse_option);
    return {
      id,
      title,
      variant: {
        kind: "group",
        children,
      },
    };
  }

  if (kind === "flag") {
    const default_value = typeof kind_value === "string" ? value.default : kind_value.default;
    if (default_value !== undefined && typeof default_value !== "boolean") {
      throw new Error("Invalid template: flag option default must be boolean");
    }
    return {
      id,
      title,
      variant: {
        kind: "flag",
        default: default_value,
      },
    };
  }

  throw new Error("Invalid template: option.kind must be 'group' or 'flag'");
}

function parse_options(value: unknown): EclairTemplateOption[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Invalid template: options must be an array");
  }
  return value.map(parse_option);
}

function parse_condition(value: unknown): EclairTemplateCondition {
  if (typeof value === "string") {
    return { kind: "flag", flag_id: value };
  }
  if (!is_record(value)) {
    throw new Error("Invalid template: condition must be an object or string");
  }

  if (typeof value.kind === "string") {
    if (value.kind === "flag") {
      return { kind: "flag", flag_id: parse_string(value.flag_id, "condition.flag_id") };
    }
    if (value.kind === "any_of" || value.kind === "all_of") {
      if (!Array.isArray(value.conditions)) {
        throw new Error("Invalid template: condition.conditions must be an array");
      }
      const conditions = value.conditions.map(parse_condition);
      return { kind: value.kind, conditions };
    }
    if (value.kind === "not") {
      return { kind: "not", condition: parse_condition(value.condition) };
    }
    if (value.kind === "starts_with") {
      return {
        kind: "starts_with",
        str: parse_string(value.str, "condition.str"),
        prefix: parse_string(value.prefix, "condition.prefix"),
      };
    }
  }

  if (typeof value.flag === "string") {
    return { kind: "flag", flag_id: value.flag };
  }
  if (Array.isArray(value.any)) {
    return { kind: "any_of", conditions: value.any.map(parse_condition) };
  }
  if (Array.isArray(value.all)) {
    return { kind: "all_of", conditions: value.all.map(parse_condition) };
  }
  if (value.not !== undefined) {
    return { kind: "not", condition: parse_condition(value.not) };
  }
  if (is_record(value.starts_with)) {
    return {
      kind: "starts_with",
      str: parse_string(value.starts_with.str, "condition.starts_with.str"),
      prefix: parse_string(value.starts_with.prefix, "condition.starts_with.prefix"),
    };
  }

  throw new Error("Invalid template: unrecognized condition format");
}

function parse_content(value: unknown): EclairTemplateContent {
  if (typeof value === "string") {
    return { kind: "string_value", value };
  }
  if (Array.isArray(value)) {
    return { kind: "joined_list", items: value.map(parse_content) };
  }
  if (!is_record(value)) {
    throw new Error("Invalid template: content must be a string, array, or object");
  }

  if (typeof value.kind === "string") {
    if (value.kind === "string_value") {
      return { kind: "string_value", value: parse_string(value.value, "content.value") };
    }
    if (value.kind === "joined_list") {
      if (!Array.isArray(value.items)) {
        throw new Error("Invalid template: content.items must be an array");
      }
      return { kind: "joined_list", items: value.items.map(parse_content) };
    }
    if (value.kind === "conditional") {
      return {
        kind: "conditional",
        condition: parse_condition(value.condition),
        then_content: value.then_content !== undefined ? parse_content(value.then_content) : undefined,
        else_content: value.else_content !== undefined ? parse_content(value.else_content) : undefined,
      };
    }
  }

  if (value.if !== undefined) {
    return {
      kind: "conditional",
      condition: parse_condition(value.if),
      then_content: value.then !== undefined ? parse_content(value.then) : undefined,
      else_content: value.else !== undefined ? parse_content(value.else) : undefined,
    };
  }

  if (typeof value.for === "string" && value.in !== undefined && value.yield !== undefined) {
    if (value.in !== "ALL_FLAGS") {
      throw new Error("Invalid template: for-in only supports 'ALL_FLAGS'");
    }
    return {
      kind: "for_each",
      item: value.for,
      in: "ALL_FLAGS",
      yield: parse_content(value.yield),
    };
  }

  throw new Error("Invalid template: unrecognized content format");
}

export function parse_eclair_template_from_any(data: unknown): EclairTemplate {
  if (!is_record(data)) {
    throw new Error("Invalid template: expected an object");
  }

  const title = parse_string(data.title, "title");
  if (data.kind === undefined || typeof data.kind !== "string" || !all_eclair_template_kinds.includes(data.kind as EclairTemplateKind)) {
    throw new Error("Invalid template: kind must be one of 'ruleset', 'variant', 'tailoring'");
  }
  const kind: EclairTemplateKind = data.kind as EclairTemplateKind;

  const description = parse_description(data.description);
  const authors = parse_authors(data.authors);
  const provides = parse_map(data.provides, "provides");
  const requires = parse_map(data.requires, "requires");
  const deps = parse_deps(data.deps);
  const options = parse_options(data.options);
  const content = data.content !== undefined && data.content !== null
    ? parse_content(data.content)
    : undefined;

  return {
    title,
    kind,
    description,
    authors,
    provides,
    requires,
    deps,
    options,
    content,
  };
}

type ResolvedFlags = {
  flags: Map<string, boolean>;
  flag_order: string[];
};

function resolve_flags(
  template: EclairTemplate,
  selected_options: Map<string, boolean>,
): ResolvedFlags {
  const flags = new Map<string, boolean>();
  const flag_order: string[] = [];

  const collect_flags = (options: EclairTemplateOption[]) => {
    for (const option of options) {
      if (option.variant.kind === "group") {
        collect_flags(option.variant.children);
      } else {
        flags.set(option.id, option.variant.default ?? false);
        flag_order.push(option.id);
      }
    }
  };

  collect_flags(template.options);

  for (const [flag_id, enabled] of selected_options) {
    if (!flags.has(flag_id)) {
      throw new Error(`Unknown flag: ${flag_id}`);
    }
    flags.set(flag_id, enabled);
  }

  return { flags, flag_order };
}

export function format_flag_settings(
  template: EclairTemplate,
  selected_options: Map<string, boolean>,
): string[] {
  const { flags, flag_order } = resolve_flags(template, selected_options);
  return flag_order.map((flag_id) => `set(${flag_id},${flags.get(flag_id) ? "1" : "nil"})`);
}

export function instantiate(
  template: EclairTemplate,
  selected_options: Map<string, boolean>,
): string {
  const { flags, flag_order } = resolve_flags(template, selected_options);

  const expand_condition = (condition: EclairTemplateCondition, env: Map<string, string>): EclairTemplateCondition => {
    switch (condition.kind) {
      case "flag":
        return { kind: "flag", flag_id: expand_variables(condition.flag_id, env) };
      case "any_of":
        return { kind: "any_of", conditions: condition.conditions.map((item) => expand_condition(item, env)) };
      case "all_of":
        return { kind: "all_of", conditions: condition.conditions.map((item) => expand_condition(item, env)) };
      case "not":
        return { kind: "not", condition: expand_condition(condition.condition, env) };
      case "starts_with":
        return {
          kind: "starts_with",
          str: expand_variables(condition.str, env),
          prefix: expand_variables(condition.prefix, env),
        };
    }
  };

  const eval_condition = (condition: EclairTemplateCondition): boolean => {
    switch (condition.kind) {
      case "flag":
        return flags.get(condition.flag_id) ?? false;
      case "any_of":
        return condition.conditions.some(eval_condition);
      case "all_of":
        return condition.conditions.every(eval_condition);
      case "not":
        return !eval_condition(condition.condition);
      case "starts_with":
        return condition.str.startsWith(condition.prefix);
    }
  };

  const render_content = (content: EclairTemplateContent, env: Map<string, string>): string => {
    switch (content.kind) {
      case "string_value":
        return expand_variables(content.value, env);
      case "joined_list": {
        const parts = content.items.map((item) => render_content(item, env)).filter((item) => item !== "");
        return parts.join("\n");
      }
      case "conditional": {
        const expanded_condition = expand_condition(content.condition, env);
        const condition_met = eval_condition(expanded_condition);
        if (condition_met) {
          return content.then_content ? render_content(content.then_content, env) : "";
        }
        return content.else_content ? render_content(content.else_content, env) : "";
      }
      case "for_each": {
        if (content.in !== "ALL_FLAGS") {
          throw new Error("Invalid template: for-each only supports ALL_FLAGS");
        }
        const parts: string[] = [];
        for (const flag_id of flag_order) {
          const next_env = new Map(env);
          next_env.set(content.item, flag_id);
          const rendered = render_content(content.yield, next_env);
          if (rendered !== "") {
            parts.push(rendered);
          }
        }
        return parts.join("\n");
      }
    }
  };

  const base_env = new Map<string, string>();
  if (!template.content) {
    return "";
  }
  return render_content(template.content, base_env);
}

function expand_variables(text: string, env: Map<string, string>): string {
  const var_pattern = /\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}/g;
  return text.replace(var_pattern, (match, short_var, brace_var) => {
    const name = (short_var ?? brace_var) as string | undefined;
    if (!name) {
      return match;
    }
    if (match.includes(":-")) {
      throw new Error("Default variable syntax is not implemented yet");
    }
    if (!env.has(name)) {
      throw new Error(`Unknown variable: ${name}`);
    }
    return env.get(name) as string;
  });
}

