import { FACULTY_LIST, HOD_LIST, DIRECTOR_LIST, DEAN_LIST } from "../data/mockData";
import { SCHOOL_CONFIG } from "../constants/formConfig";

export const getFacultyForHOD = (hodDepartment, hodSchool) => {
  return FACULTY_LIST.filter(f => f.department === hodDepartment && f.school === hodSchool);
};

export const getStaffForDirector = (directorSchool) => {
  const hasHod = SCHOOL_CONFIG[directorSchool]?.hasHod ?? true;
  const faculty = FACULTY_LIST.filter(f => f.school === directorSchool);
  
  // If school has no HOD, director sees faculty pending approval directly
  // Otherwise, director might only see them after HOD review (or all of them)
  // For now, let's return all faculty and HODs in that school
  const hods = HOD_LIST.filter(h => h.school === directorSchool);
  
  return { faculty, hods: hasHod ? hods : [] };
};

export const getStaffForDean = (deanSchool) => {
  const faculty = FACULTY_LIST.filter(f => f.school === deanSchool);
  const hods = HOD_LIST.filter(h => h.school === deanSchool);
  const directors = DIRECTOR_LIST.filter(d => d.school === deanSchool);
  
  return { faculty, hods, directors };
};

export const getStaffForVC = () => {
  return {
    faculty: FACULTY_LIST,
    hods: HOD_LIST,
    directors: DIRECTOR_LIST,
    deans: DEAN_LIST
  };
};

export const fetchFormData = async () => {
  return JSON.parse(localStorage.getItem("formData")) || {};
};

export const saveFormData = async (data) => {
  localStorage.setItem("formData", JSON.stringify(data));
};