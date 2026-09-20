import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  compareReports,
  exportMarkdown,
  exportSummary,
  isFailure,
  isSlowdown,
  parseReport,
  readReport,
  type Change,
  type Delta,
  type Report,
} from "./core";
import { baseline, current } from "./demo";
import "./style.css";

const copy = {
  en: {
    workspace: "TEST REPORT WORKSPACE",
    title: "See what changed.",
    subtitle: "Two test runs. One clear picture.",
    intro:
      "Compare JUnit XML reports to find new failures, recoveries, and tests that went missing.",
    private: "Files stay in your browser",
    source: "Source code ↗",
    sample: "Try a sample comparison",
    reset: "Clear reports",
    baseline: "Baseline",
    current: "Current",
    before: "The earlier test run",
    after: "The latest test run",
    choose: "Choose XML file",
    drop: "or drop it here",
    limit: "UTF-8 JUnit XML · up to 5 MiB / 20,000 tests per file",
    ready: "Ready to compare",
    reading: "Reading…",
    tests: "tests",
    nofile: "No report selected",
    results: "Comparison",
    demo: "SAMPLE DATA",
    live: "YOUR REPORTS",
    regression: "New failures",
    recovered: "Recovered",
    persistent: "Still failing",
    added: "Added",
    removed: "Removed",
    changed: "Status changed",
    unchanged: "Same status",
    all: "All tests",
    slow: "Slowdowns",
    search: "Search test, class, or suite",
    test: "Test / suite",
    transition: "Status transition",
    duration: "Time change",
    view: "Details",
    close: "Close details",
    empty: "Your next test run, in perspective.",
    emptyText:
      "Choose a baseline and a current report, or explore the sample. No setup, no account, no uploads.",
    noresults: "No tests match this view.",
    exportJson: "Export JSON",
    exportMd: "Export Markdown",
    exportNote:
      "Exports include all tests, names and filenames; logs and failure text are excluded. Review before sharing.",
    timing:
      "Slowdowns: passed → passed, at least +0.1 s and +20%. A single run is not a benchmark.",
    identity:
      "Tests are matched by suite path + class + name. Renames appear as added and removed.",
    privacy:
      "No uploads, analytics, or saved reports. Clearing or reloading removes your data from this app.",
    docs: "Guide & limitations ↗",
    footer: "An open-source tool for the people keeping tests green.",
    missing: "Not present",
    passed: "Passed",
    failure: "Failed",
    error: "Error",
    skipped: "Skipped",
    countNote: "Newly added failing tests are counted under Added.",
    detailsEmpty: "No failure or skip message.",
    previous: "Previous",
    next: "Next",
    showing: "Showing",
    warnings: "Report notes",
    summary: "Loaded reports",
    noCommon:
      "No matching test identities. Check suite names and that both files describe comparable runs.",
  },
  ja: {
    workspace: "テスト結果の比較ワークスペース",
    title: "テストの変化を、見通す。",
    subtitle: "2回の結果から、次の一手へ。",
    intro: "JUnit XMLを比較し、新しい失敗・修復・消えたテストを見つけます。",
    private: "ファイルはブラウザ内だけで処理",
    source: "ソースコード ↗",
    sample: "サンプルで試す",
    reset: "レポートを消去",
    baseline: "基準の結果",
    current: "現在の結果",
    before: "比較元のテスト実行",
    after: "比較先のテスト実行",
    choose: "XMLファイルを選択",
    drop: "またはここへドロップ",
    limit: "UTF-8のJUnit XML · 各5 MiB・20,000テストまで",
    ready: "読み込み完了",
    reading: "読み込み中…",
    tests: "テスト",
    nofile: "ファイル未選択",
    results: "比較結果",
    demo: "サンプルデータ",
    live: "読み込んだレポート",
    regression: "新しい失敗",
    recovered: "修復",
    persistent: "継続中の失敗",
    added: "追加",
    removed: "削除",
    changed: "状態の変化",
    unchanged: "同じ状態",
    all: "すべて",
    slow: "遅くなったテスト",
    search: "テスト名・クラス・suiteを検索",
    test: "テスト / suite",
    transition: "状態の変化",
    duration: "時間の変化",
    view: "詳細",
    close: "詳細を閉じる",
    empty: "テスト結果の、その先へ。",
    emptyText:
      "基準と現在のレポートを選択するか、サンプルをお試しください。登録やアップロードは不要です。",
    noresults: "条件に一致するテストはありません。",
    exportJson: "JSONを保存",
    exportMd: "Markdownを保存",
    exportNote:
      "出力には全テスト・テスト名・ファイル名が含まれます。ログ・失敗の本文は含みません。共有前に内容を確認してください。",
    timing:
      "遅延：両方成功したテストで +0.1秒かつ +20%以上。1回の実行差は性能の断定ではありません。",
    identity:
      "suiteの階層・クラス・テスト名で対応付けます。名前の変更は追加と削除として表示します。",
    privacy:
      "アップロード・解析サービス・レポートの永続保存はありません。消去または再読み込みでデータを破棄します。",
    docs: "使い方と制約 ↗",
    footer: "テストを保守する人のためのオープンソースツール。",
    missing: "なし",
    passed: "成功",
    failure: "失敗",
    error: "エラー",
    skipped: "スキップ",
    countNote: "新規追加の失敗テストは「追加」に含まれます。",
    detailsEmpty: "失敗・スキップのメッセージはありません。",
    previous: "前へ",
    next: "次へ",
    showing: "表示",
    warnings: "レポートの注意点",
    summary: "読み込んだ結果",
    noCommon:
      "一致するテストがありません。suite名と、同じ条件のテスト実行かを確認してください。",
  },
};
type Language = keyof typeof copy;
type Filter = Change | "all" | "slow";
const order: Change[] = [
  "regression",
  "persistent",
  "recovered",
  "changed",
  "added",
  "removed",
  "unchanged",
];
const seconds = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(3)} s`;
function saveFile(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [lang, setLang] = useState<Language>("en");
  const t = copy[lang];
  const [reports, setReports] = useState<[Report | null, Report | null]>([
    null,
    null,
  ]);
  const [errors, setErrors] = useState(["", ""]);
  const [loading, setLoading] = useState([false, false]);
  const [demo, setDemo] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const versions = useRef([0, 0]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const rows = useMemo(
    () =>
      reports[0] && reports[1] ? compareReports(reports[0], reports[1]) : null,
    [reports],
  );
  const visible = useMemo(
    () =>
      (rows || [])
        .filter((row) => {
          const item = row.after || row.before!;
          return (
            (filter === "all" ||
              (filter === "slow" ? isSlowdown(row) : row.change === filter)) &&
            [item.name, item.classname, item.suite]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())
          );
        })
        .sort((a, b) =>
          filter === "slow"
            ? (b.secondsDelta || 0) - (a.secondsDelta || 0)
            : order.indexOf(a.change) - order.indexOf(b.change) ||
              (a.after || a.before!).name.localeCompare(
                (b.after || b.before!).name,
              ),
        ),
    [rows, filter, search],
  );
  const active = rows?.find((row) => row.id === selected);
  const counts = (kind: Filter) =>
    rows?.filter(
      (row) =>
        kind === "all" ||
        (kind === "slow" ? isSlowdown(row) : row.change === kind),
    ).length || 0;
  function clearView() {
    setFilter("all");
    setSearch("");
    setPage(0);
    setSelected(null);
  }
  function reset() {
    versions.current = versions.current.map((v) => v + 1);
    setReports([null, null]);
    setErrors(["", ""]);
    setLoading([false, false]);
    setDemo(false);
    clearView();
    inputs.current.forEach((input) => {
      if (input) input.value = "";
    });
  }
  async function load(file: File | undefined, index: number) {
    if (!file) return;
    const version = ++versions.current[index];
    setDemo(false);
    clearView();
    setReports(
      (old) => old.map((r, i) => (i === index ? null : r)) as typeof old,
    );
    setErrors((old) => old.map((e, i) => (i === index ? "" : e)));
    setLoading((old) => old.map((v, i) => (i === index ? true : v)));
    try {
      const result = await readReport(file);
      if (versions.current[index] === version)
        setReports(
          (old) => old.map((r, i) => (i === index ? result : r)) as typeof old,
        );
    } catch (error) {
      if (versions.current[index] === version)
        setErrors((old) =>
          old.map((e, i) =>
            i === index
              ? error instanceof Error
                ? error.message
                : "Could not read report"
              : e,
          ),
        );
    } finally {
      if (versions.current[index] === version)
        setLoading((old) => old.map((v, i) => (i === index ? false : v)));
    }
  }
  function sample() {
    reset();
    setReports([
      parseReport(baseline, "baseline.xml"),
      parseReport(current, "current.xml"),
    ]);
    setDemo(true);
  }
  function changeFilter(value: Filter) {
    setFilter(value);
    setPage(0);
    setSelected(null);
  }
  const badge = (status?: keyof typeof copy.en) => (
    <span className={`status ${status || "missing"}`}>
      {status ? t[status] : t.missing}
    </span>
  );
  function details(row: Delta) {
    return (
      <section className="detail" aria-label={t.view}>
        <div className="section-heading">
          <h3>{(row.after || row.before!).name}</h3>
          <button onClick={() => setSelected(null)}>{t.close} ×</button>
        </div>
        <div className="detail-columns">
          {[row.before, row.after].map((item, i) => (
            <div key={i}>
              <h4>
                {i === 0 ? t.baseline : t.current} · {seconds(item?.seconds)}
              </h4>
              <pre>{item?.detail || t.detailsEmpty}</pre>
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="./">
          <span className="logo" aria-hidden="true">
            ≋
          </span>
          <span>
            JUnit
            <br />
            <strong>Diff Lens</strong>
          </span>
        </a>
        <div className="sidebar-note">
          <span className="tiny-label">01 / COMPARE</span>
          <p>{t.subtitle}</p>
          <span className="side-rule" />
          <small>BASELINE → CURRENT</small>
        </div>
        <div className="sidebar-bottom">
          <span className="privacy-dot" /> {t.private}
          <a href="https://github.com/Tomdachs/junit-diff-lens">{t.source}</a>
          <small>OPEN SOURCE · MIT · v0.1.0</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>{t.workspace}</span>
          <div className="language" aria-label="Language">
            <button
              aria-pressed={lang === "en"}
              onClick={() => {
                setLang("en");
                document.documentElement.lang = "en";
              }}
            >
              EN
            </button>
            <button
              aria-pressed={lang === "ja"}
              onClick={() => {
                setLang("ja");
                document.documentElement.lang = "ja";
              }}
            >
              日本語
            </button>
          </div>
        </header>
        <section className="hero">
          <div>
            <span className="eyebrow">LESS NOISE. MORE SIGNAL.</span>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
          <button className="sample-button" onClick={sample}>
            {t.sample} <span aria-hidden="true">↗</span>
          </button>
        </section>
        <section className="report-grid" aria-label={t.summary}>
          {[0, 1].map((i) => (
            <article
              key={i}
              className={`report-card ${reports[i] ? "loaded" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void load(e.dataTransfer.files[0], i);
              }}
            >
              <div className="report-header">
                <span className="step">0{i + 1}</span>
                <div>
                  <h2>{i === 0 ? t.baseline : t.current}</h2>
                  <p>{i === 0 ? t.before : t.after}</p>
                </div>
                <span className="file-icon" aria-hidden="true">
                  ⤓
                </span>
              </div>
              <div className="file-line">
                <span className="filename">
                  {loading[i] ? t.reading : reports[i]?.name || t.nofile}
                </span>
                {reports[i] && (
                  <span className="test-count">
                    {reports[i]!.cases.length} {t.tests}
                  </span>
                )}
              </div>
              <div className="file-actions">
                <label className="file-button">
                  {t.choose}
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    aria-label={i === 0 ? t.baseline : t.current}
                    onChange={(e) => {
                      void load(e.target.files?.[0], i);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span>{t.drop}</span>
              </div>
              {errors[i] && (
                <p role="alert" className="error-message">
                  {errors[i]}
                </p>
              )}
            </article>
          ))}
        </section>
        <div className="under-inputs">
          <span>{t.limit}</span>
          <button
            disabled={
              !reports.some(Boolean) &&
              !errors.some(Boolean) &&
              !loading.some(Boolean)
            }
            onClick={reset}
          >
            {t.reset} ×
          </button>
        </div>
        {!rows ? (
          <section className="empty">
            <div className="empty-art" aria-hidden="true">
              <span>−</span>
              <span>+</span>
              <span>✓</span>
            </div>
            <h2>{t.empty}</h2>
            <p>{t.emptyText}</p>
          </section>
        ) : (
          <section aria-label={t.results}>
            <div className="section-heading">
              <div className="result-heading">
                <h2>{t.results}</h2>
                <span className="mode">{demo ? t.demo : t.live}</span>
              </div>
              <span className="matched">
                {reports[0]!.cases.length} → {reports[1]!.cases.length}{" "}
                {t.tests}
              </span>
            </div>
            <div className="metrics">
              {(
                [
                  "regression",
                  "recovered",
                  "persistent",
                  "added",
                  "removed",
                ] as const
              ).map((kind) => (
                <button
                  key={kind}
                  className={`metric ${kind} ${filter === kind ? "active" : ""}`}
                  onClick={() => changeFilter(kind)}
                  aria-pressed={filter === kind}
                >
                  <span>{t[kind]}</span>
                  <strong>{counts(kind)}</strong>
                  <span className="metric-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              ))}
            </div>
            <p className="small-note">{t.countNote}</p>
            {reports.some((r) => r!.warnings.length) && (
              <div className="warnings">
                <strong>{t.warnings}</strong>
                {reports.map((report, i) =>
                  report!.warnings.map((warning, j) => (
                    <p key={`${i}-${j}`}>
                      {i === 0 ? t.baseline : t.current}: {warning}
                    </p>
                  )),
                )}
              </div>
            )}
            {rows.length > 0 &&
              !rows.some((row) => row.before && row.after) && (
                <p className="warnings">{t.noCommon}</p>
              )}
            <div className="toolbar">
              <div className="filters">
                {(
                  [
                    "all",
                    "regression",
                    "recovered",
                    "persistent",
                    "added",
                    "removed",
                    "changed",
                    "unchanged",
                    "slow",
                  ] as const
                ).map((kind) => (
                  <button
                    key={kind}
                    aria-pressed={filter === kind}
                    onClick={() => changeFilter(kind)}
                  >
                    {t[kind]} <span>{counts(kind)}</span>
                  </button>
                ))}
              </div>
              <input
                className="search"
                type="search"
                aria-label={t.search}
                placeholder={t.search}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.test}</th>
                    <th>{t.results}</th>
                    <th>{t.transition}</th>
                    <th>{t.duration}</th>
                    <th>
                      <span className="sr-only">{t.view}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(page * 50, (page + 1) * 50).map((row) => {
                    const item = row.after || row.before!;
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <small>
                            {[item.suite, item.classname]
                              .filter(Boolean)
                              .join(" / ")}
                          </small>
                        </td>
                        <td>
                          <span className={`change ${row.change}`}>
                            {t[row.change]}
                          </span>
                          {row.change === "added" &&
                            isFailure(row.after?.status) && (
                              <small className="added-failure">
                                {t.failure}
                              </small>
                            )}
                        </td>
                        <td>
                          <div className="transition">
                            {badge(row.before?.status)}
                            <span aria-hidden="true">→</span>
                            {badge(row.after?.status)}
                          </div>
                        </td>
                        <td
                          className={`duration ${isSlowdown(row) ? "slower" : ""}`}
                        >
                          {row.secondsDelta == null
                            ? "—"
                            : `${row.secondsDelta > 0 ? "+" : ""}${row.secondsDelta.toFixed(3)} s`}
                          <small>
                            {seconds(row.before?.seconds)} →{" "}
                            {seconds(row.after?.seconds)}
                          </small>
                        </td>
                        <td>
                          <button
                            className="detail-button"
                            aria-label={`${t.view}: ${item.name}`}
                            aria-expanded={selected === row.id}
                            onClick={() =>
                              setSelected(selected === row.id ? null : row.id)
                            }
                          >
                            {t.view} ↗
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length && <p className="no-results">{t.noresults}</p>}
            </div>
            <div className="pagination">
              <span>
                {t.showing} {visible.length ? page * 50 + 1 : 0}–
                {Math.min((page + 1) * 50, visible.length)} / {visible.length}
              </span>
              <div>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t.previous}
                </button>
                <button
                  disabled={(page + 1) * 50 >= visible.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t.next}
                </button>
              </div>
            </div>
            {active && details(active)}
            <div className="export">
              <div>
                <button
                  onClick={() =>
                    saveFile(
                      "junit-diff.json",
                      JSON.stringify(
                        exportSummary(reports[0]!, reports[1]!, rows),
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  {t.exportJson} ↓
                </button>
                <button
                  onClick={() =>
                    saveFile(
                      "junit-diff.md",
                      exportMarkdown(reports[0]!, reports[1]!, rows),
                      "text/markdown",
                    )
                  }
                >
                  {t.exportMd} ↓
                </button>
              </div>
              <p>{t.exportNote}</p>
            </div>
            <p className="small-note">{t.timing}</p>
          </section>
        )}
        <footer>
          <p>{t.identity}</p>
          <p>{t.privacy}</p>
          <div>
            <span>{t.footer}</span>
            <a href="https://github.com/Tomdachs/junit-diff-lens#readme">
              {t.docs}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
