import path from "path";
import { ALL_ECLAIR_REPORTS, EclairScaConfig, EclairScaCustomEclConfig, EclairScaMainConfig, EclairScaPresetConfig, EclairScaZephyrRulesetConfig } from "../../utils/eclair/config";
import { accessSync } from "fs";
import fs from "fs";
import os from "os";
import { match } from "ts-pattern";

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
    .with({ type: "preset" }, c => handle_preset_config(parts, c))
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

        const content = `list(APPEND ECLAIR_ENV_ADDITIONAL_OPTIONS "-eval_file=${filePath}")\n`;
        fs.writeFileSync(wrapperPath, content, { encoding: "utf8" });
        finalPath = wrapperPath.replace(/\\/g, "/");
      }
      parts.push(`'-DECLAIR_OPTIONS_FILE=${finalPath}'`);
    }
  }

  return parts;
}

function handle_preset_config(parts: string[], cfg: EclairScaPresetConfig): string[] {
  // TODO
  return [];
}

function handle_custom_ecl_config(parts: string[], cfg: EclairScaCustomEclConfig): string[] {
  // TODO
  return [];
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


