
export type Result<Ok, Err> = { ok: Ok } | { err: Err };

export function unwrap_or_throw<Ok, Err>(result: Result<Ok, Err>): Ok {
  if ("ok" in result) {
    return result.ok;
  } else {
    throw new Error(String(result.err));
  }
}
