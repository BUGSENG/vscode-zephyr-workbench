import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { getInternalToolsDirRealPath } from "../../utils/utils";

/**
 * Returns the root directory used to cache repo checkouts.
 * Structure: `<internalToolsDir>/sca/eclair/repos/checkouts/`
 */
function get_repo_checkouts_root(): string {
  return path.join(getInternalToolsDirRealPath(), "sca", "eclair", "repos", "checkouts");
}

/**
 * Returns a stable 12-character hex identifier derived from a git origin URL.
 */
function origin_hash(origin: string): string {
  return crypto.createHash("sha256").update(origin).digest("hex").slice(0, 12);
}

/**
 * Returns the on-disk path for a specific (origin, ref) checkout:
 * `<internalToolsDir>/sca/eclair/repos/checkouts/<origin-hash>/<ref>/`
 *
 * The `ref` component is sanitised so it cannot contain path separators or
 * characters illegal on common filesystems. The logical repo `name` is
 * intentionally NOT part of the path: two workspace projects may use repos
 * with different names that point at the same origin, and they should share
 * the same cached checkout. Conversely, two repos with the same name but
 * different origins must occupy distinct directories (the hash ensures this).
 */
function get_checkout_dir(origin: string, ref: string): string {
  const hash = origin_hash(origin);
  const safe_ref = ref.replace(/[/\\:*?"<>|]/g, "_");
  return path.join(get_repo_checkouts_root(), hash, safe_ref);
}

/**
 * Reads the `remote.origin.url` of an existing checkout using `git remote
 * get-url origin`.  Returns `undefined` if the command fails (e.g. the
 * directory is not a git repo or has no remote named "origin").
 */
async function read_remote_origin(dir: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const { exec } = require("child_process") as typeof import("child_process");
    exec("git remote get-url origin", { cwd: dir }, (_err, stdout) => {
      resolve(stdout.trim() || undefined);
    });
  });
}

/**
 * Ensures `origin`@`ref` is available at the canonical checkout directory and
 * returns the directory path.  Acts like a minimal package manager:
 *
 * - If the directory already exists AND its remote.origin.url matches the
 *   expected `origin`, it is returned immediately (fast path, no network).
 * - If the directory exists but the remote URL has changed (e.g. the user
 *   edited the repo entry), the stale checkout is deleted and re-cloned.
 * - Otherwise the repo is cloned with `--no-checkout`, the requested revision
 *   is fetched, and then checked out with `git checkout`.
 *
 * The checkout directory layout is:
 * `<internalToolsDir>/sca/eclair/repos/checkouts/<origin-hash>/<ref>/`
 *
 * @param name Logical / human-readable name (used only for log messages).
 * @param origin Git remote URL.
 * @param ref Branch, tag, or full commit SHA.
 * @returns The absolute path to the checked-out working tree.
 */
export async function ensureRepoCheckout(name: string, origin: string, ref: string): Promise<string> {
  const checkoutDir = get_checkout_dir(origin, ref);

  // Fast path: already checked out, verify the stored remote matches.
  const isGitDir = fs.existsSync(path.join(checkoutDir, ".git")) || fs.existsSync(path.join(checkoutDir, "HEAD"));

  if (isGitDir) {
    const storedOrigin = await read_remote_origin(checkoutDir);
    if (storedOrigin === origin) {
      return checkoutDir;
    }
    // Origin mismatch (shouldn't normally happen given the hash-based path,
    // but guard against hash collisions or manual edits).
    await fs.promises.rm(checkoutDir, { recursive: true, force: true });
  }

  // Create parent directories.
  await fs.promises.mkdir(checkoutDir, { recursive: true });

  const run = (cmd: string, cwd: string) =>
    new Promise<void>((resolve, reject) => {
      const { exec } = require("child_process") as typeof import("child_process");
      exec(cmd, { cwd }, (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`Command failed (${cmd}): ${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    });

  // Init an empty repo and fetch only the desired ref to keep bandwidth low.
  await run("git init", checkoutDir);
  await run(`git remote add origin ${JSON.stringify(origin)}`, checkoutDir);

  // Fetch the specific ref-spec. Works for both branches and tags.
  // For a commit SHA this fetch won't work on servers that don't allow
  // uploadpack.allowReachableSHA1InWant; in that case we fall back to a
  // shallow clone below.
  try {
    await run(`git fetch --depth=1 origin ${JSON.stringify(ref)}`, checkoutDir);
    await run("git checkout FETCH_HEAD", checkoutDir);
  } catch {
    // Fallback: plain shallow clone (slower but universally supported).
    // Remove the half-initialised directory and clone fresh.
    await fs.promises.rm(checkoutDir, { recursive: true, force: true });
    await fs.promises.mkdir(checkoutDir, { recursive: true });
    await run(
      `git clone --depth=1 --branch ${JSON.stringify(ref)} ${JSON.stringify(origin)} ${JSON.stringify(checkoutDir)}`,
      os.homedir()
    );
  }

  return checkoutDir;
}
