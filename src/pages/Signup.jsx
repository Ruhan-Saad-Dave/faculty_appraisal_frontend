import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { APP_INFO } from "../constants/formConfig";
import {
  SCHOOL_OPTIONS,
  SOEMR_DEPARTMENTS,
  canonicalDepartmentValue,
  canonicalSchoolValue,
  isSoemrSchool,
  isValidSchool,
  isValidSoemrDepartment,
} from "../constants/universityHierarchy";
import { supabase } from "../services/supabase";
import { buildProfilePayload, storeUserSession } from "../auth/session";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "faculty",
    employeeId: "",
    designation: "Assistant Professor",
    department: "",
    school: "",
    qualification: "",
    experience: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedSchool = canonicalSchoolValue(formData.school);
  const needsDepartment = isSoemrSchool(selectedSchool);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "school") {
        return {
          ...prev,
          school: value,
          department: isSoemrSchool(value) ? prev.department : "",
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const school = canonicalSchoolValue(formData.school);
    const department = canonicalDepartmentValue(formData.department);

    if (!formData.name || !formData.email || !formData.password || !formData.employeeId || !school) {
      setError("Please fill in all required fields (Name, Email, Password, Employee ID, School).");
      return;
    }

    if (!isValidSchool(formData.school)) {
      setError("Please select one of the 8 approved schools from the dropdown.");
      return;
    }

    if (isSoemrSchool(school) && (!department || !isValidSoemrDepartment(department))) {
      setError("Please select the correct SoEMR department from the dropdown.");
      return;
    }

    if (formData.role === "hod" && !isSoemrSchool(school)) {
      setError("HOD accounts are allowed only for SoEMR departments in this hierarchy.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cleanFormData = {
        ...formData,
        school,
        department: isSoemrSchool(school) ? department : "",
      };

      const { data, error: authError } = await supabase.auth.signUp({
        email: cleanFormData.email.trim(),
        password: formData.password,
        options: {
          data: {
            name: cleanFormData.name,
            role: cleanFormData.role,
            employeeId: cleanFormData.employeeId,
            designation: cleanFormData.designation,
            department: cleanFormData.department,
            school: cleanFormData.school,
            qualification: cleanFormData.qualification,
            experience: cleanFormData.experience,
            phone: cleanFormData.phone,
          }
        }
      });

      if (authError) throw authError;

      const profilePayload = buildProfilePayload(cleanFormData, APP_INFO.DEFAULT_AY);
      const { data: profile, error: profileError } = await supabase
        .from("faculty_profiles")
        .upsert(profilePayload, { onConflict: "email" })
        .select()
        .single();

      if (profileError) throw profileError;

      storeUserSession({
        session: data?.session,
        user: data?.user,
        profile,
        fallbackEmail: cleanFormData.email,
      });

      navigate("/profile");

    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>

        {/* ── LEFT: Branding ── */}
        <div style={s.left}>
          <div style={s.logoBox}>
            <img src="/dypiu.jpeg" alt="University Logo" style={{ height: 60 }} />
          </div>
          <h2 style={s.heading}>{APP_INFO.UNIVERSITY_NAME}, {APP_INFO.UNIVERSITY_LOCATION}</h2>
          <p style={s.desc}>
            Join the {APP_INFO.PORTAL_NAME} platform. Create your account to submit and manage your appraisals efficiently.
          </p>
        </div>

        {/* ── RIGHT: Signup form ── */}
        <div style={s.right}>
          <div style={s.formWrap}>
            <h3 style={s.welcome}>Create Account</h3>
            <p style={s.sub}>Fill in your details to get started</p>

            {error && <div style={s.error}>{error}</div>}

            <form onSubmit={handleSignup} style={s.formGrid}>
              <div style={s.inputGroup}>
                <label style={s.label}>Full Name *</label>
                <input style={s.input} type="text" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div style={s.inputGroup}>
                <label style={s.label}>Email Address *</label>
                <input style={s.input} type="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>
              <div style={s.inputGroup}>
                <label style={s.label}>Password *</label>
                <input style={s.input} type="password" name="password" value={formData.password} onChange={handleChange} required />
              </div>
              <div style={s.inputGroup}>
                <label style={s.label}>Employee ID *</label>
                <input style={s.input} type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} required />
              </div>

              <div style={s.inputGroup}>
                <label style={s.label}>Role</label>
                <select style={s.input} name="role" value={formData.role} onChange={handleChange}>
                  <option value="faculty">Faculty</option>
                  <option value="hod">HOD</option>
                  <option value="dean">Dean</option>
                  <option value="director">Director</option>
                  <option value="vc">Vice Chancellor</option>
                </select>
              </div>
              
              <div style={s.inputGroup}>
                <label style={s.label}>School *</label>
                <select style={s.input} name="school" value={formData.school} onChange={handleChange} required>
                  <option value="">Select school</option>
                  {SCHOOL_OPTIONS.map((school) => (
                    <option key={school.value} value={school.value}>{school.label}</option>
                  ))}
                </select>
              </div>

              {needsDepartment && (
                <div style={s.inputGroup}>
                  <label style={s.label}>SoEMR Department *</label>
                  <select style={s.input} name="department" value={formData.department} onChange={handleChange} required>
                    <option value="">Select department</option>
                    {SOEMR_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={s.inputGroup}>
                <label style={s.label}>Designation</label>
                <input style={s.input} type="text" name="designation" placeholder="e.g. Assistant Professor" value={formData.designation} onChange={handleChange} />
              </div>

              <div style={s.inputGroup}>
                <label style={s.label}>Qualification</label>
                <input style={s.input} type="text" name="qualification" placeholder="e.g. Ph.D, M.Tech" value={formData.qualification} onChange={handleChange} />
              </div>

              <div style={s.inputGroup}>
                <label style={s.label}>Experience (Years)</label>
                <input style={s.input} type="text" name="experience" placeholder="e.g. 10 Years" value={formData.experience} onChange={handleChange} />
              </div>

              <div style={{ ...s.inputGroup, gridColumn: "1 / -1" }}>
                <label style={s.label}>Phone Number</label>
                <input style={s.input} type="text" name="phone" placeholder="e.g. +91 98765 43210" value={formData.phone} onChange={handleChange} />
              </div>

              <button
                type="submit"
                style={{ ...s.btn, opacity: loading ? 0.7 : 1, gridColumn: "1 / -1", marginTop: 10 }}
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Sign Up →"}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
              Already have an account? <Link to="/login" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 700 }}>Log in</Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Styles ───
const s = {
  wrap: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #dbeafe 0%, #e2e8f0 55%, #f8fafc 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    background: "rgba(15, 23, 42, 0.94)",
    borderRadius: 14,
    display: "flex",
    width: "100%",
    maxWidth: 920,
    overflow: "hidden",
    boxShadow: "0 22px 56px rgba(15,23,42,0.28)",
  },
  left: {
    flex: 1,
    padding: "40px 36px",
    color: "white",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  logoBox: {
    background: "white",
    borderRadius: 6,
    padding: "10px 14px",
    display: "inline-block",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  heading: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.25,
    fontWeight: 800,
    letterSpacing: -0.5,
    fontFamily: "Georgia, serif",
  },
  desc: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.6,
  },
  right: {
    flex: 1.4,
    background: "#0f172a",
    padding: "40px 50px",
    display: "flex",
    alignItems: "center",
    position: "relative",
  },
  formWrap: {
    width: "100%",
    maxWidth: 440,
    margin: "0 auto",
  },
  welcome: {
    margin: 0,
    color: "white",
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  sub: {
    margin: "4px 0 28px",
    color: "#94a3b8",
    fontSize: 14,
  },
  error: {
    background: "#7f1d1d",
    color: "#fecaca",
    padding: "10px 14px",
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 20,
    border: "1px solid #991b1b",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px 16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    display: "block",
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "white",
    outline: "none",
    transition: "border 0.2s, background 0.2s",
  },
  btn: {
    width: "100%",
    background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "13px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(14,165,233,0.3)",
    transition: "transform 0.1s, box-shadow 0.2s",
  },
};
