import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { deleteWorkflowSubmission, fetchReviewQueueForRole, submitWorkflowReview } from "../services/reviewWorkflow";
import { SOCIETY_LABELS, ACR_LABELS, MAX_SCORES, APP_INFO } from "../constants/formConfig";
import { VC_USER } from "../data/mockData";
import { rejectedStatusFor, reviewedStatusFor, profileFromLocalStorage } from "../utils/hierarchy";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v) => parseFloat(v) || 0;
const pct = (v, m) => Math.min(100, Math.round((v / m) * 100)) || 0;
const isVcReviewed = (person = {}) => person.status === "Reviewed" || person.status === "VC Reviewed" || person.status === "Rejected" || person.status === "VC Rejected" || n(person.vcTotal) > 0;
const grade = (score, max) => {
  const p = (score / max) * 100;
  if (p >= 85) return { label: "Outstanding", color: "#059669", bg: "#d1fae5" };
  if (p >= 70) return { label: "Very Good",   color: "#0284c7", bg: "#dbeafe" };
  if (p >= 55) return { label: "Good",         color: "#7c3aed", bg: "#ede9fe" };
  if (p >= 40) return { label: "Satisfactory", color: "#d97706", bg: "#fef3c7" };
  return { label: "Needs Improvement", color: "#dc2626", bg: "#fee2e2" };
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ initials, color = "#b45309", size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}99)`, color: "#fff", fontWeight: 800, fontSize: size * 0.32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, letterSpacing: 0.5 }}>
      {initials}
    </div>
  );
}
function ScoreBar({ score, max, color = "#b45309" }) {
  return (
    <div style={{ width: "100%", background: "#f1f5f9", borderRadius: 4, height: 5, overflow: "hidden" }}>
      <div style={{ width: `${pct(score, max)}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s" }} />
    </div>
  );
}
function StatusBadge({ status }) {
  const map = {
    "Dean Reviewed":   { bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
    "Reviewed":        { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
    "VC Reviewed":     { bg: "#d1fae5", color: "#065f46", dot: "#10b981" },
    "Pending Review":  { bg: "#ede9fe", color: "#5b21b6", dot: "#7c3aed" },
    "Pending VC Review": { bg: "#ede9fe", color: "#5b21b6", dot: "#7c3aed" },
    Rejected:          { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
    "VC Rejected":     { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  };
  const s = map[status] || map["Pending VC Review"];
  const label = status === "Reviewed" ? "VC Reviewed" : status === "Pending Review" ? "Pending VC Review" : status;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {label}
    </span>
  );
}
function RO({ val, center }) {
  return <span style={{ fontSize: 11, fontFamily: "Georgia, serif", color: "#1e293b", display: "block", textAlign: center ? "center" : "left" }}>{val || <span style={{ color: "#cbd5e1" }}>—</span>}</span>;
}
function VCInput({ val, onChange }) {
  return (
    <input type="number" min="0" step="0.5" value={val ?? ""}
      onChange={e => onChange(e.target.value)}
      style={{ width: 58, textAlign: "center", border: "1.5px solid #b45309", borderRadius: 5, padding: "3px 5px", fontSize: 11, fontFamily: "Georgia, serif", outline: "none", background: "#fffbf0" }}
    />
  );
}
function ViewDocsCell({ docKey, docs }) {
  const files = docs?.[docKey] || [];
  if (!files.length) return <span style={{ color: "#cbd5e1", fontSize: 10 }}>No docs</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {files.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#b45309", fontSize: 10, textDecoration: "none", background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" }}
          title={f.name}>
          📄 {f.name.length > 16 ? f.name.slice(0, 16) + "…" : f.name}
        </a>
      ))}
    </div>
  );
}
function SC({ title, subtitle, accent = "#b45309", children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 9, boxShadow: "0 1px 3px rgba(0,0,0,.06)", marginBottom: 14, overflow: "hidden", border: "1px solid #e2e8f0", borderTop: `3px solid ${accent}` }}>
      <div style={{ padding: "10px 15px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: accent }}>{title}</div>
        {subtitle && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: "13px 15px" }}>{children}</div>
    </div>
  );
}

// ─── Table style constants ─────────────────────────────────────────────────────
const T     = { width: "100%", borderCollapse: "collapse", fontSize: 11 };
const TH      = { border: "1px solid #cbd5e1", padding: "5px 7px", background: "#0f172a",  color: "#94a3b8",  fontWeight: 700, textAlign: "center", fontSize: 10 };
const TH_HOD  = { ...TH, background: "#312e81", color: "#c7d2fe" };
const TH_DIR  = { ...TH, background: "#0c4a6e", color: "#bae6fd" };
const TH_DEAN = { ...TH, background: "#4c1d95", color: "#ddd6fe" };
const TH_VC   = { ...TH, background: "#78350f", color: "#fde68a" };
const TD  = { border: "1px solid #e2e8f0", padding: "5px 7px", verticalAlign: "middle" };
const TDC = { ...TD, textAlign: "center" };
const TDS     = { ...TD, textAlign: "center", background: "#f8fafc", minWidth: 58 };
const TDS_HOD  = { ...TDS, background: "#f0f4ff" };
const TDS_DIR  = { ...TDS, background: "#f0fbff" };
const TDS_DEAN = { ...TDS, background: "#faf5ff" };
const TDS_VC   = { ...TDS, background: "#fffbf0" };
const TDV = { ...TD, background: "#fafbff", minWidth: 110 };

const VC_REVIEW_ARRAY_KEYS = ["lectures", "courseFile", "projects", "quals", "feedback", "deptActs", "uniActs", "society", "industry", "acr", "journals", "books", "ict", "research", "projects2", "patents", "awards", "confs", "proposals", "fdps", "training"];

