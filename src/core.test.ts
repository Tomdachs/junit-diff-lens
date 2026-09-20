import { describe, expect, it } from "vitest";
import {
  compareReports,
  exportMarkdown,
  exportSummary,
  isSlowdown,
  MAX_BYTES,
  parseReport,
} from "./core";
import { baseline, current } from "./demo";
const suite = (body: string, name = "suite") =>
  `<testsuite name="${name}">${body}</testsuite>`;
const testcase = (status = "", time = "1") =>
  `<testcase classname="C" name="test" time="${time}">${status ? `<${status}/>` : ""}</testcase>`;
const diff = (a: string, b: string) =>
  compareReports(parseReport(suite(a)), parseReport(suite(b)))[0];
describe("JUnit normalization", () => {
  it("supports nested suites, namespace, UTF-8, entities and CDATA without coercing names", () => {
    const r = parseReport(
      `<testsuites xmlns="urn:example"><testsuite name="parent"><testsuite name="child"><testcase classname="001" name="日本語 &amp; zero" time="0"><failure message="message"><![CDATA[<b>not HTML</b>]]></failure></testcase></testsuite></testsuite></testsuites>`,
    );
    expect(r.cases[0]).toMatchObject({
      suite: "parent / child",
      classname: "001",
      name: "日本語 & zero",
      seconds: 0,
      status: "failure",
      detail: "message\n<b>not HTML</b>",
    });
  });
  it("ignores untrusted aggregate counters and system output", () => {
    const report = parseReport(
      '<testsuite tests="999" failures="99"><testcase name="a"/><system-out>secret</system-out></testsuite>',
    );
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].status).toBe("passed");
    expect(report.cases[0].detail).toBe("");
  });
  it.each([
    "<test>",
    "<html/>",
    "<testsuite><testcase/></testsuite>",
    '<testsuite tests="5"/>',
    '<?xml version="1.0" encoding="Shift_JIS"?><testsuite/>',
  ])("rejects invalid or unsupported inputs: %s", (xml) => {
    expect(() => parseReport(xml)).toThrow();
  });
  it.each([
    '<!DOCTYPE testsuite SYSTEM "https://example.com/xxe">',
    '<!DOCTYPE testsuite [<!ENTITY secret "secret">]>',
  ])("rejects DTD declarations before parsing", (prefix) => {
    expect(() => parseReport(prefix + "<testsuite/>")).toThrow(/DTD/);
  });
  it("rejects oversized files, excessive nesting and excessive testcases", () => {
    expect(() => parseReport(" ".repeat(MAX_BYTES + 1))).toThrow(/5 MiB/);
    expect(() =>
      parseReport(
        "<testsuite>".repeat(35) + testcase() + "</testsuite>".repeat(35),
      ),
    ).toThrow(/nesting/);
    expect(() =>
      parseReport(
        suite(
          Array.from(
            { length: 20_001 },
            (_, i) => `<testcase name="${i}"/>`,
          ).join(""),
        ),
      ),
    ).toThrow(/20,000/);
  });
  it("rejects ambiguous duplicates instead of silently overwriting them", () => {
    expect(() => parseReport(suite(testcase() + testcase("failure")))).toThrow(
      /Duplicate/,
    );
    expect(
      parseReport(
        `<testsuites>${suite(testcase(), "a")}${suite(testcase(), "b")}</testsuites>`,
      ).cases,
    ).toHaveLength(2);
  });
  it.each(["-1", "NaN", "Infinity", "", "1,5", "0x10"])(
    "treats invalid duration %s as unknown",
    (time) => {
      const r = parseReport(suite(testcase("", time)));
      expect(r.cases[0].seconds).toBeNull();
      expect(r.warnings.length).toBeGreaterThan(0);
    },
  );
  it("supports exponent durations and reports an empty suite", () => {
    expect(parseReport(suite(testcase("", "1e-3"))).cases[0].seconds).toBe(
      0.001,
    );
    expect(parseReport("<testsuites/>").warnings.join()).toContain("zero");
    expect(parseReport(suite(testcase("", ".25"))).cases[0].seconds).toBe(0.25);
  });
  it("does not silently drop unsupported testcase nesting", () => {
    expect(() =>
      parseReport(
        '<testsuite><group><testcase name="lost"/></group></testsuite>',
      ),
    ).toThrow(/nesting/);
  });
  it("surfaces suite errors, retries and contradictory outcomes", () => {
    const r = parseReport(
      suite(
        '<error message="setup"/><testcase name="a"><skipped/><failure/><error/><flakyFailure/></testcase>',
      ),
    );
    expect(r.cases[0].status).toBe("error");
    expect(r.warnings.join()).toContain("Suite-level");
    expect(r.warnings.join()).toContain("Retry");
    expect(r.warnings.join()).toContain("Conflicting");
  });
});
describe("comparison semantics", () => {
  it.each([
    ["", "failure", "regression"],
    ["skipped", "error", "regression"],
    ["error", "", "recovered"],
    ["failure", "skipped", "changed"],
    ["failure", "error", "persistent"],
    ["", "skipped", "changed"],
    ["skipped", "", "changed"],
    ["", "", "unchanged"],
  ])("%s → %s is %s", (a, b, expected) =>
    expect(diff(testcase(a), testcase(b)).change).toBe(expected),
  );
  it("keeps added failures and deleted failures separate from regressions and fixes", () => {
    expect(diff("", testcase("failure")).change).toBe("added");
    expect(diff(testcase("failure"), "").change).toBe("removed");
  });
  it("does not depend on test order and detects renames as add/remove", () => {
    const a = suite('<testcase name="a"/><testcase name="b"/>');
    const b = suite('<testcase name="b"/><testcase name="a"/>');
    expect(
      compareReports(parseReport(a), parseReport(b)).every(
        (r) => r.change === "unchanged",
      ),
    ).toBe(true);
    expect(
      compareReports(parseReport(a), parseReport(suite('<testcase name="c"/>')))
        .map((r) => r.change)
        .sort(),
    ).toEqual(["added", "removed", "removed"]);
  });
  it("only flags sufficient timing increases between passed tests", () => {
    expect(isSlowdown(diff(testcase("", "1"), testcase("", "1.5")))).toBe(true);
    expect(isSlowdown(diff(testcase("", "1"), testcase("", "1.2")))).toBe(true);
    expect(isSlowdown(diff(testcase("", "1"), testcase("", "1.05")))).toBe(
      false,
    );
    expect(isSlowdown(diff(testcase("", "0"), testcase("", ".05")))).toBe(
      false,
    );
    expect(isSlowdown(diff(testcase("", "0"), testcase("", "0.1")))).toBe(true);
    expect(isSlowdown(diff(testcase("", "1"), testcase("failure", "10")))).toBe(
      false,
    );
    expect(isSlowdown(diff(testcase("", ""), testcase("", "10")))).toBe(false);
  });
  it("exports all comparison categories and excludes raw failure details", () => {
    const a = parseReport(baseline, "before.xml"),
      b = parseReport(current, "after.xml");
    const rows = compareReports(a, b);
    const out = exportSummary(a, b, rows);
    expect(out.counts).toEqual({
      regression: 1,
      recovered: 1,
      persistent: 1,
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 3,
    });
    expect(JSON.stringify(out)).not.toContain("AssertionError");
    expect(out.tests).toHaveLength(9);
    expect(exportMarkdown(a, b, rows)).not.toContain("AssertionError");
  });
  it("escapes markup in exported Markdown", () => {
    const a = parseReport(
      '<testsuite><testcase name="&lt;img src=x&gt; | [click](https://example.com)"/></testsuite>',
      "<script>.xml",
    );
    const md = exportMarkdown(a, a, compareReports(a, a));
    expect(md).not.toContain("<img");
    expect(md).not.toContain("<script>");
    expect(md).not.toContain("[click]");
    expect(md).toContain("\\|");
  });
});
