import { api } from "./api";
import { storeUserSession } from "../auth/session";
import { getDeanTrack, getReviewChain, normalizeRoleForWorkflow, pendingStatusFor } from "../utils/hierarchy";
import { DEAN_TRACKS } from "../constants/universityHierarchy";

const SNAPSHOT_SETTERS = {
  info: "setInfo",
  lectures: "setLectures",
  courseFile: "setCourseFile",
  innovRows: "setInnovRows",
  innovDetails: "setInnovDetails",
  innovScore: "setInnovScore",
  innovHod: "setInnovHod",
  innovDirector: "setInnovDirector",
  innovDean: "setInnovDean",
  innovVc: "setInnovVc",
  projects: "setProjects",
  quals: "setQuals",
  feedback: "setFeedback",
  deptActs: "setDeptActs",
  uniActs: "setUniActs",
  society: "setSociety",
  industry: "setIndustry",
  acr: "setAcr",
  journals: "setJournals",
  popularWritings: "setPopularWritings",
  books: "setBooks",
  ict: "setIct",
  research: "setResearch",
  projects2: "setProjects2",
  internalProjects: "setInternalProjects",
  externalProjects: "setExternalProjects",
  ipr: "setIpr",
  patents: "setPatents",
  awards: "setAwards",
  confs: "setConfs",
  proposals: "setProposals",
  products: "setProducts",
  fdps: "setFdps",
  training: "setTraining",
};

const snapshotFormFromPayload = (payload) => {
  if (!payload) return null;
  if (payload.form && typeof payload.form === "object") return payload.form;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return null;
};

const applySnapshotToSetters = (snapshotPayload, setters) => {
  const snapshotForm = snapshotFormFromPayload(snapshotPayload);
  if (!snapshotForm || !setters) return;

  Object.entries(SNAPSHOT_SETTERS).forEach(([formKey, setterKey]) => {
    if (Object.prototype.hasOwnProperty.call(snapshotForm, formKey)) {
      setters[setterKey]?.(snapshotForm[formKey]);
    }
  });

  if (snapshotPayload?.docs) {
    setters.setDocs?.(snapshotPayload.docs);
  }
};

export const loadAppraisalSnapshot = async ({ facultyEmail, academicYear }) => {
  if (!facultyEmail || !academicYear) return null;
  try {
    const data = await api.get("/appraisal/snapshot", {
      params: { academic_year: academicYear },
    });
    return data?.payload ?? data ?? null;
  } catch {
    return null;
  }
};

export const saveAppraisalDraftSection = async ({
  facultyEmail,
  academicYear,
  form,
  docs = {},
  totals = {},
  submitterProfile,
  sectionSaveStatus = {},
}) => {
  if (!facultyEmail) throw new Error("Please login again before saving. Your email was not found in this session.");
  if (!academicYear) throw new Error("Academic year is required before saving.");

  await api.put("/appraisal/snapshot", {
    academic_year: academicYear,
    payload: {
      form: { ...form, sectionSaveStatus },
      totals,
      docs,
      submitterProfile,
      savedAt: new Date().toISOString(),
    },
  });
};

export const docsToRows = (docs, facultyEmail, academicYear) => {
  const docSectionFromKey = (docKey) => docKey.replace(/-\d+$/, "").replace(/\d+$/, "");
  const docRowFromKey = (docKey) => {
    const match = docKey.match(/(\d+)$/);
    return match ? Number(match[1]) + 1 : null;
  };

  return Object.entries(docs || {}).flatMap(([docKey, files]) =>
    (files || []).slice(0, 1)
      .filter((file) => file?.url && !String(file.url).startsWith("blob:"))
      .map((file) => ({
        faculty_email: facultyEmail,
        academic_year: academicYear,
        section: docSectionFromKey(docKey),
        row_no: docRowFromKey(docKey),
        doc_key: docKey,
        file_name: file.name,
        file_type: file.type,
        file_url: file.url,
        storage_path: file.publicId || null,
      }))
  );
};

