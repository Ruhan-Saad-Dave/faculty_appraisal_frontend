const clean = (value) => String(value ?? "").trim();
const n = (value) => parseFloat(value) || 0;

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && clean(value) !== "");

const valueFrom = (sources, keys) =>
  firstPresent(...sources.flatMap((source = {}) => keys.map((key) => source?.[key])));

const numericFrom = (sources, keys, fallback = 0) => {
  const value = valueFrom(sources, keys);
  return value === undefined ? n(fallback) : n(value);
};

const sectionApplicabilityFrom = (sources) =>
  sources.find((source = {}) => source?.sectionApplicability)?.sectionApplicability || {};

export const standardSubmittedScoreSummary = (subject = {}, fallback = {}) => {
  const sources = [
    subject,
    subject.declaration,
    subject.totals,
    subject.payload,
    subject.payload?.totals,
    subject.payload?.form,
    subject.form,
    subject.info,
  ].filter(Boolean);

  const sectionApplicability = sectionApplicabilityFrom(sources);
  const inferredPartAMax = n(fallback.partAMax ?? fallback.effectivePartAMax) ||
    (sectionApplicability.projects === "notApplicable" ? 190 : 200);
  const inferredPartBMax = n(fallback.partBMax ?? fallback.effectivePartBMax) ||
    (sectionApplicability.research === "notApplicable" ? 345 : 375);

  const partAMax = numericFrom(sources, [
    "partAMax", "part_a_max", "effectivePartAMax", "effective_part_a_max", "maxPartA",
  ], inferredPartAMax);
  const partBMax = numericFrom(sources, [
    "partBMax", "part_b_max", "effectivePartBMax", "effective_part_b_max", "maxPartB",
  ], inferredPartBMax);
  const grandMax = numericFrom(sources, [
    "grandMax", "grand_max", "effectiveGrandMax", "effective_grand_max", "maxGrand", "totalMax",
  ], partAMax + partBMax);

  const partA = numericFrom(sources, [
    "partATotal", "partA", "part_a_total", "part_a_score", "selfPartA", "self_part_a",
    "facultyPartA", "faculty_part_a", "facultyPartAScore", "faculty_part_a_score",
  ], fallback.partA);
  const partB = numericFrom(sources, [
    "partBTotal", "partB", "part_b_total", "part_b_score", "selfPartB", "self_part_b",
    "facultyPartB", "faculty_part_b", "facultyPartBScore", "faculty_part_b_score",
  ], fallback.partB);
  const total = numericFrom(sources, [
    "grandTotal", "grand_total", "totalScore", "total_score", "total", "selfTotal",
    "self_total", "facultyTotal", "faculty_total", "facultyScore", "faculty_score",
  ], fallback.total ?? partA + partB);

  return { partA, partB, total, partAMax, partBMax, grandMax };
};

export const attachSubmittedScoreSummary = (target = {}, ...sources) => {
  const summary = standardSubmittedScoreSummary(Object.assign({}, ...sources, target));
  return {
    ...target,
    partATotal: summary.partA,
    partBTotal: summary.partB,
    grandTotal: summary.total,
    effectivePartAMax: summary.partAMax,
    effectivePartBMax: summary.partBMax,
    effectiveGrandMax: summary.grandMax,
  };
};
