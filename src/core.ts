export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_CASES = 20_000;
export type Status = "passed" | "failure" | "error" | "skipped";
export type Change =
  | "regression"
  | "recovered"
  | "persistent"
  | "added"
  | "removed"
  | "changed"
  | "unchanged";
export interface TestCase {
  id: string;
  suite: string;
  classname: string;
  name: string;
  status: Status;
  seconds: number | null;
  detail: string;
}
export interface Report {
  name: string;
  cases: TestCase[];
  warnings: string[];
}
export interface Delta {
  id: string;
  before?: TestCase;
  after?: TestCase;
  change: Change;
  secondsDelta: number | null;
}
export const isFailure = (status?: Status) =>
  status === "failure" || status === "error";

/** Native inert XML parsing. No network, entity definitions, or HTML rendering. */
export function parseReport(xml: string, name = "report.xml"): Report {
  if (new TextEncoder().encode(xml).length > MAX_BYTES)
    throw new Error("Report exceeds the 5 MiB limit. / 5 MiBを超えています。");
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))
    throw new Error(
      "DTD and entity declarations are not supported. / DTD・実体宣言は使用できません。",
    );
  const declaredEncoding = xml.match(
    /<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)["']/i,
  )?.[1];
  if (declaredEncoding && !/^utf-?8$/i.test(declaredEncoding))
    throw new Error("Use UTF-8 XML. / UTF-8形式のXMLを選択してください。");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length)
    throw new Error(
      "Invalid XML. Check that the report is complete. / XMLの形式を確認してください。",
    );
  const root = document.documentElement;
  if (!["testsuite", "testsuites"].includes(root.localName))
    throw new Error(
      "Expected a JUnit testsuite or testsuites root. / JUnit XMLを選択してください。",
    );
  const cases: TestCase[] = [];
  const ids = new Set<string>();
  const warnings = new Set<string>();
  const stack: { element: Element; path: string[]; depth: number }[] = [
    { element: root, path: [], depth: 0 },
  ];
  while (stack.length) {
    const { element, path, depth } = stack.pop()!;
    if (depth > 32)
      throw new Error(
        "Suite nesting exceeds 32 levels. / suiteの入れ子が深すぎます。",
      );
    const currentPath =
      element.localName === "testsuite"
        ? [...path, element.getAttribute("name") || "(unnamed suite)"]
        : path;
    for (const child of Array.from(element.children).reverse()) {
      if (["testsuite", "testsuites"].includes(child.localName)) {
        stack.push({ element: child, path: currentPath, depth: depth + 1 });
      } else if (child.localName === "testcase") {
        const caseName = child.getAttribute("name");
        if (!caseName?.trim())
          throw new Error(
            "A testcase is missing its name. / 名前のないtestcaseがあります。",
          );
        const classname = child.getAttribute("classname") || "";
        const id = JSON.stringify([currentPath, classname, caseName]);
        if (ids.has(id))
          throw new Error(
            `Duplicate test identity: ${caseName}. Compare one shard/run at a time. / 同名テストが重複しています。`,
          );
        ids.add(id);
        const children = Array.from(child.children);
        const markers = children.filter((item) =>
          ["error", "failure", "skipped"].includes(item.localName),
        );
        const status: Status = markers.some(
          (item) => item.localName === "error",
        )
          ? "error"
          : markers.some((item) => item.localName === "failure")
            ? "failure"
            : markers.some((item) => item.localName === "skipped")
              ? "skipped"
              : "passed";
        if (new Set(markers.map((item) => item.localName)).size > 1)
          warnings.add(
            "Conflicting status markers: error > failure > skipped takes precedence. / 状態の重複を検出しました。",
          );
        if (children.some((item) => /^(flaky|rerun)/i.test(item.localName)))
          warnings.add(
            "Retry/flaky extensions are present; only the final standard status is compared. / 再試行情報は比較対象外です。",
          );
        const time = child.getAttribute("time");
        const seconds =
          time !== null &&
          time.trim() !== "" &&
          /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(time.trim()) &&
          Number.isFinite(Number(time))
            ? Number(time)
            : null;
        if (seconds === null)
          warnings.add(
            "Some durations are missing or invalid; their timing differences are unavailable. / 時間不明のテストがあります。",
          );
        const detail = markers
          .map((item) =>
            [item.getAttribute("message"), item.textContent]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n");
        cases.push({
          id,
          suite: currentPath.join(" / "),
          classname,
          name: caseName,
          status,
          seconds,
          detail,
        });
        if (cases.length > MAX_CASES)
          throw new Error(
            "Report exceeds 20,000 testcases. / 20,000件を超えています。",
          );
      } else if (["error", "failure"].includes(child.localName)) {
        warnings.add(
          "Suite-level failures exist and are not individual testcases. Inspect the original report. / suite単位のエラーは原本を確認してください。",
        );
      }
    }
  }
  const allElements = Array.from(document.getElementsByTagName("*"));
  if (
    allElements.filter((item) => item.localName === "testcase").length !==
    cases.length
  )
    throw new Error(
      "Unsupported testcase nesting. / testcaseの配置がサポート対象外です。",
    );
  if (
    !cases.length &&
    allElements.some((item) => Number(item.getAttribute("tests")) > 0)
  )
    throw new Error(
      "The report declares tests but contains no readable testcases. / テストの明細がありません。",
    );
  if (!cases.length)
    warnings.add("This report contains zero testcases. / テストは0件です。");
  return { name, cases, warnings: [...warnings] };
}

