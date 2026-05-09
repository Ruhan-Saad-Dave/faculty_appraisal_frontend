# Frontend API Reference

Backend base URL (production): set in your `.env` as `REACT_APP_API_URL` or equivalent.  
All endpoints are under `/api/v1/`.  
Swagger UI (dev only): `http://localhost:8000/docs`

---

## Auth

Every protected endpoint requires:
```
Authorization: Bearer <token>
```
The token comes from the login response and never expires on the server — store it in `localStorage` or equivalent and send it with every request.

---

### POST `/api/v1/auth/login`

```json
// Request
{ "email": "user@example.com", "password": "secret" }

// Response 200
{
  "token": "<jwt>",
  "profile": {
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "appraisal_role": "faculty",
    "department": "Computer Science",
    "school": "SoCSEA",
    "employee_id": "EMP001",
    "designation": "Assistant Professor",
    "phone": "9876543210",
    "profile_picture_url": null
  }
}
```

Error 401 — wrong credentials.  
Error 403 — account not yet verified (user must click the email link).

---

### POST `/api/v1/auth/register`

```json
// Request
{
  "email": "user@example.com",
  "password": "secret",
  "full_name": "Jane Doe",
  "appraisal_role": "faculty",
  "school": "SoCSEA",
  "department": "Computer Science",
  "designation": "Assistant Professor",
  "employee_id": "EMP001",
  "phone": "9876543210",
  "qualification": "M.Tech",
  "teaching_experience": "5 years"
}

// Response 200
{ "message": "Registration successful. Please check your email to verify your account.", "email": "user@example.com" }
```

Newly registered users **cannot log in** until they click the verification link sent to their email. `is_verified` starts as `false`.

---

### GET `/api/v1/auth/verify-email?token=<token>`

Called automatically when the user clicks the link in their email. Redirects to `<FRONTEND_URL>/login?verified=true` on success.

---

### GET `/api/v1/auth/me` — requires auth

Returns the same profile object as login.

---

### PUT `/api/v1/auth/me` — requires auth

```json
// Request (all fields optional)
{ "full_name": "Jane Doe", "phone": "9876543210", "designation": "Professor" }

// Response: updated profile object (same shape as login profile)
```

---

### POST `/api/v1/auth/change-password` — requires auth

```json
// Request
{ "current_password": "old", "new_password": "new" }

// Response 200
{ "message": "Password changed successfully" }
```

Error 400 — incorrect current password.

---

## Appraisal Form (teaching staff)

---

### GET `/api/v1/appraisal/snapshot?academic_year=2025-26` — requires auth

Returns the faculty's saved draft/submitted form payload, or `null` if none exists yet.

---

### PUT `/api/v1/appraisal/snapshot` — requires auth

Save a draft. Call this on auto-save. Safe to call many times.

```json
// Request
{
  "academic_year": "2025-26",
  "payload": { /* full form JSON */ }
}

// Response 200
{ "message": "Snapshot saved" }
```

---

### POST `/api/v1/appraisal/submit` — requires auth

Final submission. Shreds the form into normalized DB tables and locks status as `Submitted`.  
If the admin has closed submissions for this year, returns **403** with `user_message` like _"Appraisal submissions for 2025-26 are currently closed."_

```json
// Request — same shape as snapshot payload but with totals
{
  "academic_year": "2025-26",
  "form": { /* full form sections */ },
  "totals": {
    "partATotal": 45.5,
    "partBTotal": 30.0,
    "grandTotal": 75.5
  }
}

// Response 200
{ "message": "Submitted successfully", "submitted_at": "2025-06-01T10:00:00" }
```

---

### GET `/api/v1/appraisal/status?academic_year=2025-26` — requires auth

Returns the declaration record and any reviews received so far for the logged-in faculty.

```json
// Response
{
  "declaration": {
    "faculty_email": "...",
    "academic_year": "2025-26",
    "part_a_total": 45.5,
    "part_b_total": 30.0,
    "grand_total": 75.5,
    "status": "Pending HOD Review",
    "submitted_at": "2025-06-01T10:00:00"
  },
  "reviews": [
    {
      "reviewer_role": "hod",
      "part_a_score": 42.0,
      "part_b_score": 28.0,
      "total_score": 70.0,
      "remarks": "Good performance",
      "status": "Pending Director Review"
    }
  ]
}
```

---

## Dashboard (reviewer roles only)

Reviewers are: `hod`, `director`, `dean`, `vc`, `registrar`.  
Faculty and non-teaching staff receive an empty array from this endpoint.

---

### GET `/api/v1/dashboard/subordinates?academic_year=2025-26` — requires auth

Returns all faculty visible to the logged-in reviewer for the given year.

