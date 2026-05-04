import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { APP_INFO } from "../constants/formConfig";
import { CREDENTIALS } from "../data/mockData";
import { supabase } from "../services/supabase";
import { buildProfilePayload, normalizeRole, storeUserSession } from "../auth/session";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(""); // This will be treated as email for Supabase
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [message, setMessage]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const email = username.trim().toLowerCase();

      // 1. Attempt Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: password,
      });

      if (!authError && data?.user) {
        console.log("Supabase login successful:", data.user);

        const { data: profile, error: profileError } = await supabase
          .from("faculty_profiles")
          .select("*")
          .eq("email", data.user.email || email)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        let activeProfile = profile;

        if (!activeProfile) {
          const metadata = data.user.user_metadata || {};
          const fallbackProfile = buildProfilePayload({
            email: data.user.email || email,
            employeeId: metadata.employeeId || metadata.employee_id || "",
            name: metadata.name || metadata.full_name || data.user.email || email,
            qualification: metadata.qualification || "",
            designation: metadata.designation || "",
            department: metadata.department || "",
            school: metadata.school || "",
            experience: metadata.experience || metadata.teaching_experience || "",
            phone: metadata.phone || "",
            role: normalizeRole(metadata.role),
          }, APP_INFO.DEFAULT_AY);

          const { data: createdProfile, error: createProfileError } = await supabase
            .from("faculty_profiles")
            .upsert(fallbackProfile, { onConflict: "email" })
            .select()
            .single();

          if (createProfileError) {
            console.warn("Could not create missing faculty profile:", createProfileError.message);
          } else {
            activeProfile = createdProfile;
          }
        }

        storeUserSession({
          session: data.session,
          user: data.user,
          profile: activeProfile,
          fallbackEmail: email,
        });

        navigate("/dashboard", { replace: true });
        return;
      }

      // 2. Fallback to Mock Data (useful during development/migration)
      console.warn("Supabase auth failed, trying mock fallback...", authError?.message);
      const cred = CREDENTIALS[email];

      if (cred && cred.password === password) {
        storeUserSession({
          profile: {
            email,
            full_name: cred.name || email,
            appraisal_role: cred.role,
            school: cred.school,
            department: cred.department,
            designation: cred.designation,
            employee_id: cred.employeeId,
          },
          fallbackEmail: email,
        });

        navigate("/dashboard", { replace: true });
      } else {
        setError(authError?.message || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const handleForgotPassword = async () => {
    const email = username.trim();

    if (!email) {
      setError("Please enter your email above, then click Forgot password.");
      setMessage("");
      return;
    }

    setResetLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage("Password reset link sent. Please check your email.");
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Unable to send reset link. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>

        {/* ── LEFT: Branding ───────────────────────────────────────────────── */}
        <div style={s.left}>
          <div style={s.logoBox}>
            <img src="/dypiu.jpeg" alt="University Logo" style={{ height: 60 }} />
          </div>
          <h2 style={s.heading}>{APP_INFO.UNIVERSITY_NAME}, {APP_INFO.UNIVERSITY_LOCATION}</h2>
          <p style={s.desc}>
            To create a vibrant learning environment – fostering innovation and creativity,
            experiential learning, which is inspired by research, and focuses on regionally,
            nationally and globally relevant areas.
          </p>

        </div>

        {/* ── RIGHT: Login form ────────────────────────────────────────────── */}
        <div style={s.right}>
          <div style={s.formWrap}>
            <h3 style={s.welcome}>{APP_INFO.PORTAL_NAME}</h3>
            <p style={s.sub}>Sign in to continue</p>

            {error && <div style={s.error}>{error}</div>}
            {message && <div style={s.success}>{message}</div>}

            {/* Username */}
            <label style={s.label}>Username</label>
            <input
              style={s.input}
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="username"
            />

            {/* Password */}
            <label style={s.label}>Password</label>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input
                style={{ ...s.input, marginBottom: 0, paddingRight: 44 }}
                type={showPw ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />
              <button
                style={s.eyeBtn}
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>

            {/* Submit */}
            <button
              style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <span style={s.spinner}>◌ Signing in…</span>
              ) : (
                "Sign In →"
              )}
            </button>

            <button
              type="button"
              style={{ ...s.forgot, opacity: resetLoading ? 0.7 : 1 }}
              onClick={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? "Sending reset link..." : "Forgot password?"}
            </button>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
              Don't have an account? <Link to="/signup" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 700 }}>Sign up</Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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

  // LEFT
  left: {
    flex: 1.3,
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
    width: "fit-content",
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: "#f1f5f9",
    lineHeight: 1.4,
    margin: 0,
  },
  desc: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.7,
    margin: 0,
  },
  hint: {
    marginTop: "auto",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "12px 14px",
  },
  hintTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  hintRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 12,
  },
  hintUser: { color: "#e2e8f0", fontFamily: "monospace" },
  hintRole: { color: "#64748b" },
  hintPwd: { fontSize: 10, color: "#475569", marginTop: 6 },

  // RIGHT
  right: {
    flex: 1,
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
  },
  formWrap: {
    padding: "40px 36px",
    width: "100%",
  },
  welcome: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "0 0 4px",
  },
  sub: {
    fontSize: 12,
    color: "#64748b",
    margin: "0 0 24px",
  },

  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 7,
    fontSize: 13,
    color: "#f1f5f9",
    marginBottom: 16,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
    padding: 4,
  },
  btn: {
    width: "100%",
    padding: "12px 14px",
    background: "#1a6fe0",
    color: "white",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.3,
    fontFamily: "inherit",
    transition: "opacity 0.2s",
    marginBottom: 12,
  },
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },
  forgot: {
    background: "none",
    border: "none",
    display: "block",
    width: "100%",
    fontFamily: "inherit",
    fontSize: 12,
    color: "#64748b",
    textAlign: "right",
    cursor: "pointer",
    textDecoration: "underline",
    marginBottom: 20,
  },
  error: {
    background: "rgba(220,50,50,0.18)",
    border: "1px solid rgba(220,50,50,0.4)",
    color: "#fca5a5",
    padding: "9px 12px",
    borderRadius: 5,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 1.5,
  },
  success: {
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.35)",
    color: "#86efac",
    padding: "9px 12px",
    borderRadius: 5,
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 1.5,
  },

  roleLegend: {
    display: "flex", gap: 6, flexWrap: "wrap",
  },
  rolePill: {
    fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, letterSpacing: 0.5,
  },
};