export const loadAppraisalDocuments = async ({ facultyEmail, academicYear, setDocs }) => {
  if (!facultyEmail || !academicYear || !setDocs) return;

  try {
    const data = await api.get("/appraisal-documents", {
      params: { academic_year: academicYear },
    });

    const groupedDocs = {};
    (data || []).forEach((row) => {
      const key = row.doc_key || `${row.section}-${Math.max((row.row_no || 1) - 1, 0)}`;
      if (groupedDocs[key]?.length) return;
      groupedDocs[key] = [{
        name: row.file_name,
        type: row.file_type,
        url: row.file_url,
        publicId: row.storage_path,
      }];
    });

    setDocs(groupedDocs);
  } catch {
    // non-fatal
  }
};

export const loadSavedAppraisal = async ({ facultyEmail, academicYear, setters }) => {
  if (!facultyEmail || !academicYear || !setters) return;

  const snapshotPayload = await loadAppraisalSnapshot({ facultyEmail, academicYear });
  if (snapshotPayload) {
    applySnapshotToSetters(snapshotPayload, setters);
  }
};

// Used by reviewWorkflow to load any faculty's appraisal for authority review.
export const fetchSavedAppraisal = async ({ facultyEmail, academicYear }) => {
  if (!facultyEmail) throw new Error("Faculty email is required to open the submitted form.");
  if (!academicYear) throw new Error("Academic year is required to open the submitted form.");
  try {
    const data = await api.get(
      `/dashboard/faculty/${encodeURIComponent(facultyEmail)}`,
      { params: { academic_year: academicYear } }
    );
    return readSubmittedAppraisalResponse(data, facultyEmail, academicYear);
  } catch (err) {
    if (err?.statusCode === 403) {
      const repaired = await repairDeanDivisionProfile();
      if (repaired) {
        try {
          const data = await api.get(
            `/dashboard/faculty/${encodeURIComponent(facultyEmail)}`,
            { params: { academic_year: academicYear } }
          );
          return readSubmittedAppraisalResponse(data, facultyEmail, academicYear);
        } catch {
          // Fall through to the explicit authority message below.
        }
      }
      throw new Error("Access denied while opening this submitted form. I tried the Dean division-profile repair, but the backend still rejected the request. Please log out and log in again so the refreshed profile/token is used. If it still fails, the backend faculty_profiles.school for this Dean must be updated to 'engineering' or 'non_engineering'.", { cause: err });
    }
    throw err;
  }
};

const readSubmittedAppraisalResponse = (data, facultyEmail, academicYear) => {
  if (!data) {
    throw new Error(`No saved appraisal snapshot was found for ${facultyEmail} in academic year ${academicYear}. Check that the academic year matches the submitted record.`);
  }
  const normalized = normalizeFetchedAppraisal(data);
  const form = normalized.payload?.form || normalized.form;
  if (!hasSubmittedFormData(form)) {
    throw new Error(`The saved appraisal snapshot for ${facultyEmail} does not contain submitted form section data. The user may need to resubmit the appraisal for academic year ${academicYear}.`);
  }
  return normalized;
};

const repairDeanDivisionProfile = async () => {
  const role = normalizeRoleForWorkflow(sessionStorage.getItem("role"));
  if (role !== "dean") return false;

  const profile = {
    school: sessionStorage.getItem("school") || "",
    department: sessionStorage.getItem("department") || "",
    designation: sessionStorage.getItem("designation") || "",
  };
  if (!profile.school) return false;
  const deanTrack = getDeanTrack(profile);
  if (![DEAN_TRACKS.ENGINEERING, DEAN_TRACKS.NON_ENGINEERING].includes(deanTrack)) return false;

  try {
    await api.put("/auth/me", { school: deanTrack });
    const refreshedProfile = await api.get("/auth/me").catch(() => null);
    if (refreshedProfile) {
      storeUserSession({ profile: refreshedProfile });
    }
    sessionStorage.setItem("school", deanTrack);
    sessionStorage.setItem("hasHod", "false");
    sessionStorage.setItem("hasHOD", "false");
    return true;
  } catch {
    return false;
  }
};

