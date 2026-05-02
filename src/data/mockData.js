export const HOD_USER = {
  name: "Prof. Rajesh Kulkarni",
  employeeId: "EMP-2025-010",
  designation: "Professor & Head",
  department: "Computer Science & Engineering",
  school: "School of Engineering",
  ay: "2025-2026",
  avatar: "RK",
};

export const DIRECTOR_USER = {
  name: "Dr. Mehta",
  employeeId: "EMP-2025-030",
  designation: "Director",
  department: "Administration",
  school: "School of Engineering",
  ay: "2025-2026",
  avatar: "DM",
};

export const DEAN_USER = {
  name: "Prof. Suresh Patil",
  employeeId: "EMP-2025-020",
  designation: "Dean",
  department: "Engineering",
  school: "School of Engineering",
  ay: "2025-2026",
  avatar: "SP",
};

export const VC_USER = {
  name: "Prof. Anil Deshmukh",
  employeeId: "EMP-2025-000",
  designation: "Vice Chancellor",
  school: "University",
  ay: "2025-2026",
  avatar: "AD",
};

export const CREDENTIALS = {
  faculty: { password: "f1", role: "faculty",  school: "School of Engineering", department: "Computer Science & Engineering" },
  hod:     { password: "hod1", role: "hod",      school: "School of Engineering", department: "Computer Science & Engineering" },
  dean:    { password: "dean1", role: "dean",      school: "School of Engineering", department: "Engineering" },
  director:{ password: "dir1", role: "director",  school: "School of Engineering", department: "Administration" },
  vc:      { password: "vc1", role: "vc",        school: "University", department: "Management" },
};

export const FACULTY_LIST = [
  {
    id: 1, name: "Dr. Priya Sharma", employeeId: "EMP-2025-001",
    designation: "Assistant Professor", department: "Computer Science & Engineering", school: "School of Engineering",
    submittedOn: "2025-04-18", status: "Pending Review", avatar: "PS", avatarColor: "#6366f1",
    info: { name: "Dr. Priya Sharma", qual: "Ph.D", desig: "Assistant Professor", ay: "2025-2026" },
    lectures: [{ sem: "Sem I", code: "CS101", planned: "40", conducted: "40", score: "20", hod: "" }],
    courseFile: { score: "15" }, docs: {}
  },
  {
    id: 2, name: "Prof. Amit Verma", employeeId: "EMP-2025-002",
    designation: "Assistant Professor", department: "Management Studies", school: "School of Management",
    submittedOn: "2025-04-19", status: "Pending Review", avatar: "AV", avatarColor: "#10b981",
    info: { name: "Prof. Amit Verma", qual: "MBA", desig: "Assistant Professor", ay: "2025-2026" },
    lectures: [{ sem: "Sem I", code: "MGMT101", planned: "36", conducted: "35", score: "18", hod: "" }],
    courseFile: { score: "14" }, docs: {}
  },
  {
    id: 3, name: "Dr. Sunil Gupta", employeeId: "EMP-2025-003",
    designation: "Associate Professor", department: "Computer Science & Engineering", school: "School of Engineering",
    submittedOn: "2025-04-20", status: "Pending Review", avatar: "SG", avatarColor: "#f59e0b",
    info: { name: "Dr. Sunil Gupta", qual: "Ph.D", desig: "Associate Professor", ay: "2025-2026" },
    lectures: [], courseFile: {}, docs: {}
  }
];

export const HOD_LIST = [
  {
    id: 10, name: "Prof. Rajesh Kulkarni", employeeId: "EMP-2025-010",
    designation: "Professor & Head", department: "Computer Science & Engineering", school: "School of Engineering",
    submittedOn: "2025-04-20", status: "Pending Review", avatar: "RK", avatarColor: "#f59e0b",
    info: { name: "Prof. Rajesh Kulkarni", qual: "Ph.D", desig: "Professor", ay: "2025-2026" },
    lectures: [], courseFile: {}, docs: {}
  }
];

export const DIRECTOR_LIST = [
  {
    id: 30, name: "Dr. Mehta", employeeId: "EMP-2025-030",
    designation: "Director", department: "Administration", school: "School of Engineering",
    submittedOn: "2025-04-21", status: "Pending Review", avatar: "DM", avatarColor: "#3b82f6",
    info: { name: "Dr. Mehta", qual: "Ph.D", desig: "Director", ay: "2025-2026" },
    lectures: [], courseFile: {}, docs: {}
  }
];

export const DEAN_LIST = [
  {
    id: 20, name: "Prof. Suresh Patil", employeeId: "EMP-2025-020",
    designation: "Dean", department: "Engineering", school: "School of Engineering",
    submittedOn: "2025-04-22", status: "Pending Review", avatar: "SP", avatarColor: "#8b5cf6",
    info: { name: "Prof. Suresh Patil", qual: "Ph.D", desig: "Dean", ay: "2025-2026" },
    lectures: [], courseFile: {}, docs: {}
  }
];

export const HOD_LIST_DEAN = HOD_LIST;
export const FACULTY_LIST_DEAN = FACULTY_LIST;
export const DIRECTOR_LIST_VC = DIRECTOR_LIST;
export const HOD_LIST_VC = HOD_LIST;
export const FACULTY_LIST_VC = FACULTY_LIST;


export const DIRECTOR_SELF_DATA = {
  info: { name: "Dr. Mehta", qual: "Ph.D", desig: "Director", ay: "2025-2026" },
  lectures: [],
  courseFile: {},
  innovScore: "",
  projects: [],
  quals: [],
  feedback: [],
  deptActs: [],
  uniActs: [],
  society: [],
  industry: [],
  acr: [],
  journals: [],
  books: [],
  ict: [],
  research: [],
  patents: [],
  awards: [],
  confs: [],
  proposals: [],
  fdps: [],
  training: [],
  docs: {},
};

export const DEAN_SELF_DATA = {
  info: { name: "Prof. Suresh Patil", qual: "Ph.D", desig: "Dean", ay: "2025-2026" },
  lectures: [],
  courseFile: {},
  innovScore: "",
  projects: [],
  quals: [],
  feedback: [],
  deptActs: [],
  uniActs: [],
  society: [],
  industry: [],
  acr: [],
  journals: [],
  books: [],
  ict: [],
  research: [],
  patents: [],
  awards: [],
  confs: [],
  proposals: [],
  fdps: [],
  training: [],
  docs: {},
};
