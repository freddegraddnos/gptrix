# Available artist designs

Implemented against the existing marketplace; existing digital sales, commissions, image handling, terms and owner policies remain in place.

- Migration `0060_tattoo_offer_availability.sql` adds nullable availability, repeatability, size estimate and tattoo price indication. Legacy rows remain unclassified, never automatically advertised as available originals.
- `/shop/new` can explicitly describe a design the artist wants to tattoo. The artist chooses unique/repeatable/adaptable; price and size are optional. Existing placement fields are reused. Digital terms can also be entered for a free preview.
- The owner can change availability on the existing detail page. Failed persistence keeps their values and reports failure; success requires an updated row returned by Supabase.
- `/shop` offers an available-only filter only when matching content exists, and cards/detail show real availability. Reserved or tattooed work offers a question about similar work, not a new claim of availability.
- Digital file purchase and tattoo enquiries have separate labels. An enquiry never writes motif status, changes usage rights, reserves the design or confirms an appointment.
- The existing authenticated intake snapshots availability, repeatability and estimates alongside motif identity and terms; later artist edits do not alter what was received.

Verification: five Vitest rules passed; the authenticated request test includes immutable availability snapshot/no reservation (six handler tests passed); eight disposable PostgreSQL checks passed (defaults, validation, owner update, nonowner denial and preserved digital price/terms). TypeScript and targeted ESLint without the pre-existing repository-wide formatting rule passed.

Migration has NOT been applied to a real service. Integration against deployed Supabase policies/storage and actual studio authentication remains required. This adds no automated reservation operation or payment action. The artist explicitly manages availability and remains responsible for coordinating existing obligations. Three-dimensional projects remain separate from this flat-image catalogue.

Rollback: revert the feature code; the new nullable columns can remain without changing the old flow. Do not drop columns after they contain user-entered metadata without a backup. No old rows, rights, originals or history were rewritten.
