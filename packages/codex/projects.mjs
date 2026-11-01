import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export function createProjectResolver({ run = execute, now = Date.now } = {}) {
  const cache = new Map();
  return async (cwd) => {
    if (typeof cwd !== "string" || !path.isAbsolute(cwd))
      return { id: "unassigned", name: "其他会话", path: null };
    const directory = path.normalize(cwd),
      saved = cache.get(directory);
    if (saved && now() - saved.at < 300000) return saved.work;
    const work = (async () => {
      let root = directory;
      try {
        const result = await run(
          "git",
          [
            "-C",
            directory,
            "rev-parse",
            "--path-format=absolute",
            "--show-toplevel",
            "--git-common-dir",
          ],
          { timeout: 1500, maxBuffer: 8192 },
        );
        const [top, common] = (result.stdout || "").trim().split("\n");
        if (top && path.isAbsolute(top)) root = top;
        if (
          common &&
          path.isAbsolute(common) &&
          path.basename(common) === ".git"
        )
          root = path.dirname(common);
      } catch {}
      return { id: root, name: path.basename(root) || "其他会话", path: root };
    })();
    cache.set(directory, { at: now(), work });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return work;
  };
}
export const projectForCwd = createProjectResolver();
