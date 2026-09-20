import { test, expect } from "@playwright/test";
import { baseline, current } from "../src/demo";
const upload = (name: string, contents: string) => ({
  name,
  mimeType: "application/xml",
  buffer: Buffer.from(contents),
});
test.beforeEach(async ({ page }) => {
  await page.goto("./");
});
test("sample works offline, filters regressions and slowdowns, and has no horizontal page overflow", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await context.setOffline(true);
  await page.getByRole("button", { name: "Try a sample comparison" }).click();
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(9);
  await page
    .locator(".filters")
    .getByRole("button", { name: "New failures 1" })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("accepts a valid payment");
  await page
    .locator(".filters")
    .getByRole("button", { name: "Slowdowns 1" })
    .click();
  await expect(page.locator("tbody")).toContainText("loads the product feed");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(requests).toEqual([]);
});
test("reads files, exports full JSON, searches, and clears private data", async ({
  page,
}) => {
  await page
    .getByLabel("Baseline", { exact: true })
    .setInputFiles(upload("old.xml", baseline));
  await page
    .getByLabel("Current", { exact: true })
    .setInputFiles(upload("new.xml", current));
  await expect(page.locator("tbody tr")).toHaveCount(9);
  await page.getByRole("searchbox").fill("payment");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const result = await download;
  const stream = await result.createReadStream();
  let contents = "";
  for await (const chunk of stream!) contents += chunk.toString();
  const json = JSON.parse(contents);
  expect(json.tests).toHaveLength(9);
  expect(json.counts.regression).toBe(1);
  expect(contents).not.toContain("AssertionError");
  await page.getByRole("button", { name: "Clear reports" }).click();
  await expect(page.locator("tbody")).toHaveCount(0);
  await expect(page.getByText("old.xml", { exact: true })).toHaveCount(0);
});
test("invalid replacement removes stale comparison, duplicate identities are rejected, valid input recovers", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Try a sample comparison" }).click();
  await page
    .getByLabel("Current", { exact: true })
    .setInputFiles(upload("broken.xml", "<broken>"));
  await expect(page.getByRole("alert")).toContainText("Invalid XML");
  await expect(page.locator("tbody")).toHaveCount(0);
  await page
    .getByLabel("Current", { exact: true })
    .setInputFiles(
      upload(
        "duplicate.xml",
        '<testsuite><testcase name="x"/><testcase name="x"/></testsuite>',
      ),
    );
  await expect(page.getByRole("alert")).toContainText("Duplicate");
  await page
    .getByLabel("Current", { exact: true })
    .setInputFiles(upload("new.xml", current));
  await expect(page.locator("tbody tr")).toHaveCount(9);
});
test("failure details render as inert text and never request embedded URLs", async ({
  page,
}) => {
  const xml =
    '<testsuite><testcase name="literal"><failure><![CDATA[<img src="https://example.invalid/track" onerror="alert(1)">]]></failure></testcase></testsuite>';
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page
    .getByLabel("Baseline", { exact: true })
    .setInputFiles(upload("a.xml", xml));
  await page
    .getByLabel("Current", { exact: true })
    .setInputFiles(upload("b.xml", xml));
  await page.getByRole("button", { name: "Details: literal" }).click();
  await expect(page.locator("pre").first()).toContainText("<img");
  await expect(page.locator(".detail img")).toHaveCount(0);
  expect(requests).toEqual([]);
});
test("Japanese interface, pagination, and reload discard report state", async ({
  page,
}) => {
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "テストの変化を、見通す。",
  );
  const xml = `<testsuite>${Array.from({ length: 65 }, (_, i) => `<testcase name="case-${i}" time="0.1"/>`).join("")}</testsuite>`;
  await page
    .getByLabel("基準の結果", { exact: true })
    .setInputFiles(upload("a.xml", xml));
  await page
    .getByLabel("現在の結果", { exact: true })
    .setInputFiles(upload("b.xml", xml));
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(15);
  await page.reload();
  await expect(page.locator("tbody")).toHaveCount(0);
});
