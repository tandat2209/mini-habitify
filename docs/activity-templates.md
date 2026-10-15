# Activity templates

Trackers keep their existing progress configuration. An activity template adds optional structured content to each check-in, without changing completion, quantities, durations, goals, or calendar calculations.

## Use a template

1. Open **Templates** on Today.
2. Enter a template name, add fields, choose their types/options, and preview the form. Choose **Create template** to save.
3. Select it under **Activity template** when creating or editing a tracker. The same template can be reused on multiple trackers in your account.
4. Record progress as usual. Use **Add details** for structured content, or add details in history.
5. View and edit details in the tracker history dialog or full history page.

A progress-only check-in always works with `{}` details. If you submit any details, fields marked `required` must be present. Empty optional controls are omitted. To remove all content, use **Clear details** in history and save.

The visual builder is the normal authoring experience. Add text, numbers, dates, single/multiple choices, or lists. Label each field, mark it required when adding details if needed, and use the up/down buttons to change order. Field identifiers are automatic and remain stable when labels change.

The desktop builder shows a live check-in preview beside the editor. Mobile provides **Build form** and **Preview form** views. Preview values are local and never saved as check-ins. Saving is explicit; closing the builder discards unsaved edits.

To edit, select an existing template and choose **Save changes**. A new version is created automatically; you do not need to manage version numbers. Changes apply to future check-ins, and previous entries stay unchanged.

**Advanced JSON** is collapsed by default. Use **Load current definition** to copy the current fields as JSON, or paste a definition and choose **Import JSON** to replace the visual draft. Invalid imports leave the current draft unchanged. Advanced metadata and original field keys are retained when existing/imported fields are edited visually.

## Definition example

```json
{
  "name": "Session notes",
  "description": "Record what you did",
  "fields": [
    { "key": "summary", "label": "Summary", "type": "text", "required": true },
    { "key": "rating", "label": "Rating", "type": "number" },
    { "key": "reference_date", "label": "Reference date", "type": "date" },
    { "key": "mode", "label": "Mode", "type": "select", "options": ["Solo", "Together"] },
    { "key": "tags", "label": "Tags", "type": "multi_select", "options": ["New", "Review"] },
    { "key": "items", "label": "Items", "type": "list" }
  ]
}
```

Field keys are stable lowercase identifiers starting with a letter, followed by letters, numbers, or underscores, up to 64 characters. Keys must be unique; `constructor`, `prototype`, and `__proto__` are reserved. `semanticType` is optional metadata and does not affect metrics. Unknown definition properties and unsupported field types are rejected.

Templates support 1–30 fields. Text values allow up to 5,000 characters, numbers are finite and between −10¹² and 10¹², dates use valid `YYYY-MM-DD` calendar dates, selection fields have 1–50 unique options, and lists hold 1–100 nonblank strings of at most 500 characters each. Multi-select values must be unique listed options. Option values retain their exact spelling and whitespace. Nested objects and `object_list` are deferred.

## Version behavior

Publishing an existing template creates an immutable version. New check-ins use the current version. Historical entries retain their recorded version and remain editable with that version's field labels, types, and options.

Changing or removing a tracker's template affects future entries only. Legacy entries remain template-free when edited. Archiving retains all history and continues to prevent new/edited entries. Phase 1 has no template deletion UI.

Submitting a details form whose version changed before saving produces an error asking you to review the current fields. Progress-only saves resolve the current template inside the database transaction. Repeated check-in requests return the existing entry without overwriting content; edits are explicit.

## Persistence and compatibility

- `activity_templates`: private reusable template identity and current-version reference.
- `activity_template_versions`: immutable field definitions in JSONB.
- `trackers.activity_template_id`: nullable association.
- `tracker_logs.details`: JSONB object defaulting to `{}`.
- `tracker_logs.template_version_id`: nullable immutable historical reference.

Next.js server actions validate content against the applicable version. Database triggers enforce content types, keys, version association, and historical reference immutability on direct Supabase writes. RLS and ownership-aware foreign keys isolate templates, versions, trackers, and logs.

The original four-argument `record_log` RPC remains available. Its progress-only records receive the current version when applicable. `record_log_with_details` adds content and returns the saved entry ID. Existing server-action callers can omit details; update callers that omit details preserve saved content, while explicit `{}` clears it.

Apply migrations with `npx supabase migration up --local`; do not reset a database containing user data. `npm run test:migrations` creates and removes a separate disposable PostgreSQL database in the local Supabase container. It replays all app migrations, creates a log before the template migrations, verifies that its original columns remain unchanged, and checks the legacy RPC and edit path. Its minimal auth schema provides migration context; separate security tests use real Supabase authentication.

## Follow-up

Phase 2: reusable subjects, optional subject selection/creation, metadata, and subject-based history grouping. Phase 3: repeatable object fields, content insights, and advanced features only when requested.
