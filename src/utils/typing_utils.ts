
export type Result<Ok, Err> = { ok: Ok } | { err: Err };

export function unwrap_or_throw<Ok, Err>(result: Result<Ok, Err>): Ok {
  if ("ok" in result) {
    return result.ok;
  } else {
    throw new Error(String(result.err));
  }
}

export function unwrap_or_throw_async<Ok, Err>(result: Promise<Result<Ok, Err>>): Promise<Ok> {
  return result.then((r) => {
    if ("ok" in r) {
      return r.ok;
    } else {
      throw new Error(String(r.err));
    }
  });
}