const FORM_SECTION_KEYS = [
  "lectures", "courseFile", "projects", "quals", "feedback", "deptActs", "uniActs",
  "society", "industry", "acr", "journals", "books", "ict", "research", "projects2",
  "internalProjects", "externalProjects", "ipr", "patents", "awards", "confs",
  "proposals", "products", "fdps", "training", "popularWritings",
];

const REVIEW_FIELD_BY_ROLE = {
  hod: "hod",
  center_head: "hod",
  director: "director",
  dean: "dean",
  vc: "vc",
};

const REVIEW_INNOV_FIELD_BY_ROLE = {
  hod: "innovHod",
  center_head: "innovHod",
  director: "innovDirector",
  dean: "innovDean",
  vc: "innovVc",
};

const hasSubmittedFormData = (form = {}) =>
  Boolean(form && FORM_SECTION_KEYS.some((key) => Array.isArray(form[key]) && form[key].length > 0));

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const reviewArrayFrom = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];

  return Object.entries(value).map(([role, review]) => {
    if (review && typeof review === "object" && !Array.isArray(review)) {
      return { reviewer_role: review.reviewer_role || review.reviewerRole || role, ...review };
    }
    return { reviewer_role: role, section_scores: review };
  });
};

const syntheticReviewFromRoleFields = (source = {}) =>
  ["hod", "center_head", "director", "dean", "vc"].flatMap((role) => {
    const camel = role.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const sectionScores = source[`${role}_section_scores`] || source[`${camel}SectionScores`];
    if (!sectionScores) return [];
    return [{
      reviewer_role: role,
      section_scores: sectionScores,
      part_a_score: source[`${role}_part_a`] || source[`${camel}PartA`],
      part_b_score: source[`${role}_part_b`] || source[`${camel}PartB`],
      total_score: source[`${role}_total`] || source[`${camel}Total`],
      remarks: source[`${role}_remarks`] || source[`${camel}Remarks`],
    }];
  });

const reviewsFromAppraisalResponse = (data = {}) => [
  ...reviewArrayFrom(data.reviews),
  ...reviewArrayFrom(data.review_history),
  ...reviewArrayFrom(data.reviewHistory),
  ...reviewArrayFrom(data.appraisal_reviews),
  ...reviewArrayFrom(data.appraisalReviews),
  ...reviewArrayFrom(data.payload?.reviews),
  ...reviewArrayFrom(data.payload?.review_history),
  ...reviewArrayFrom(data.payload?.reviewHistory),
  ...reviewArrayFrom(data.payload?.appraisal_reviews),
  ...reviewArrayFrom(data.payload?.appraisalReviews),
  ...syntheticReviewFromRoleFields(data),
  ...syntheticReviewFromRoleFields(data.payload || {}),
];

const reviewRowScore = (row, roleField, role) => {
  if (row === undefined || row === null) return undefined;
  if (typeof row !== "object" || Array.isArray(row)) return row;
  return firstPresent(
    row[roleField],
    row[role],
    row[`${roleField}_score`],
    row[`${role}_score`],
    row.reviewScore,
    row.review_score,
    row.reviewerScore,
    row.reviewer_score,
    row.value,
    row.total,
  );
};

const mergeSectionReviewScore = (rows, sectionScore, roleField, role) => {
  const baseRows = Array.isArray(rows) ? rows : [];

  if (Array.isArray(sectionScore)) {
    const length = Math.max(baseRows.length, sectionScore.length);
    return Array.from({ length }, (_, index) => {
      const existing = baseRows[index] || {};
      const reviewValue = reviewRowScore(sectionScore[index], roleField, role);
      return reviewValue === undefined ? existing : { ...existing, [roleField]: reviewValue };
    });
  }

  if (sectionScore && typeof sectionScore === "object") {
    const numericEntries = Object.entries(sectionScore)
      .filter(([key]) => /^\d+$/.test(key))
      .sort(([a], [b]) => Number(a) - Number(b));
    if (numericEntries.length) {
      return mergeSectionReviewScore(baseRows, numericEntries.map(([, value]) => value), roleField, role);
    }
  }

  const reviewValue = reviewRowScore(sectionScore, roleField, role);
  if (reviewValue === undefined) return rows;
  if (!baseRows.length) return [{ [roleField]: reviewValue }];
  return baseRows.map((row, index) => index === 0 ? { ...row, [roleField]: reviewValue } : row);
};

