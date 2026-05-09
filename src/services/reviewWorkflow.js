import { api } from "./api";
import { APP_INFO } from "../constants/formConfig";
import {
  canAuthorityReviewProfile,
  getSchoolKey,
  getReviewChain,
  isRejectedStatus,
  pendingStatusFor,
  profileFromsessionStorage,
  reviewedStatusFor,
  roleLabel,
  normalizeRoleForWorkflow,
} from "../utils/hierarchy";

const n = (value) => parseFloat(value) || 0;
const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const normalizeStatusText = (value) =>
  lower(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const firstValue = (...values) =>
  values.find((value) => clean(value) !== "") ?? "";

const numberValue = (...values) => n(firstValue(...values));

const initialsFor = (name, fallback = "U") =>
  String(name || fallback)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const roleColor = (role) =>
  role === "hod" || role === "center_head" ? "#f59e0b"
  : role === "director" ? "#3b82f6"
  : role === "dean" ? "#8b5cf6"
  : "#6366f1";

const getNested = (item, key) =>
  firstValue(
    item?.[key],
    item?.profile?.[key],
    item?.payload?.info?.[key],
    item?.form?.info?.[key],
    item?.info?.[key],
  );

const subjectProfileFromItem = (item = {}) => {
  const role = normalizeRoleForWorkflow(firstValue(
    item.appraisalRole,
    item.appraisal_role,
    item.role,
    item.profile?.appraisal_role,
    item.profile?.role,
    item.payload?.submittedByRole,
    item.form?.submittedByRole,
    item.info?.appraisalRole,
    item.info?.appraisal_role,
    item.info?.role,
  ));

  return {
    ...item,
    email: firstValue(item.email, item.faculty_email, item.facultyEmail, item.username),
    full_name: firstValue(item.name, item.full_name, item.fullName, item.profile?.full_name),
    appraisal_role: role,
    role,
    school: firstValue(
      item.school,
      item.school_name,
      item.schoolName,
      item.school_code,
      item.schoolCode,
      item.school_id,
      item.schoolId,
      getNested(item, "school"),
    ),
    department: firstValue(
      item.department,
      item.department_name,
      item.departmentName,
      item.department_code,
      item.departmentCode,
      getNested(item, "department"),
    ),
    designation: firstValue(item.designation, getNested(item, "designation")),
  };
};

const getWorkflowStatus = (item = {}) =>
  firstValue(
    item.status,
    item.workflowStatus,
    item.workflow_status,
    item.declarationStatus,
    item.declaration_status,
    item.declaration?.status,
  );

const hasReviewScore = (item = {}, role) => {
  if (role === "hod" || role === "center_head") {
    return numberValue(
      item.hodTotal,
      item.hod_total,
      item.hodScore,
      item.hod_score,
      item.centerHeadTotal,
      item.center_head_total,
      item.centerHeadScore,
      item.center_head_score,
    ) > 0 || Boolean(clean(firstValue(item.hodRemarks, item.hod_remarks, item.centerHeadRemarks, item.center_head_remarks)));
  }

  if (role === "director") {
    return numberValue(item.directorTotal, item.director_total, item.directorScore, item.director_score) > 0 ||
      Boolean(clean(firstValue(item.directorRemarks, item.director_remarks)));
  }

  if (role === "dean") {
    return numberValue(item.deanTotal, item.dean_total, item.deanScore, item.dean_score) > 0 ||
      Boolean(clean(firstValue(item.deanRemarks, item.dean_remarks)));
  }

  if (role === "vc") {
    return numberValue(item.vcTotal, item.vc_total, item.vcScore, item.vc_score) > 0 ||
      Boolean(clean(firstValue(item.vcRemarks, item.vc_remarks)));
  }

  return false;
};

const statusStageIndex = (item = {}, chain = []) => {
  const status = normalizeStatusText(getWorkflowStatus(item));
  if (!status) return null;
  if (status === "submitted" || status === "pending review") return 0;
  if (status === "reviewed" || status === "completed") {
    const scoreStages = chain
      .map((role, index) => hasReviewScore(item, role) ? index + 1 : -1)
      .filter((index) => index >= 0);
    return scoreStages.length ? Math.max(...scoreStages) : chain.length;
  }

  for (let index = 0; index < chain.length; index += 1) {
    const role = chain[index];
    const label = normalizeStatusText(roleLabel(role));
    if (status === normalizeStatusText(pendingStatusFor(role)) || status.includes(`pending ${label}`)) {
      return index;
    }
    if (
      status === normalizeStatusText(reviewedStatusFor(role)) ||
      status.includes(`${label} reviewed`) ||
      status.includes(`${label} approved`) ||
      (isRejectedStatus(status) && status.includes(label))
    ) {
      return index + 1;
    }
  }

  return status.includes("approved") ? chain.length : null;
};

const hasReachedReviewer = (item = {}, reviewerRole) => {
  const role = normalizeRoleForWorkflow(reviewerRole);
  const subjectProfile = subjectProfileFromItem(item);
  const chain = getReviewChain(subjectProfile);
  const reviewerIndex = chain.indexOf(role);

  if (reviewerIndex < 0) return false;

  const stageIndex = statusStageIndex(item, chain);
  if (stageIndex !== null) return stageIndex >= reviewerIndex;

  if (reviewerIndex === 0) return true;
  return chain.slice(0, reviewerIndex).every((previousRole) => hasReviewScore(item, previousRole));
};

const isReviewableForRole = (item = {}, reviewerRole, reviewerProfile = {}) => {
  const role = normalizeRoleForWorkflow(reviewerRole);
  const reviewer = { ...reviewerProfile, appraisal_role: role };
  const subjectProfile = subjectProfileFromItem(item);

  return canAuthorityReviewProfile(reviewer, subjectProfile) &&
    hasReachedReviewer(item, role);
};

const normalizeQueueItem = (item = {}) => {
  const subjectProfile = subjectProfileFromItem(item);
  const appraisalRole = subjectProfile.appraisal_role;
  const status = getWorkflowStatus(item) || pendingStatusFor(getReviewChain(subjectProfile)[0]);
  const email = subjectProfile.email;
  const academicYear = firstValue(item.academicYear, item.academic_year, item.info?.ay, APP_INFO.DEFAULT_AY, "2025-2026");
  const school = subjectProfile.school;

  return {
    ...item,
    id: firstValue(item.id, item.declaration_id, item.declarationId, `${email}:${academicYear}`),
    email,
    academicYear,
    academic_year: academicYear,
    name: firstValue(item.name, item.full_name, item.fullName, subjectProfile.full_name, email),
    appraisalRole,
    appraisal_role: appraisalRole,
    school,
    schoolCode: getSchoolKey(school),
    department: subjectProfile.department,
    designation: subjectProfile.designation,
    status,
    workflowStatus: status,
    avatar: initialsFor(firstValue(item.name, item.full_name, email), email),
    avatarColor: roleColor(appraisalRole),
    hodTotal: numberValue(item.hodTotal, item.hod_total, item.hodScore, item.hod_score, item.centerHeadTotal, item.center_head_total),
    hodPartA: numberValue(item.hodPartA, item.hod_part_a, item.hodPartAScore, item.hod_part_a_score, item.centerHeadPartA, item.center_head_part_a),
    hodPartB: numberValue(item.hodPartB, item.hod_part_b, item.hodPartBScore, item.hod_part_b_score, item.centerHeadPartB, item.center_head_part_b),
    hodRemarks: firstValue(item.hodRemarks, item.hod_remarks, item.centerHeadRemarks, item.center_head_remarks),
    directorTotal: numberValue(item.directorTotal, item.director_total, item.directorScore, item.director_score),
    directorPartA: numberValue(item.directorPartA, item.director_part_a, item.directorPartAScore, item.director_part_a_score),
    directorPartB: numberValue(item.directorPartB, item.director_part_b, item.directorPartBScore, item.director_part_b_score),
    directorRemarks: firstValue(item.directorRemarks, item.director_remarks),
    deanTotal: numberValue(item.deanTotal, item.dean_total, item.deanScore, item.dean_score),
    deanPartA: numberValue(item.deanPartA, item.dean_part_a, item.deanPartAScore, item.dean_part_a_score),
    deanPartB: numberValue(item.deanPartB, item.dean_part_b, item.deanPartBScore, item.dean_part_b_score),
    deanRemarks: firstValue(item.deanRemarks, item.dean_remarks),
    vcTotal: numberValue(item.vcTotal, item.vc_total, item.vcScore, item.vc_score),
    vcPartA: numberValue(item.vcPartA, item.vc_part_a, item.vcPartAScore, item.vc_part_a_score),
    vcPartB: numberValue(item.vcPartB, item.vc_part_b, item.vcPartBScore, item.vc_part_b_score),
    vcRemarks: firstValue(item.vcRemarks, item.vc_remarks),
  };
};

export const fetchReviewQueueForRole = async ({
  reviewerRole,
  reviewerProfile = profileFromsessionStorage(),
  academicYear,
  schoolValues = [],
} = {}) => {
  const role = normalizeRoleForWorkflow(reviewerRole || reviewerProfile.appraisal_role || reviewerProfile.role);
  if (!role || role === "faculty") return [];

  try {
    const params = {
      academic_year: academicYear || APP_INFO.DEFAULT_AY || "2025-2026",
      reviewer_role: role,
      pending_status: pendingStatusFor(role),
    };
    if (schoolValues?.length) params.schools = schoolValues.join(",");
    if (reviewerProfile?.school) params.reviewer_school = reviewerProfile.school;
    if (reviewerProfile?.department) params.reviewer_department = reviewerProfile.department;

    const items = await api.get("/dashboard/subordinates", { params });
    return (items || [])
      .map(normalizeQueueItem)
      .filter((item) => isReviewableForRole(item, role, reviewerProfile));
  } catch (err) {
    throw new Error(err?.message || "Could not load review queue.", { cause: err });
  }
};

const workflowForwardingFor = (role, subjectProfile = {}) => {
  const chain = getReviewChain(subjectProfile);
  const reviewerIndex = chain.indexOf(role);
  const fallbackNextReviewer = {
    hod: "director",
    center_head: "vc",
    director: "dean",
    dean: "vc",
  }[role] || "";
  const nextReviewer = reviewerIndex >= 0 ? chain[reviewerIndex + 1] : fallbackNextReviewer;
  const status = nextReviewer ? pendingStatusFor(nextReviewer) : reviewedStatusFor(role);

  return {
    status,
    workflow_status: status,
    review_status: reviewedStatusFor(role),
    next_reviewer: nextReviewer,
    next_reviewer_role: nextReviewer,
  };
};

export const submitWorkflowReview = async ({
  subjectEmail,
  academicYear,
  reviewerRole,
  partAScore = 0,
  partBScore = 0,
  totalScore = 0,
  remarks = "",
  sectionScores,
  subjectProfile,
}) => {
  const role = normalizeRoleForWorkflow(reviewerRole);

  const endpointMap = {
    hod: "hod",
    center_head: "center-head",
    director: "director",
    dean: "dean",
    vc: "final",
  };

  const endpoint = endpointMap[role];
  if (!endpoint) {
    throw new Error(`Unknown reviewer role: ${role}`);
  }

  const basePayload = {
    academic_year: academicYear,
    remarks,
    part_a_score: n(partAScore),
    part_b_score: n(partBScore),
    total_score: n(totalScore),
    section_scores: sectionScores || {},
  };
  const endpointUrl = `/appraisal-remarks/${endpoint}/${encodeURIComponent(subjectEmail)}`;
  const forwarding = workflowForwardingFor(role, subjectProfile || {});

  let result;
  try {
    result = await api.put(endpointUrl, { ...basePayload, ...forwarding });
  } catch (err) {
    if (![400, 422].includes(err?.response?.status)) throw err;
    result = await api.put(endpointUrl, basePayload);
  }

  return result || {};
};
