# Dashboards

Dashboards are role-specific pages that provide the primary interface for users. They are located in `src/pages/`.

## Dashboard Structure

Most dashboards follow a similar pattern:
1.  **Header**: App branding and user profile summary.
2.  **Stats/Summary Cards**: High-level overview of the appraisal status or review queue.
3.  **Action Area**:
    - For Faculty: The appraisal form itself (broken into sections).
    - For Reviewers: A list (queue) of subordinates awaiting review.
4.  **Workflow View**: The `WorkflowTimeline` or `ApprovalHistoryTable`.

## Key Dashboard Pages

### `Dashboard.jsx` (Faculty)
The main entry point for faculty members. It handles:
- Progress tracking across different form sections (Part A and Part B).
- Saving drafts and final submission.
- Displaying reviewer feedback upon rejection or completion.

### `RoleDashboard.jsx` (The Switch)
As documented in [Architecture](./2_Architecture.md), this is the router that lazily loads the correct dashboard based on the user's role.

### `HODDashboard.jsx` / `DeanDashboard.jsx` / `DirectorDashboard.jsx`
Reviewer-focused dashboards. Their main logic includes:
- Fetching the review queue via `fetchReviewQueueForRole`.
- Opening a subordinate's appraisal for scoring and remarks.
- Submitting the review, which advances the workflow to the next level.

### `VCDashboard.jsx`
The final level of review. It provides a university-wide view and the ability to finalize any appraisal.

### `NonTeachingStaffDashboard.jsx`
A specialized dashboard for non-teaching staff, using a simplified workflow and a different form structure (Managed via `nonTeachingWorkflow.js`).

## Lazy Loading & Chunks

Dashboards are imported using `React.lazy()` to ensure that a faculty member doesn't download the code for the VC dashboard, and vice versa. This significantly improves initial load times.