const buildVcSectionScores = (person, vcData) => {
  const payload = {};
  VC_REVIEW_ARRAY_KEYS.forEach((key) => {
    const rows = Array.isArray(person[key]) ? person[key] : [];
    payload[key] = rows.map((row, index) => ({
      ...row,
      vc: vcData[key]?.[index]?.vc ?? row.vc ?? "",
    }));
  });
  payload.innovativeTeaching = {
    vc: vcData.innovVc ?? vcData.innovVC ?? person.innovVc ?? "",
  };
  return payload;
};

// ─── VC Review Form ───────────────────────────────────────────────────────────
// personMode: "dean" | "director" | "hod" | "faculty"
function VCReviewForm({ person, vcData, setVcData, personMode = "director" }) {
  const showHodCol  = personMode === "hod" || personMode === "faculty";
  const showDirCol  = personMode === "director" || personMode === "hod" || personMode === "faculty";
  const showDeanCol = true;

  const set = (section, idx, field, val) => {
    setVcData(prev => {
      const updated = { ...prev };
      if (!updated[section]) updated[section] = JSON.parse(JSON.stringify(person[section] || []));
      if (idx === null) {
        updated[section] = Array.isArray(updated[section])
          ? (updated[section].length ? updated[section].map((r, i) => i === 0 ? { ...r, [field]: val } : r) : [{ [field]: val }])
          : { ...updated[section], [field]: val };
      }
      else updated[section] = updated[section].map((r, i) => i === idx ? { ...r, [field]: val } : r);
      return updated;
    });
  };
  const setScalar = (key, val) => setVcData(prev => ({ ...prev, [key]: val }));
  const get = (section, idx, field) => {
    if (vcData[section]) {
      const s = vcData[section];
      return idx === null
        ? (Array.isArray(s) ? (s[0]?.[field] ?? "") : (s[field] ?? ""))
        : (s[idx]?.[field] ?? person[section]?.[idx]?.[field] ?? "");
    }
    if (idx === null) {
      const source = person[section];
      return Array.isArray(source) ? (source[0]?.[field] ?? "") : (source?.[field] ?? "");
    }
    return person[section]?.[idx]?.[field] ?? "";
  };
  const getS = (key) => vcData[key] ?? person[key] ?? "";
  const { docs } = person;
  const courseFileRow = Array.isArray(person.courseFile) ? (person.courseFile[0] || {}) : (person.courseFile || {});
  const rows = (arr) => arr && arr.length > 0 ? arr : [{}];

  const deanScoreKey = personMode === "dean" ? "score" : "dean";

  const buildScoreHeaders = () => (
    <>
      {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
      {!showHodCol && personMode !== "dean" && <th style={TH}>Self Score</th>}
      {personMode === "dean" && <th style={TH}>Self Score</th>}
      {showDirCol && <th style={TH_DIR}>Dir Score</th>}
      {showDeanCol && <th style={TH_DEAN}>Dean Score</th>}
      <th style={TH_VC}>VC Score</th>
    </>
  );

  const buildScoreCells = (r, section, idx) => (
    <>
      {showHodCol && <><td style={TDS}><RO val={r.score} center /></td><td style={TDS_HOD}><RO val={r.hod} center /></td></>}
      {!showHodCol && personMode !== "dean" && <td style={TDS}><RO val={r.score} center /></td>}
      {personMode === "dean" && <td style={TDS}><RO val={r.score} center /></td>}
      {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
      {showDeanCol && <td style={TDS_DEAN}><RO val={r.dean || r[deanScoreKey]} center /></td>}
      <td style={TDS_VC}><VCInput val={get(section, idx, "vc")} onChange={v => set(section, idx, "vc", v)} /></td>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Mode banner */}
      <div style={{ background: `linear-gradient(90deg,#451a03,#92400e)`, color: "#fef3c7", borderRadius: 8, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
        <span style={{ fontSize: 18 }}>👁️</span>
        <div>
          <strong>VC Review Mode</strong> — All prior scores are read-only. Only the <span style={{ color: "#fde68a", fontWeight: 700 }}>VC Score</span> column is editable.
          {showHodCol && " HOD scores visible for reference."} {showDirCol && " Director scores visible for reference."} Dean scores shown for reference.
        </div>
      </div>

      {/* Personal Info */}
      <SC title="Personal Information" accent="#b45309">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {Object.entries(person.info).map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: "6px 10px", background: "#f8fafc", fontWeight: 600, border: "1px solid #e2e8f0", width: "35%", textTransform: "capitalize" }}>{k}</td>
                <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0", color: "#334155" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SC>

      <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", background: "#fef3c7", padding: "8px 14px", borderRadius: 6, marginBottom: 10 }}>PART A — Teaching & Academic Activities</div>

      {/* A1 Lectures */}
      <SC title="A1. Lectures / Tutorials / Practicals (Max 50)" accent="#b45309">
        <div style={{ overflowX: "auto" }}>
          <table style={T}><thead><tr>
            <th style={TH}>SN</th><th style={TH}>Semester</th><th style={TH}>Course</th>
            <th style={TH}>Planned</th><th style={TH}>Conducted</th><th style={TH}>Docs</th>
            {buildScoreHeaders()}
          </tr></thead>
          <tbody>{rows(person.lectures).map((r, i) => (
            <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
              <td style={TDC}>{i + 1}</td><td style={TD}><RO val={r.sem} /></td><td style={TD}><RO val={r.code} /></td>
              <td style={TDC}><RO val={r.planned} center /></td><td style={TDC}><RO val={r.conducted} center /></td>
              <td style={TDV}><ViewDocsCell docKey={`lec-${i}`} docs={docs} /></td>
              {buildScoreCells(r, "lectures", i)}
            </tr>
          ))}</tbody></table>
        </div>
      </SC>

      {/* A2 Course File */}
      <SC title="A2. Course File (Max 20)" accent="#b45309">
        <table style={T}><thead><tr>
          <th style={TH}>Course</th><th style={TH}>Title</th><th style={TH}>Details</th><th style={TH}>Docs</th>
          {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
          {!showHodCol && <th style={TH}>Self Score</th>}
          {showDirCol && <th style={TH_DIR}>Dir Score</th>}
          <th style={TH_DEAN}>Dean Score</th>
          <th style={TH_VC}>VC Score</th>
        </tr></thead>
        <tbody><tr>
          <td style={TD}><RO val={courseFileRow.course} /></td>
          <td style={TD}><RO val={courseFileRow.title} /></td>
          <td style={TDC}><RO val={courseFileRow.details} center /></td>
          <td style={TDV}><ViewDocsCell docKey="cf-0" docs={docs} /></td>
          {showHodCol && <><td style={TDS}><RO val={courseFileRow.score} center /></td><td style={TDS_HOD}><RO val={courseFileRow.hod} center /></td></>}
          {!showHodCol && <td style={TDS}><RO val={courseFileRow.score} center /></td>}
          {showDirCol && <td style={TDS_DIR}><RO val={courseFileRow.director} center /></td>}
          <td style={TDS_DEAN}><RO val={courseFileRow.dean || courseFileRow.score} center /></td>
          <td style={TDS_VC}><VCInput val={get("courseFile", null, "vc")} onChange={v => set("courseFile", null, "vc", v)} /></td>
        </tr></tbody></table>
      </SC>

      {/* A3 Innovative */}
      <SC title="A3. Innovative Teaching-Learning (Max 10)" accent="#b45309">
        <table style={T}><thead><tr>
          <th style={TH}>Method</th>
          {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
          {!showHodCol && <th style={TH}>Self Score</th>}
          {showDirCol && <th style={TH_DIR}>Dir Score</th>}
          <th style={TH_DEAN}>Dean Score</th>
          <th style={TH_VC}>VC Score</th>
        </tr></thead>
        <tbody><tr>
          <td style={TD}>Innovative / participatory teaching methods used</td>
          {showHodCol && <><td style={TDS}><RO val={person.innovScore} center /></td><td style={TDS_HOD}><RO val={person.innovHod} center /></td></>}
          {!showHodCol && <td style={TDS}><RO val={person.innovScore} center /></td>}
          {showDirCol && <td style={TDS_DIR}><RO val={person.innovDirector} center /></td>}
          <td style={TDS_DEAN}><RO val={person.innovDean} center /></td>
          <td style={TDS_VC}><VCInput val={getS("innovVc") || getS("innovVC")} onChange={v => setScalar("innovVc", v)} /></td>
        </tr></tbody></table>
      </SC>

      {/* A4–A5 Projects & Quals */}
      {[
        ["A4. Projects (Max 10)", "projects", "proj"],
        ["A5. Qualification Enhancement (Max 10)", "quals", "qual"],
      ].map(([title, key, docPfx]) => (
        <SC key={key} title={title} accent="#b45309">
          <table style={T}><thead><tr>
            <th style={TH}>SN</th><th style={TH}>Description</th><th style={TH}>Docs</th>
            {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
            {!showHodCol && <th style={TH}>Self Score</th>}
            {showDirCol && <th style={TH_DIR}>Dir Score</th>}
            <th style={TH_DEAN}>Dean Score</th>
            <th style={TH_VC}>VC Score</th>
          </tr></thead>
          <tbody>{rows(person[key]).map((r, i) => (
            <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
              <td style={TDC}>{i + 1}</td>
              <td style={TD}><RO val={r.label} /></td>
              <td style={TDV}><ViewDocsCell docKey={`${docPfx}-${i}`} docs={docs} /></td>
              {showHodCol && <><td style={TDS}><RO val={r.score} center /></td><td style={TDS_HOD}><RO val={r.hod} center /></td></>}
              {!showHodCol && <td style={TDS}><RO val={r.score} center /></td>}
              {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
              <td style={TDS_DEAN}><RO val={r.dean || r.score} center /></td>
              <td style={TDS_VC}><VCInput val={get(key, i, "vc")} onChange={v => set(key, i, "vc", v)} /></td>
            </tr>
          ))}</tbody></table>
        </SC>
      ))}

      {/* B Feedback */}
      <SC title="B. Student Feedback (Max 10)" accent="#b45309">
        <table style={T}><thead><tr>
          <th style={TH}>SN</th><th style={TH}>Course</th><th style={TH}>FB1</th><th style={TH}>FB2</th><th style={TH}>Avg</th>
          {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
          {!showHodCol && <th style={TH}>Self Score</th>}
          {showDirCol && <th style={TH_DIR}>Dir Score</th>}
          <th style={TH_DEAN}>Dean Score</th>
          <th style={TH_VC}>VC Score</th>
        </tr></thead>
        <tbody>{rows(person.feedback).map((r, i) => (
          <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
            <td style={TDC}>{i + 1}</td><td style={TD}><RO val={r.code} /></td>
            <td style={TDC}><RO val={r.fb1} center /></td><td style={TDC}><RO val={r.fb2} center /></td>
            <td style={{ ...TDC, fontWeight: 700, color: "#b45309" }}>{r.fb1 && r.fb2 ? ((n(r.fb1) + n(r.fb2)) / 2).toFixed(2) : "—"}</td>
            {showHodCol && <><td style={TDS}><RO val={r.score} center /></td><td style={TDS_HOD}><RO val={r.hod} center /></td></>}
            {!showHodCol && <td style={TDS}><RO val={r.score} center /></td>}
            {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
            <td style={TDS_DEAN}><RO val={r.dean || r.score} center /></td>
            <td style={TDS_VC}><VCInput val={get("feedback", i, "vc")} onChange={v => set("feedback", i, "vc", v)} /></td>
          </tr>
        ))}</tbody></table>
      </SC>

      {/* C–F Activities */}
      {[
        ["C. Departmental Activities (Max 20)", "deptActs", "#d97706", ["Activity", "Nature"], ["activity", "nature"], "dept"],
        ["D. University Activities (Max 30)", "uniActs", "#d97706", ["Activity", "Nature"], ["activity", "nature"], "uni"],
        ["E. Contribution to Society (Max 10)", "society", "#059669", ["Activity", "Details"], ["label", "details"], "soc"],
        ["F. Industry Connect (Max 5)", "industry", "#059669", ["Industry", "Details"], ["name", "details"], "ind"],
      ].map(([title, key, accent2, cols, fields, docPfx]) => (
        <SC key={key} title={title} accent={accent2}>
          <table style={T}><thead><tr>
            <th style={TH}>SN</th>
            {cols.map(c => <th key={c} style={TH}>{c}</th>)}
            <th style={TH}>Docs</th>
            {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
            {!showHodCol && <th style={TH}>Self Score</th>}
            {showDirCol && <th style={TH_DIR}>Dir Score</th>}
            <th style={TH_DEAN}>Dean Score</th>
            <th style={TH_VC}>VC Score</th>
          </tr></thead>
          <tbody>{rows(person[key]).map((r, i) => (
            <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
              <td style={TDC}>{i + 1}</td>
              {fields.map(f => <td key={f} style={TD}><RO val={r[f]} /></td>)}
              <td style={TDV}><ViewDocsCell docKey={`${docPfx}-${i}`} docs={docs} /></td>
              {showHodCol && <><td style={TDS}><RO val={r.score} center /></td><td style={TDS_HOD}><RO val={r.hod} center /></td></>}
              {!showHodCol && <td style={TDS}><RO val={r.score} center /></td>}
              {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
              <td style={TDS_DEAN}><RO val={r.dean || r.score} center /></td>
              <td style={TDS_VC}><VCInput val={get(key, i, "vc")} onChange={v => set(key, i, "vc", v)} /></td>
            </tr>
          ))}</tbody></table>
        </SC>
      ))}

      {/* G ACR */}
      <SC title="G. Annual Confidential Report (Max 25)" accent="#ef4444">
        <table style={T}><thead><tr>
          <th style={TH}>SN</th><th style={TH}>Parameter</th>
          {showHodCol && <th style={TH_HOD}>HOD Score</th>}
          {showDirCol && <th style={TH_DIR}>Dir Score</th>}
          <th style={TH_DEAN}>Dean Score</th>
          <th style={TH_VC}>VC Score</th>
        </tr></thead>
        <tbody>{rows(person.acr).map((r, i) => (
          <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
            <td style={TDC}>{i + 1}</td>
            <td style={TD}><RO val={r.label} /></td>
            {showHodCol && <td style={TDS_HOD}><RO val={r.hod} center /></td>}
            {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
            <td style={TDS_DEAN}><RO val={r.dean} center /></td>
            <td style={TDS_VC}><VCInput val={get("acr", i, "vc")} onChange={v => set("acr", i, "vc", v)} /></td>
          </tr>
        ))}</tbody></table>
      </SC>

      <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", background: "#fef3c7", padding: "8px 14px", borderRadius: 6, marginBottom: 10 }}>PART B — Research & Academic Contributions</div>

      {/* B1 Journals */}
      <SC title="B1. Research Papers / Journal Publications (Max 120)" accent="#b45309">
        <div style={{ overflowX: "auto" }}><table style={T}><thead><tr>
          <th style={TH}>SN</th><th style={TH}>Title</th><th style={TH}>Journal</th>
          <th style={TH}>ISSN</th><th style={TH}>Index</th><th style={TH}>Docs</th>
          {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
          {!showHodCol && <th style={TH}>Self Score</th>}
          {showDirCol && <th style={TH_DIR}>Dir Score</th>}
          <th style={TH_DEAN}>Dean Score</th>
          <th style={TH_VC}>VC Score</th>
        </tr></thead>
        <tbody>{rows(person.journals).map((r, i) => (
          <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
            <td style={TDC}>{i + 1}</td><td style={TD}><RO val={r.title} /></td><td style={TD}><RO val={r.journal} /></td>
            <td style={TDC}><RO val={r.issn} center /></td><td style={TDC}><RO val={r.index} center /></td>
            <td style={TDV}><ViewDocsCell docKey={`jour-${i}`} docs={docs} /></td>
            {showHodCol && <><td style={TDS}><RO val={r.score} center /></td><td style={TDS_HOD}><RO val={r.hod} center /></td></>}
            {!showHodCol && <td style={TDS}><RO val={r.score} center /></td>}
            {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
            <td style={TDS_DEAN}><RO val={r.dean || r.score} center /></td>
            <td style={TDS_VC}><VCInput val={get("journals", i, "vc")} onChange={v => set("journals", i, "vc", v)} /></td>
          </tr>
        ))}</tbody></table></div>
      </SC>

      {/* B2–B8 */}
      {[
        { title: "B2. Books / Book Chapters (Max 50)", key: "books", docPfx: "book",
          render: (r) => [r.title, r.book, r.issn, r.first] },
        { title: "B3. ICT / E-Content (Max 20)", key: "ict", docPfx: "ict",
          render: (r) => [r.title, r.type, r.quad] },
        { title: "B4. Research Guidance (Max 30)", key: "research", docPfx: "res",
          render: (r) => [r.degree, r.name, r.thesis] },
        { title: "B4b. Research Projects (Max 45)", key: "projects2", docPfx: "project2",
          render: (r) => [r.title, r.agency, r.date, r.amount, r.role, r.status] },
        { title: "B5a. Patents / IPR (Max 40)", key: "patents", docPfx: "pat",
          render: (r) => [r.title, r.type, r.date, r.status, r.fileNo] },
        { title: "B5b. Awards / Fellowships (Max 10)", key: "awards", docPfx: "awd",
          render: (r) => [r.title, r.date, r.agency, r.level] },
        { title: "B6. Conferences (Max 30)", key: "confs", docPfx: "conf",
          render: (r) => [r.title, r.type, r.org, r.level] },
        { title: "B7. Research Proposals (Max 20)", key: "proposals", docPfx: "prop",
          render: (r) => [r.title, r.duration, r.agency, r.amount] },
        { title: "B8. Self Development — FDP (Max 10)", key: "fdps", docPfx: "fdp",
          render: (r) => [r.program, r.duration, r.org] },
      ].map(({ title, key, docPfx, render }) => (
        <SC key={key} title={title} accent="#b45309">
          <div style={{ overflowX: "auto" }}><table style={T}><thead>
            <tr>
              <th style={TH}>SN</th><th style={TH}>Details</th><th style={TH}>Docs</th>
              {showHodCol && <><th style={TH}>Faculty Score</th><th style={TH_HOD}>HOD Score</th></>}
              {!showHodCol && <th style={TH}>Self Score</th>}
              {showDirCol && <th style={TH_DIR}>Dir Score</th>}
              <th style={TH_DEAN}>Dean Score</th>
              <th style={TH_VC}>VC Score</th>
            </tr>
          </thead>
          <tbody>{rows(person[key]).map((r, i) => {
            const cells = render(r);
            return (
              <tr key={i} style={i % 2 ? { background: "#f8fafc" } : {}}>
                <td style={TDC}>{i + 1}</td>
                <td style={TD}>
                  {cells.filter(Boolean).map((c, ci) => (
                    <span key={ci} style={{ display: "inline-block", marginRight: 8, color: "#334155" }}>{c}</span>
                  ))}
                </td>
                <td style={TDV}><ViewDocsCell docKey={`${docPfx}-${i}`} docs={docs} /></td>
                <td style={TDS}><RO val={r.score} center /></td>
                {showHodCol && <td style={TDS_HOD}><RO val={r.hod} center /></td>}
                {showDirCol && <td style={TDS_DIR}><RO val={r.director} center /></td>}
                <td style={TDS_DEAN}><RO val={r.dean || r.score} center /></td>
                <td style={TDS_VC}><VCInput val={get(key, i, "vc")} onChange={v => set(key, i, "vc", v)} /></td>
              </tr>
            );
          })}</tbody></table></div>
        </SC>
      ))}
    </div>
  );
}

// ─── Score Calculator ─────────────────────────────────────────────────────────
function calcVCScore(person, vcData) {
  const get = (section, idx, field) => {
    if (vcData[section]) {
      const s = vcData[section];
      return idx === null ? n(Array.isArray(s) ? s[0]?.[field] : s[field]) : n(s[idx]?.[field]);
    }
    const source = person[section];
    return idx === null ? n(Array.isArray(source) ? source[0]?.[field] : source?.[field]) : n(source?.[idx]?.[field]);
  };
  const getS = (key) => n(vcData[key] ?? person[key]);
  const sum = (arr, s, f) => (arr || []).reduce((a, _, i) => a + get(s, i, f), 0);

  const partA = sum(person.lectures, "lectures", "vc") + get("courseFile", null, "vc") +
    n(vcData.innovVc ?? vcData.innovVC ?? person.innovVc) + sum(person.projects, "projects", "vc") +
    sum(person.quals, "quals", "vc") + sum(person.feedback, "feedback", "vc") +
    sum(person.deptActs, "deptActs", "vc") + sum(person.uniActs, "uniActs", "vc") +
    sum(person.society, "society", "vc") + sum(person.industry, "industry", "vc") +
    sum(person.acr, "acr", "vc");

  const partB = sum(person.journals, "journals", "vc") + sum(person.books, "books", "vc") +
    sum(person.ict, "ict", "vc") + sum(person.research, "research", "vc") +
    sum(person.projects2, "projects2", "vc") + sum(person.patents, "patents", "vc") + sum(person.awards, "awards", "vc") +
    sum(person.confs, "confs", "vc") + sum(person.proposals, "proposals", "vc") +
    sum(person.fdps, "fdps", "vc") + sum(person.training || [], "training", "vc");

  return { partA, partB, total: partA + partB };
}

// ─── Analytics Overview ───────────────────────────────────────────────────────
function AnalyticsPanel({ deans, directors, hods, faculty }) {
  const all = [
    ...deans.map(d => ({ ...d, role: "Dean" })),
    ...directors.map(d => ({ ...d, role: "Director" })),
    ...hods.map(h => ({ ...h, role: "HOD" })),
    ...faculty.map(f => ({ ...f, role: "Faculty" })),
  ];

  const reviewed = all.filter(isVcReviewed);
  const pending  = all.filter(p => !isVcReviewed(p));
  const avgScore = reviewed.length ? (reviewed.reduce((a, p) => a + (p.vcTotal || p.deanTotal || 0), 0) / reviewed.length).toFixed(1) : "—";

  const roleStats = ["Dean", "Director", "HOD", "Faculty"].map(role => ({
    role,
    count: all.filter(p => p.role === role).length,
    approved: all.filter(p => p.role === role && isVcReviewed(p)).length,
  }));

  const topPerformers = [...all].sort((a, b) => (b.vcTotal || b.deanTotal || 0) - (a.vcTotal || a.deanTotal || 0)).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>University Analytics</h1>
      <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 11 }}>{APP_INFO.SHORT_NAME} · AY {VC_USER.ay} — VC-level overview</p>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Records", val: all.length, icon: "📋", color: "#0f172a" },
          { label: "VC Reviewed", val: reviewed.length, icon: "✅", color: "#059669" },
          { label: "Pending VC", val: pending.length, icon: "⏳", color: "#d97706" },
          { label: "Avg VC Score", val: avgScore, sub: `/${MAX_SCORES.GRAND_TOTAL}`, icon: "📊", color: "#b45309" },
        ].map(({ label, val, icon, color, sub }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>
              {val}<span style={{ fontSize: 13, color: "#94a3b8" }}>{sub}</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Role Distribution */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Approval Status by Role</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {roleStats.map(s => (
              <div key={s.role}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{s.role}</span>
                  <span style={{ color: "#64748b" }}>{s.approved} / {s.count} approved</span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct(s.approved, s.count)}%`, height: "100%", background: "#b45309" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Top Performers (Consolidated)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topPerformers.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? "1px solid #f1f5f9" : "none" }}>
                <Avatar initials={p.avatar} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>{p.role} · {p.department}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: grade(p.vcTotal || p.deanTotal || 0, MAX_SCORES.GRAND_TOTAL).color }}>
                  {p.vcTotal || p.deanTotal || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Person Card ──────────────────────────────────────────────────────────────
function PersonCard({ person, personMode, onReview, onDelete }) {
  const g = grade(person.vcTotal || person.deanTotal || 300, MAX_SCORES.GRAND_TOTAL);
  const docCount = Object.values(person.docs || {}).reduce((a, arr) => a + arr.length, 0);

  const scoreRows = [];
  if (personMode === "faculty" || personMode === "hod") {
    scoreRows.push({ label: personMode === "hod" ? "Own Score" : "HOD Score", val: person.hodTotal || person.hodScore || 0, color: "#6366f1" });
  }
  if (personMode !== "dean") {
    scoreRows.push({ label: "Dir Score", val: person.directorTotal || person.directorScore || 0, color: "#0ea5e9" });
  }
  scoreRows.push({ label: "Dean Score", val: person.deanTotal || person.deanSelfScore || 0, color: "#7c3aed" });
  scoreRows.push({ label: "VC Score", val: person.vcTotal || 0, color: "#b45309" });

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,.07)", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar initials={person.avatar} color={person.avatarColor || "#b45309"} size={46} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{person.name}</div>
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{person.designation}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{person.employeeId}</div>
          {person.department && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{person.department}</div>}
        </div>
        <StatusBadge status={person.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scoreRows.length},1fr)`, gap: 10, background: "#f8fafc", borderRadius: 8, padding: "12px 14px" }}>
        {scoreRows.map(({ label, val, color }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{val}<span style={{ fontSize: 9, color: "#94a3b8" }}>/{MAX_SCORES.GRAND_TOTAL}</span></div>
            <ScoreBar score={val} max={MAX_SCORES.GRAND_TOTAL} color={color} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>Docs: {docCount} files · {person.submittedOn}</div>
        <button onClick={() => onDelete(person, personMode)}
          style={{ fontSize: 11, padding: "7px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontFamily: "Georgia, serif", marginRight: 8 }}>
          Delete
        </button>
        <button onClick={() => onReview(person, personMode)}
          style={{ fontSize: 11, padding: "7px 18px", background: isVcReviewed(person) ? "#1e293b" : "#b45309", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontFamily: "Georgia, serif" }}>
          {isVcReviewed(person) ? "✎ Edit VC Approval" : "🔍 Review & Approve →"}
        </button>
      </div>
    </div>
  );
}

// ─── VC Review Panel (Main Review Container) ──────────────────────────────────
function VCReviewPanel({ person, personMode, onBack, onSubmit }) {
  const [vcData, setVcData] = useState({});
  const [remarks, setRemarks] = useState(person.vcRemarks || "");
  const [tab, setTab] = useState("form");

  const { partA, partB, total } = calcVCScore(person, vcData);
  const g = grade(total, MAX_SCORES.GRAND_TOTAL);

  const deanTotal = person.deanTotal || person.deanSelfScore || 0;
  const dirTotal  = person.directorTotal || person.directorScore || 0;
  const hodTotal   = person.hodTotal || person.hodScore || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* VC Header */}
      <div style={{ background: "#451a03", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, marginBottom: 16, borderRadius: 10, borderBottom: "4px solid #b45309" }}>
        <button onClick={onBack} style={{ background: "#78350f", border: "none", color: "#fde68a", cursor: "pointer", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontFamily: "Georgia, serif" }}>← Back</button>
        <Avatar initials={person.avatar} color={person.avatarColor || "#b45309"} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{person.name}</div>
          <div style={{ color: "#fde68a", fontSize: 11 }}>{person.designation} · {person.employeeId}</div>
        </div>
        
        {/* Prior Score Display */}
        <div style={{ display: "flex", gap: 8 }}>
          {[["Dean Total", deanTotal, "#ddd6fe"], ["VC Part A", partA.toFixed(1), "#fde68a"], ["VC Part B", partB.toFixed(1), "#fcd34d"]].map(([l, v, c]) => (
            <div key={l} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 12px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 }}>{l}</div>
              <div style={{ color: c, fontWeight: 800, fontSize: 14 }}>{v}</div>
            </div>
          ))}
          <div style={{ background: g.bg, borderRadius: 8, padding: "8px 12px", textAlign: "center", border: `2px solid ${g.color}` }}>
            <div style={{ color: g.color, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 800 }}>VC Total</div>
            <div style={{ color: g.color, fontWeight: 900, fontSize: 14 }}>{total.toFixed(1)}<span style={{ fontSize: 10, opacity: 0.7 }}>/{MAX_SCORES.GRAND_TOTAL}</span></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["form", "📋 Review Form"], ["remarks", "✏️ Final Approval"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 22px", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: 700, background: tab === id ? "#78350f" : "#fff", color: tab === id ? "#fff" : "#92400e", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "form" && <VCReviewForm person={person} vcData={vcData} setVcData={setVcData} personMode={personMode} />}

      {tab === "remarks" && (
        <div style={{ background: "#fff", borderRadius: 10, padding: "22px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
          <h3 style={{ margin: "0 0 18px", color: "#451a03", fontSize: 16 }}>VC Final Remarks & Sanction</h3>

          {/* Remarks Chain */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            {person.directorRemarks && (
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", marginBottom: 4 }}>Director Remarks</div>
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{person.directorRemarks}</div>
              </div>
            )}
            {person.deanRemarks && (
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5b21b6", textTransform: "uppercase", marginBottom: 4 }}>Dean Remarks</div>
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{person.deanRemarks}</div>
              </div>
            )}
          </div>

          <SC title="Score Reconciliation" accent="#b45309">
            <table style={{ ...T, fontSize: 12 }}>
              <thead><tr>
                <th style={TH}>Section</th>
                {personMode === "faculty" && <th style={TH_HOD}>HOD</th>}
                {personMode !== "dean" && <th style={TH_DIR}>Dir</th>}
                <th style={TH_DEAN}>Dean</th>
                <th style={TH_VC}>VC Final</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td style={TD}>Part A — Teaching</td>
                  {personMode === "faculty" && <td style={TDS_HOD}>—</td>}
                  {personMode !== "dean" && <td style={TDS_DIR}>—</td>}
                  <td style={TDS_DEAN}>—</td>
                  <td style={{ ...TDS_VC, fontWeight: 700 }}>{partA.toFixed(1)}</td>
                </tr>
                <tr>
                  <td style={TD}>Part B — Research</td>
                  {personMode === "faculty" && <td style={TDS_HOD}>—</td>}
                  {personMode !== "dean" && <td style={TDS_DIR}>—</td>}
                  <td style={TDS_DEAN}>—</td>
                  <td style={{ ...TDS_VC, fontWeight: 700 }}>{partB.toFixed(1)}</td>
                </tr>
                <tr style={{ background: "#fffbeb", fontWeight: 800 }}>
                  <td style={TD}>GRAND TOTAL</td>
                  {personMode === "faculty" && <td style={TDS_HOD}>{hodTotal}</td>}
                  {personMode !== "dean" && <td style={TDS_DIR}>{dirTotal}</td>}
                  <td style={TDS_DEAN}>{deanTotal}</td>
                  <td style={{ ...TDS_VC, fontSize: 15, color: "#92400e" }}>{total.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </SC>

          <label style={{ fontWeight: 800, fontSize: 13, color: "#451a03", display: "block", marginBottom: 8 }}>VC Final Observations & Decisions</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={5}
            placeholder="Final executive decision, appraisal score confirmation, and future recommendations..."
            style={{ width: "100%", border: "2px solid #fde68a", borderRadius: 8, padding: "12px", fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box", marginBottom: 18, background: "#fffdf5" }} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button onClick={onBack} style={{ padding: "10px 24px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif" }}>Cancel</button>
            <button onClick={() => {
              if (!remarks.trim()) {
                alert("Please enter a rejection comment before rejecting this appraisal.");
                return;
              }
              onSubmit(person.id, { partA, partB, total }, remarks, personMode, buildVcSectionScores(person, vcData), "rejected");
            }}
              style={{ padding: "11px 26px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: "Georgia, serif" }}>
              Reject
            </button>
            <button onClick={() => onSubmit(person.id, { partA, partB, total }, remarks, personMode, buildVcSectionScores(person, vcData), "approved")}
              style={{ padding: "11px 32px", background: "#92400e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: "Georgia, serif", boxShadow: "0 4px 10px rgba(146, 64, 14, 0.2)" }}>
              ✔ CONFIRM & SIGN APPRAISAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main VC Dashboard ────────────────────────────────────────────────────────
export default function VCDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("analytics");
  const [reviewing, setReviewing] = useState(null); // { person, personMode }
  const [deanList, setDeanList] = useState([]);
  const [dirList, setDirList] = useState([]);
  const [hodList, setHodList] = useState([]);
  const [facList, setFacList] = useState([]);

  useEffect(() => {
    let active = true;

    const loadReviewQueue = async () => {
      try {
        const items = await fetchReviewQueueForRole({
          reviewerRole: "vc",
          reviewerProfile: { ...profileFromLocalStorage(), appraisal_role: "vc" },
        });

        if (!active) return;
        setFacList(items.filter((item) => item.appraisalRole === "faculty"));
        setHodList(items.filter((item) => item.appraisalRole === "hod"));
        setDirList(items.filter((item) => item.appraisalRole === "director"));
        setDeanList(items.filter((item) => item.appraisalRole === "dean"));
      } catch (err) {
        console.error("Could not load VC review queue:", err);
        if (!active) return;
        setFacList([]);
        setHodList([]);
        setDirList([]);
        setDeanList([]);
      }
    };

    loadReviewQueue();
    return () => {
      active = false;
    };
  }, []);

  const [filterStatus, setFilterStatus] = useState("All");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleSubmit = async (id, scores, remarks, personMode, sectionScores, decision = "approved") => {
    const sourceList = personMode === "dean"
      ? deanList
      : personMode === "director"
        ? dirList
        : personMode === "hod"
          ? hodList
          : facList;
    const item = sourceList.find((entry) => entry.id === id);
    if (!item) return;
    const rejected = decision === "rejected";

    try {
      await submitWorkflowReview({
        subjectEmail: item.email,
        academicYear: item.academicYear || item.info?.ay,
        reviewerRole: "vc",
        partAScore: scores.partA,
        partBScore: scores.partB,
        totalScore: scores.total,
        remarks,
        sectionScores,
        decision,
      });

      const upd = (list) => list.map(p => p.id === id
        ? { ...p, ...sectionScores, innovVc: sectionScores?.innovativeTeaching?.vc ?? p.innovVc, status: rejected ? "Rejected" : "Reviewed", workflowStatus: rejected ? rejectedStatusFor("vc") : reviewedStatusFor("vc"), vcPartA: scores.partA, vcPartB: scores.partB, vcTotal: scores.total, vcRemarks: remarks }
        : p);
      if (personMode === "dean") setDeanList(upd);
      else if (personMode === "director") setDirList(upd);
      else if (personMode === "hod") setHodList(upd);
      else if (personMode === "faculty") setFacList(upd);
      setReviewing(null);
      alert(rejected ? "VC rejected this appraisal." : "VC final approval submitted.");
    } catch (err) {
      console.error("Could not submit VC review:", err);
      alert(`Unable to submit VC review.\n\n${err.message}`);
    }
  };

  const handleDeleteSubmission = async (person, personMode) => {
    if (!person) return;
    const confirmed = window.confirm(`Delete ${person.name}'s submitted appraisal and unlock it for editing? Their saved form data will remain available for resubmission.`);
    if (!confirmed) return;

    try {
      await deleteWorkflowSubmission({
        subjectEmail: person.email,
        academicYear: person.academicYear || person.info?.ay,
      });

      const remove = (list) => list.filter(entry => entry.id !== person.id);
      if (personMode === "dean") setDeanList(remove);
      else if (personMode === "director") setDirList(remove);
      else if (personMode === "hod") setHodList(remove);
      else if (personMode === "faculty") setFacList(remove);
      if (reviewing?.person?.id === person.id) setReviewing(null);

      alert("Submission deleted. The user can now edit and submit the appraisal again.");
    } catch (err) {
      console.error("Could not delete appraisal submission:", err);
      alert(`Unable to delete appraisal submission.\n\n${err.message}`);
    }
  };

  const currentList = activeTab === "deans" ? deanList : activeTab === "directors" ? dirList : activeTab === "hods" ? hodList : facList;
  
  const filtered = filterStatus === "All" ? currentList : (filterStatus === "Pending VC Review"
    ? currentList.filter(p => !isVcReviewed(p))
    : currentList.filter(isVcReviewed));

  const filterOptions = ["All", "Pending VC Review", "VC Reviewed"];
  const personModeFor = (tab) => tab.slice(0, -1); // "deans" -> "dean" etc

  const tabLabel = activeTab === "analytics" ? "University Analytics" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Approvals`;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Georgia, serif", background: "#fdfbf7", color: "#1e293b" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 260, minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", padding: "22px 18px", gap: 14, position: "sticky", top: 0, alignSelf: "flex-start", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#b45309,#f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16 }}>VC</div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 14, letterSpacing: -0.2 }}>{APP_INFO.PORTAL_NAME}</div>
            <div style={{ color: "#94a3b8", fontSize: 9 }}>{APP_INFO.UNIVERSITY_NAME}</div>
          </div>
        </div>

        <div style={{ background: "#451a03", borderRadius: 10, padding: "10px 14px", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontWeight: 800, fontSize: 11, color: "#fde68a" }}>Vice Chancellor</div>
          <div style={{ color: "rgba(253, 230, 138, 0.6)", fontSize: 10 }}>Executive Oversight</div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "8px 0" }} />

        {[
          { id: "analytics", icon: "📊", label: "University Analytics" },
          { id: "deans",     icon: "🎓", label: "Dean Approvals" },
          { id: "directors", icon: "🏛️", label: "Director Approvals" },
          { id: "hods",      icon: "👥", label: "HOD Approvals" },
          { id: "faculty",   icon: "📋", label: "Faculty Approvals" },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setReviewing(null); setFilterStatus("All"); }}
            style={{ background: activeTab === tab.id ? "#1e293b" : "none", border: "none", borderRadius: 8, padding: "11px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%", fontFamily: "Georgia, serif", transition: "all 0.2s" }}>
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span style={{ color: activeTab === tab.id ? "#fff" : "#94a3b8", fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13 }}>{tab.label}</span>
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
        
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px" }}>
          <Avatar initials={(localStorage.getItem("name") || "U").split(" ").map(n => n[0]).join("").toUpperCase()} color="#b45309" size={38} />
          <div>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{localStorage.getItem("name") || "Vice Chancellor"}</div>
            <div style={{ color: "#64748b", fontSize: 10 }}>VC · {APP_INFO.SHORT_NAME}</div>
          </div>
        </div>
        
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, background: "none", border: "1px solid #374151", borderRadius: 8, padding: "9px 11px", cursor: "pointer", fontFamily: "Georgia, serif" }}
          onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <span style={{ fontSize: 15 }}>🚪</span>
          <span style={{ color: "#f87171", fontWeight: 700, fontSize: 12 }}>Logout</span>
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16, overflowX: "auto" }}>

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <AnalyticsPanel deans={deanList} directors={dirList} hods={hodList} faculty={facList} />
        )}

        {/* LIST VIEWS */}
        {activeTab !== "analytics" && !reviewing && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>{tabLabel}</h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 11 }}>{APP_INFO.SHORT_NAME} · AY {VC_USER.ay} — VC Final Approval</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>
                  ⏳ {filtered.filter(p => !isVcReviewed(p)).length} Pending
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: "#d1fae5", color: "#065f46" }}>
                  ✔ {filtered.filter(isVcReviewed).length} VC Approved
                </div>
              </div>
            </div>

            {/* Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#fff", borderRadius: 9, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Filter:</span>
              {filterOptions.map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  style={{ fontSize: 11, padding: "4px 12px", border: "1px solid #e2e8f0", borderRadius: 20, cursor: "pointer", fontFamily: "Georgia, serif", background: filterStatus === f ? "#0f172a" : "none", color: filterStatus === f ? "#f1f5f9" : "#475569" }}>
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
              {filtered.map(person => (
                <PersonCard
                  key={person.id} person={person}
                  personMode={personModeFor(activeTab)}
                  onReview={(p, m) => setReviewing({ person: p, personMode: m })}
                  onDelete={handleDeleteSubmission}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>All caught up!</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>No records match the selected filter.</div>
              </div>
            )}
          </>
        )}

        {/* VC REVIEW PANEL */}
        {reviewing && (
          <VCReviewPanel
            person={reviewing.person}
            personMode={reviewing.personMode}
            onBack={() => setReviewing(null)}
            onSubmit={handleSubmit}
          />
        )}
      </main>
      {showLogoutModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 14, padding: "32px 36px", maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, fontFamily: "Georgia, serif" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🚪</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 6 }}>Confirm Logout</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                You are about to log out of <strong>{APP_INFO.PORTAL_NAME}</strong>.<br />Any unsaved changes will be lost.
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ flex: 1, padding: "10px 0", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  localStorage.clear();
                  navigate("/", { replace: true });
                }}
                style={{ flex: 1, padding: "10px 0", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif" }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