const applyReviewToForm = (form = {}, review = {}) => {
  const role = normalizeRoleForWorkflow(review.reviewer_role || review.reviewerRole || review.role);
  const roleField = REVIEW_FIELD_BY_ROLE[role];
  if (!roleField) return form;

  const rawScores = review.section_scores || review.sectionScores || review.scores || {};
  const scores = rawScores?.form || rawScores?.payload?.form || rawScores;
  if (!scores || typeof scores !== "object") return form;

  const next = { ...form };
  FORM_SECTION_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(scores, key)) return;
    next[key] = mergeSectionReviewScore(next[key], scores[key], roleField, role);
  });

  const innovField = REVIEW_INNOV_FIELD_BY_ROLE[role];
  const innovScore = firstPresent(
    reviewRowScore(scores.innovativeTeaching, roleField, role),
    scores[innovField],
    scores.innovative_teaching,
    scores.innovativeTeachingScore,
  );
  if (innovField && innovScore !== undefined) next[innovField] = innovScore;

  return next;
};

const mergeReviewScoresIntoForm = (form = {}, reviews = []) =>
  (reviews || []).reduce((current, review) => applyReviewToForm(current, review), form);

const aliasKeys = (rows, mapping) =>
  (rows || []).map((row) => {
    const out = { ...row };
    Object.entries(mapping).forEach(([from, to]) => {
      if (out[to] == null && out[from] != null) out[to] = out[from];
    });
    return out;
  });

const normalizeFetchedForm = (form = {}) => {
  const normalized = { ...form };
  const lectures = normalized.lectures || normalized.teaching_process || normalized.teachingProcess;
  if (lectures) {
    normalized.lectures = aliasKeys(lectures, {
      semester: "sem",
      course_code: "code",
      courseCode: "code",
      planned_classes: "planned",
      plannedClasses: "planned",
      conducted_classes: "conducted",
      conductedClasses: "conducted",
    });
  }
  if (normalized.feedback) {
    normalized.feedback = aliasKeys(normalized.feedback, {
      course_code: "code",
      courseCode: "code",
      feedback_1: "fb1",
      feedback1: "fb1",
      feedback_2: "fb2",
      feedback2: "fb2",
    });
  }
  if (normalized.society) {
    normalized.society = aliasKeys(normalized.society, { activity: "label" });
  }
  if (normalized.journals) {
    normalized.journals = aliasKeys(normalized.journals, { indexing: "index" });
  }
  if (normalized.books) {
    normalized.books = aliasKeys(normalized.books, {
      publisher: "pub",
      coauthor: "coauth",
      co_author: "coauth",
      first_author: "first",
      firstAuthor: "first",
    });
  }
  if (normalized.ict) {
    normalized.ict = aliasKeys(normalized.ict, {
      description: "desc",
      quadrant: "quad",
    });
  }
  if (normalized.research) {
    normalized.research = aliasKeys(normalized.research, {
      student_name: "name",
      studentName: "name",
    });
  }
  if (normalized.projects2) {
    normalized.projects2 = aliasKeys(normalized.projects2, {
      sanction_date: "date",
      sanctionDate: "date",
      project_status: "status",
      projectStatus: "status",
    });
  }
  if (normalized.externalProjects) {
    normalized.externalProjects = aliasKeys(normalized.externalProjects, {
      sanction_date: "date",
      sanctionDate: "date",
      project_status: "status",
      projectStatus: "status",
    });
  }
  if (normalized.patents) {
    normalized.patents = aliasKeys(normalized.patents, {
      patent_date: "date",
      patentDate: "date",
      patent_status: "status",
      patentStatus: "status",
      file_no: "fileNo",
      fileNo: "fileNo",
    });
  }
  if (normalized.awards) {
    normalized.awards = aliasKeys(normalized.awards, {
      award_date: "date",
      awardDate: "date",
    });
  }
  if (normalized.confs) {
    normalized.confs = aliasKeys(normalized.confs, { organization: "org" });
  }
  if (normalized.fdps) {
    normalized.fdps = aliasKeys(normalized.fdps, { organization: "org" });
  }
  return normalized;
};