export async function readReport(file: File): Promise<Report> {
  if (file.size > MAX_BYTES)
    throw new Error("Report exceeds the 5 MiB limit. / 5 MiBを超えています。");
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(
      "Could not read UTF-8 XML. / UTF-8形式のXMLを選択してください。",
    );
  }
  return parseReport(xml, file.name);
}

export function compareReports(before: Report, after: Report): Delta[] {
  const old = new Map(before.cases.map((item) => [item.id, item]));
  const current = new Map(after.cases.map((item) => [item.id, item]));
  return [...new Set([...old.keys(), ...current.keys()])].map((id) => {
    const a = old.get(id),
      b = current.get(id);
    let change: Change;
    if (!a) change = "added";
    else if (!b) change = "removed";
    else if (!isFailure(a.status) && isFailure(b.status)) change = "regression";
    else if (isFailure(a.status) && b.status === "passed") change = "recovered";
    else if (isFailure(a.status) && isFailure(b.status)) change = "persistent";
    else if (a.status !== b.status) change = "changed";
    else change = "unchanged";
    return {
      id,
      before: a,
      after: b,
      change,
      secondsDelta:
        a?.seconds != null && b?.seconds != null ? b.seconds - a.seconds : null,
    };
  });
}

export function isSlowdown(
  row: Delta,
  minimumSeconds = 0.1,
  minimumPercent = 20,
): boolean {
  if (
    row.before?.status !== "passed" ||
    row.after?.status !== "passed" ||
    row.secondsDelta === null
  )
    return false;
  return (
    row.secondsDelta > 0 &&
    row.secondsDelta + 1e-9 >= minimumSeconds &&
    (row.before.seconds === 0 ||
      (row.secondsDelta / row.before.seconds!) * 100 + 1e-9 >= minimumPercent)
  );
}

export function exportSummary(before: Report, after: Report, rows: Delta[]) {
  const safeCase = (item?: TestCase) =>
    item
      ? {
          suite: item.suite,
          classname: item.classname,
          name: item.name,
          status: item.status,
          seconds: item.seconds,
        }
      : null;
  return {
    schemaVersion: 1,
    baseline: before.name,
    current: after.name,
    identity: "suite path + classname + name",
    warnings: { baseline: before.warnings, current: after.warnings },
    counts: Object.fromEntries(
      [
        "regression",
        "recovered",
        "persistent",
        "added",
        "removed",
        "changed",
        "unchanged",
      ].map((kind) => [kind, rows.filter((row) => row.change === kind).length]),
    ),
    tests: rows.map((row) => ({
      change: row.change,
      before: safeCase(row.before),
      after: safeCase(row.after),
      secondsDelta: row.secondsDelta,
    })),
  };
}
const markdownCell = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&")
    .replace(/[\r\n]/g, " ");
export function exportMarkdown(
  before: Report,
  after: Report,
  rows: Delta[],
): string {
  return [
    "# JUnit Diff Lens",
    "",
    `${markdownCell(before.name)} → ${markdownCell(after.name)}`,
    "",
    "Identity: suite path + classname + name. Durations are testcase sums, not wall-clock measurements.",
    "Contains test names and filenames; review before sharing. Failure text and logs are excluded.",
    "",
    ...[...before.warnings, ...after.warnings].map(
      (w) => `Warning: ${markdownCell(w)}`,
    ),
    "",
    "| Change | Suite / class / test | Before | After | Δ seconds |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const test = row.after || row.before!;
      return `| ${row.change} | ${markdownCell([test.suite, test.classname, test.name].filter(Boolean).join(" / "))} | ${row.before?.status || "—"} | ${row.after?.status || "—"} | ${row.secondsDelta?.toFixed(3) ?? "—"} |`;
    }),
    "",
  ].join("\n");
}
