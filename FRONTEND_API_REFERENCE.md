# Frontend Developer API Reference - Faculty Appraisal System

## 1. Core Integration Concepts

### Authentication
- All protected endpoints require a **Bearer Token** in the `Authorization` header.
- The system extracts your `faculty_id`, `role`, `department`, and `school_id` directly from the **Supabase JWT**.
- **Security Rule:** Never try to pass `faculty_id` in a `POST` or `PUT` body. The backend ignores it and uses the ID from your token to prevent data tampering.

### Content Types
- **Standard Requests:** Use `Content-Type: application/json`.
- **File Uploads (PDFs):** All `POST` endpoints for Part A and Part B use `multipart/form-data`. You must send fields as individual form fields and the PDF as the `file` field.

---

## 2. Institutional Hierarchy (Access Rules)

| Role | Access Level | Horizontal Isolation |
| :--- | :--- | :--- |
| **Faculty** | Can only GET/POST/PUT their own records. | Isolated from all other faculties. |
| **HOD** | Can view/update scores for faculties in their **specific department**. | Cannot see faculties in other departments. |
| **Director** | Can view/update scores for everyone in their **specific school**. | Cannot see data from other schools. |
| **Dean** | Can view everyone within their **Division** (Engineering / Non-Eng). | Cannot see the other division. |
| **VC / Admin** | Global access across all 8 schools. | None. |

---

## 3. Key Endpoint Categories

### A. Part A (Common Tables - Type 1, 2, 3)
*Base Path: `/api/v1/part-a`*

| Endpoint | Fields | Meaning |
| :--- | :--- | :--- |
| `POST /teaching-process` | `semester`, `course_code_name`, `no_of_classes_planned`, `no_of_classes_conducted` | Standard teaching load data. |
| `POST /student-feedback` | `course_code_name`, `first_feedback`, `second_feedback` | Rating (0.0 - 5.0) given by students. |
| `GET /part-a-summary/{id}` | Returns `teachingScore`, `feedbackScore`, etc. | **Crucial:** Use this for the Faculty summary page. Scores are already scaled to max caps (e.g., 25, 85). |

### B. Part B (Research & Development)
*Base Path: `/api/v1/part-b`*

| Endpoint | Fields | Meaning |
| :--- | :--- | :--- |
| `POST /journal-publications` | `title_with_page_nos`, `journal_details`, `issn_isbn`, `indexing` | Research papers. `indexing` is an ENUM (Scopus, Web of Science, etc.). |
| `POST /research-projects` | `title`, `funding_agency`, `grant_amount`, `role` | `role` (e.g., PI, Co-PI). `grant_amount` is a Double. |

### C. Dashboard (For Authorities)
`GET /api/v1/dashboard/subordinates`
- **Data Returned:** List of subordinates.
- **Key Field:** `status` (e.g., `Pending`, `Submitted`, `HOD Approved`). 
- **Usage:** Use this to build the HOD/Director/Dean homepages to show who has finished their form.

---

## 4. Field Definitions & Data Types

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `sr_no` | Integer | Serial Number. Use this to order the rows in the UI list. |
| `api_score_faculty` | Double | The self-appraisal score entered by the Faculty. |
| `api_score_hod` | Double | The validation score entered by the HOD. (Read-only for Faculty). |
| `document` | String (URL) | A public URL to the PDF proof. If null, no proof was uploaded. |
| `department` | String | e.g., "Computer Science". Must match the user's metadata exactly. |

---

## 5. Form Type Logic (80/20 Split)
The frontend should check the user's `form_type` (returned during login or in metadata):

1.  **Type 1 (Standard):** Display all sections.
2.  **Type 2 (Media):** May have specific labels (e.g., "Creative Projects" instead of "Research Projects").
3.  **Type 3 (Arts):** May hide "Journal Publications" and show "Portfolio/Exhibition" instead.
*(Backend currently provides Type 1 tables for all; use nullable columns for unique data in Type 2/3).*

---

## 6. Success/Error Handling
- `201 Created`: Successfully saved.
- `200 OK`: Successful retrieval.
- `403 Forbidden`: User is trying to access data they don't own or don't have authority over. **UI Action:** Show "Access Denied" or redirect to home.
- `422 Unprocessable Entity`: Validation error (e.g., sent a string for a Double field). **UI Action:** Show specific field errors from the `detail` object.