const normalizeFetchedAppraisal = (data = {}) => {
  const reviews = reviewsFromAppraisalResponse(data);
  const payload = data.payload ? { ...data.payload } : null;
  const payloadForm = payload?.form ? mergeReviewScoresIntoForm(normalizeFetchedForm(payload.form), reviews) : null;
  const directForm = data.form ? mergeReviewScoresIntoForm(normalizeFetchedForm(data.form), reviews) : null;
  const directData = mergeReviewScoresIntoForm(normalizeFetchedForm(data), reviews);

  return {
    ...directData,
    ...(directForm ? { form: directForm } : {}),
    ...(payload ? { payload: { ...payload, ...(payloadForm ? { form: payloadForm } : {}) } } : {}),
  };
};

const renameKeys = (rows, mapping) =>
  (rows || []).map((row) => {
    const out = { ...row };
    Object.entries(mapping).forEach(([from, to]) => {
      if (from in out) { out[to] = out[from]; delete out[from]; }
    });
    return out;
  });

const mapFormForSubmit = (form) => ({
  ...form,
  lectures: renameKeys(form.lectures, {
    sem: "semester", code: "course_code",
    planned: "planned_classes", conducted: "conducted_classes",
  }),
  feedback: renameKeys(form.feedback, {
    code: "course_code", fb1: "feedback_1", fb2: "feedback_2",
  }),
  society: renameKeys(form.society, { label: "activity" }),
  journals: renameKeys(form.journals, { index: "indexing" }),
  books: renameKeys(form.books, {
    pub: "publisher", coauth: "coauthor", first: "first_author",
  }),
  ict: renameKeys(form.ict, { desc: "description", quad: "quadrant" }),
  research: renameKeys(form.research, { name: "student_name" }),
  projects2: renameKeys(form.projects2, {
    date: "sanction_date", status: "project_status",
  }),
  externalProjects: renameKeys(form.externalProjects, {
    date: "sanction_date", status: "project_status",
  }),
  patents: renameKeys(form.patents, {
    date: "patent_date", status: "patent_status", fileNo: "file_no",
  }),
  awards: renameKeys(form.awards, { date: "award_date" }),
  confs: renameKeys(form.confs, { org: "organization" }),
  fdps: renameKeys(form.fdps, { org: "organization" }),
});

export const submitAppraisal = async ({
  facultyEmail,
  academicYear,
  form,
  totals,
  docs,
  submitterProfile,
  activeProfile,
}) => {
  if (!facultyEmail) throw new Error("Please login again. Your email was not found in this session.");
  if (!academicYear) throw new Error("Academic year is required before submitting.");

  const workflowProfile = submitterProfile || activeProfile || {};
  const reviewChain = getReviewChain(workflowProfile);
  const nextReviewer = reviewChain[0] || "";
  const workflowStatus = nextReviewer ? pendingStatusFor(nextReviewer) : "Submitted";
  const basePayload = {
    academic_year: academicYear,
    form: mapFormForSubmit(form),
    totals,
    docs,
    submitter_profile: submitterProfile || activeProfile,
  };

  try {
    await api.post("/appraisal/submit", {
      ...basePayload,
      status: workflowStatus,
      workflow_status: workflowStatus,
      next_reviewer: nextReviewer,
      next_reviewer_role: nextReviewer,
      review_chain: reviewChain,
    });
  } catch (err) {
    if (![400, 422].includes(err?.response?.status)) throw err;
    await api.post("/appraisal/submit", basePayload);
  }
};

// Section rows → used by the review workflow to get section data from snapshot rows.
export const sectionRowsFromSnapshot = (snapshotPayload) => {
  const form = snapshotFormFromPayload(snapshotPayload);
  if (!form) return {};
  return form;
};

export const saveAppraisal = saveAppraisalDraftSection;
