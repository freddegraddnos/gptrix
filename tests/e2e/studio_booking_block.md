# Negative tests — studio accounts cannot book with other studios

The on-screen block is presentation only. These checks prove the server rule.
Run with two temporary studios (A, B) and one temporary customer (C); delete all three afterwards.

| # | Signed in as | Action (call the server directly, not via UI) | Expected |
|---|---|---|---|
| 1 | Studio A | Submit booking request to B (`/B/book` request function) | Rejected by server |
| 2 | Studio A | Book an open slot of B | Rejected by server; slot stays open |
| 3 | Studio A | Propose a time on a B case | Rejected (not case customer) |
| 4 | Studio A | Read B's cases, sketches, files, calendar rows | Zero rows |
| 5 | Customer C | Submit booking request to B | Accepted |
| 6 | Signed out | Open `/B/book` | Neutral "Checking your account…" first, no form in server HTML |
| 7 | Studio A | Open `/B/book` | Waiting state, then studio notice — never the form |

Status: #6 verified (server HTML contains only the waiting state). #1–5 and #7 not run in this round.
