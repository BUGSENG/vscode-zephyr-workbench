import path from "path";
import { ALL_ECLAIR_REPORTS, EclairPresetTemplateSource, EclairRepos, EclairScaConfig, EclairScaCustomEclConfig, EclairScaMainConfig, EclairScaPresetConfig, EclairScaZephyrRulesetConfig, PresetSelectionState } from "../../utils/eclair/config";
import { accessSync } from "fs";
import fs from "fs";
import os from "os";
import { match } from "ts-pattern";
import { EclairTemplate } from "../../utils/eclair/template";
import { format_flag_settings } from "../../utils/eclair/template_utils";
import { SinglePresetSelectionState } from "../../webview/eclairmanager/state";
import { load_preset_from_ref } from "./templates";
import { Result, unwrap_or_throw_async } from "../../utils/typing_utils";

export function build_cmake_args(cfg: EclairScaConfig): string[] {
  const parts: string[] = [];
  let westCmd = "west";
  if (process.platform === "win32") {
    const westFromInstaller = path.join(
      process.env.USERPROFILE ?? "",
      ".zinstaller",
      ".venv",
      "Scripts",
      "west.exe"
    );
    try {
      accessSync(westFromInstaller);
      westCmd = `& "${westFromInstaller}"`;
    } catch {
      westCmd = "west";
    }
  }

  if (process.platform === "win32") {
    // Windows needs empty values to unset the launchers
    parts.push(
      "-DZEPHYR_SCA_VARIANT=eclair",
      "-DCMAKE_C_COMPILER_LAUNCHER=",
      "-DCMAKE_CXX_COMPILER_LAUNCHER="
    );
  }
  else {
    // Linux and macOS can use -U to unset the launchers
    parts.push(
      "-DZEPHYR_SCA_VARIANT=eclair",
      "-UCMAKE_C_COMPILER_LAUNCHER",
      "-UCMAKE_CXX_COMPILER_LAUNCHER"
    );
  }

  const additional_eclair_options = match(cfg.config)
    .with({ type: "preset" }, c => unwrap_or_throw_async(handle_preset_config(parts, c, cfg.repos ?? {}, (message) => {})))
    .with({ type: "custom-ecl" }, c => handle_custom_ecl_config(parts, c))
    .with({ type: "zephyr-ruleset" }, c => handle_zephyr_ruleset_config(parts, c))
    .exhaustive();

  const selected = (cfg.reports || []).includes("ALL")
    ? ALL_ECLAIR_REPORTS
    : (cfg.reports || []).filter(r => r !== "ALL");

  for (const r of selected) {
    parts.push(`-D${r}=ON`);
  }

  if (cfg.extra_config) {
    const p = cfg.extra_config.trim();

    if (
      p &&
      p !== "Checking" &&
      p !== "Not Found" &&
      fs.existsSync(p) &&
      !fs.statSync(p).isDirectory()
    ) {
      const ext = path.extname(p).toLowerCase();
      const filePath = p.replace(/\\/g, "/");

      let finalPath = filePath;
      if (ext === ".ecl" || ext === ".eclair") {
        // .ecl file needs a wrapper that uses -eval_file
        const wrapperPath = path.join(os.tmpdir(), "eclair_wrapper.cmake");

        let content = "";

        for (const opt of additional_eclair_options) {
          const escaped_opt = opt.replace(/"/g, '\\"');
          content += `list(APPEND ECLAIR_ENV_ADDITIONAL_OPTIONS "${escaped_opt}")\n`;
        }

        content += `list(APPEND ECLAIR_ENV_ADDITIONAL_OPTIONS "-eval_file=${filePath}")\n`;
        fs.writeFileSync(wrapperPath, content, { encoding: "utf8" });
        finalPath = wrapperPath.replace(/\\/g, "/");
      }
      parts.push(`'-DECLAIR_OPTIONS_FILE=${finalPath}'`);
    }
  }

  return parts;
}

async function handle_preset_config(
  parts: string[],
  cfg: EclairScaPresetConfig,
  repos: EclairRepos,
  on_progress: (message: string) => void,
): Promise<Result<string[], string>> {
  return await handle_sources(
    [cfg.ruleset, ...cfg.variants, ...cfg.tailorings],
    repos,
    on_progress,
  );
}

function handle_custom_ecl_config(parts: string[], cfg: EclairScaCustomEclConfig): string[] {
  return [`eval_file=${cfg.ecl_path.replace(/\\/g, "/")}`];
}

async function handle_sources(
  sel: PresetSelectionState[],
  repos: EclairRepos,
  on_progress: (message: string) => void,
): Promise<Result<string[], string>> {
  let all_commands: string[] = [];
  for (const s of sel) {
    let r = await handle_source(s, repos, on_progress);
    if ("err" in r) {
      return { err: `Failed to load preset: ${r.err}` };
    }
    all_commands = all_commands.concat(r.ok);
  }
  return { ok: all_commands };
}

async function handle_source(
  sel: PresetSelectionState,
  repos: EclairRepos,
  on_progress: (message: string) => void,
): Promise<Result<string[], string>> {
  let r = await load_preset_from_ref(sel.source, repos, on_progress);
  if ("err" in r) {
    return { err: `Failed to load preset: ${r.err}` };
  }
  const [preset, path] = r.ok;
  let eclair_commands = format_flag_settings(preset, sel.edited_flags);
  eclair_commands.push("-eval_file=\"" + path.replace(/\\/g, "/") + "\"");
  return { ok: eclair_commands };
}

function handle_zephyr_ruleset_config(parts: string[], cfg: EclairScaZephyrRulesetConfig): string[] {
  if (cfg.ruleset === "USER") {
    parts.push("-DECLAIR_RULESET_USER=ON");
    const name = (cfg.userRulesetName || "").trim();
    const p = (cfg.userRulesetPath || "").trim();
    if (name) parts.push(`-DECLAIR_USER_RULESET_NAME=\"${name}\"`);
    if (p) parts.push(`-DECLAIR_USER_RULESET_PATH=\"${p}\"`);
    parts.push("-DECLAIR_RULESET_FIRST_ANALYSIS=OFF");
  } else if (cfg.ruleset) {
    parts.push(`-D${cfg.ruleset}=ON`);
    if (cfg.ruleset !== "ECLAIR_RULESET_FIRST_ANALYSIS") {
      parts.push("-DECLAIR_RULESET_FIRST_ANALYSIS=OFF");
    }
  } else {
    parts.push("-DECLAIR_RULESET_FIRST_ANALYSIS=ON");
  }

  return [];
}

function build_cmake_additional_eclair_options_commands(eclair_options: string[]): string[] {
  const commands: string[] = [];
  for (const opt of eclair_options) {
    const escaped_opt = opt.replace(/"/g, '\\"');
    commands.push(`list(APPEND ECLAIR_ENV_ADDITIONAL_OPTIONS "${escaped_opt}")`);
  }
  return commands;
}