```json
// Response — array of:
{
  "email": "faculty@example.com",
  "name": "Jane Doe",
  "department": "Computer Science",
  "school": "SoCSEA",
  "appraisalRole": "faculty",
  "status": "Submitted",            // "pending" if not submitted yet
  "submittedOn": "2025-06-01",
  "selfPartA": 45.5,
  "selfPartB": 30.0,
  "selfTotal": 75.5,
  "hodTotal": 70.0,                 // present only if HOD has reviewed
  "hodRemarks": "Good performance",
  "directorTotal": 68.0,            // present only if Director has reviewed
  ...
}
```

VC/Registrar can optionally pass `?schools=SoCSEA,SoBB` to filter by school.

---

### GET `/api/v1/dashboard/faculty/{email}?academic_year=2025-26` — requires auth

Returns the full form snapshot of a specific faculty member.  
The logged-in user must have authority over that faculty member — otherwise **403**.

---

## Review submission (reviewer roles)

All review endpoints follow the same request/response shape.

```json
// Request body (sent by the reviewer)
{
  "academic_year": "2025-26",
  "section_scores": { /* per-section scores keyed by section code */ },
  "totals": {
    "partATotal": 42.0,
    "partBTotal": 28.0,
    "grandTotal": 70.0
  },
  "remarks": "Good performance"
}

// Response 200
{ "message": "Review submitted", "status": "Pending Director Review" }
```

| Endpoint | Who can call |
|---|---|
| `PUT /api/v1/appraisal-remarks/hod/{email}` | `hod` |
| `PUT /api/v1/appraisal-remarks/center-head/{email}` | `center_head` (CISR only) |
| `PUT /api/v1/appraisal-remarks/director/{email}` | `director` |
| `PUT /api/v1/appraisal-remarks/dean/{email}` | `dean` |
| `PUT /api/v1/appraisal-remarks/final/{email}` | `vc` |

`{email}` is the faculty member being reviewed.

---

## Non-teaching staff appraisal

Non-teaching staff (`appraisal_role = "non_teaching_staff"`) use a separate, simpler form.

### GET `/api/v1/nt/appraisal?academic_year=2025-26` — requires auth

Returns the staff member's non-teaching appraisal record, or `null`.

### PUT `/api/v1/nt/appraisal` — requires auth

Create or update the non-teaching appraisal.

### GET `/api/v1/nt/subordinates?academic_year=2025-26` — requires auth

For `reporting_officer` / `registrar` / `vc`: list non-teaching staff with their submission status.

### PUT `/api/v1/nt/review/{email}` — requires auth

Submit a review for a non-teaching staff member.

---

## Documents

### GET `/api/v1/appraisal-documents/?academic_year=2025-26` — requires auth

Returns all uploaded supporting documents for the logged-in faculty for that year.

```json
// Response — array of:
{
  "faculty_email": "...",
  "academic_year": "2025-26",
  "section": "B2",
  "file_name": "certificate.pdf",
  "file_url": "https://storage.googleapis.com/...",
  "uploaded_at": "2025-05-15T12:00:00"
}
```

---

## File upload

### POST `/api/v1/upload` — requires auth — multipart/form-data

Upload a supporting document. Returns a URL to store with the form data.

```
// Form field: file (the binary)

// Response 200
{
  "url": "https://storage.googleapis.com/.../filename.pdf",
  "publicId": "faculty/uploads/<uuid>_filename.pdf",
  "name": "filename.pdf",
  "type": "application/pdf"
}
```

---

## Announcements

### GET `/api/v1/announcements` — **no auth required**

Returns all active announcements. Show these on the login page and dashboard.

```json
// Response — array of:
{
  "id": 1,
  "title": "Appraisal cycle 2025-26 is now open",
  "body": "All faculty must submit by 30 June 2025.",
  "created_at": "2025-05-01T09:00:00"
}
```

---

## Error format

Every error response from the backend has two fields:

```json
{
  "user_message": "Invalid email or password.",
  "detail": "..."
}
```

**Always show `user_message` in the UI.** The `detail` field is for the network tab / bug reports only — never render it to users.

```js
try {
  const res = await fetch('/api/v1/auth/login', { ... })
  if (!res.ok) {
    const err = await res.json()
    showToast(err.user_message)   // ← always use this field
    return
  }
  // ...
} catch (e) { ... }
```

---

## Role reference

| Role | Can do |
|---|---|
| `faculty` | Submit own appraisal |
| `non_teaching_staff` | Submit non-teaching appraisal |
| `hod` | Review faculty in own department |
| `director` | Review all faculty in own school |
| `center_head` | Review CISR faculty (equivalent to director) |
| `dean` | Review all faculty in their division (engineering / non-engineering) |
| `registrar` | Review non-teaching staff; view all schools |
| `vc` | Final review for all teaching staff; view all schools |

## School codes

`SoCSEA` · `SoBB` · `SoCE` · `SoEMR` · `SoC` · `CISR` · `SoMCS` · `CioD` · `SoAA`

Engineering division: `SoCSEA`, `SoBB`, `SoCE`, `SoEMR`  
Non-engineering division: `SoC`, `SoMCS`, `CioD`, `SoAA`  
Standalone: `CISR` (reviewed by `center_head`, then `vc`)
