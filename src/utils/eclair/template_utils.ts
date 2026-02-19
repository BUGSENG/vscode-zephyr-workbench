import {
  AnyDataValue,
  all_eclair_template_kinds,
  EclairTemplate,
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

function parse_map(value: unknown, field: string): Record<string, AnyDataValue> {
  if (value === undefined || value === null) {
    return {};
  }
  if (Array.isArray(value)) {
    const entries: [string, AnyDataValue][] = value.map((item) => {
      if (typeof item === "string") {
        return [item, true];
      }
      throw new Error(`Invalid template: ${field} array items must be strings`);
    });
    return Object.fromEntries(entries);
  }
  if (is_record(value)) {
    return Object.fromEntries(Object.entries(value) as [string, AnyDataValue][]);
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

  return {
    title,
    kind,
    description,
    authors,
    provides,
    requires,
    deps,
    options,
  };
}

type ResolvedFlags = {
  flags: Map<string, boolean>;
  flag_order: string[];
};

function resolve_flags(
  template: EclairTemplate,
  selected_options: Record<string, boolean>,
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

  for (const flag_id in selected_options) {
    const enabled = selected_options[flag_id];
    if (!flags.has(flag_id)) {
      throw new Error(`Unknown flag: ${flag_id}`);
    }
    flags.set(flag_id, enabled);
  }

  return { flags, flag_order };
}

export function format_flag_settings(
  template: EclairTemplate,
  selected_options: Record<string, boolean>,
): EclairSetFlag[] {
  const { flags, flag_order } = resolve_flags(template, selected_options);
  return flag_order.map((flag_id) => {
    const ecl_id = flag_to_ecl_identifier(flag_id);
    return {
      flag_id,
      ecl_id,
      source: selected_options[flag_id] === undefined ? "default" : "user",
      statement: `setq(${ecl_id},${flags.get(flag_id) ? "1" : "nil"})`,
    };
  });
}

export interface EclairSetFlag {
  flag_id: string;
  ecl_id: string;
  source: "default" | "user";
  statement: string,
}


export function flag_to_ecl_identifier(flag: string): string {
  const ecl_identifier = flag
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_]/g, "_");

  if (/^\d/.test(ecl_identifier)) {
    return "_" + ecl_identifier;
  }
  return ecl_identifier;
}
