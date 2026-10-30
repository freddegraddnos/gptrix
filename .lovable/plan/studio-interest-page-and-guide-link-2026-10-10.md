# Studio interest page and guide link

## Goal
Finish the new `/for-studios` and `/sv/for-studios` pages before publishing, without changing their approved copy, calculator, AR, guide, or studio dashboard behavior.

## Changes
- Add a prominent button on both language versions of the new studio page, linking to a dedicated interest page.
- Create dedicated English and Swedish interest pages at `/for-studios/interest` and `/sv/for-studios/interest`.
- Reuse the existing secure studio-interest submission flow and its current fields: studio name, contact person, email, and phone number.
- Present one clear form on each dedicated page for joining the wait list or requesting contact, with translated labels, client-side validation, server-side validation, loading/error handling, and a success confirmation.
- Keep the existing direct demo email option available.
- Make “Read the step-by-step guide” / “Läs steg-för-steg-guiden” a larger, visually prominent button with a 44px-or-larger touch target.
- Add the link from the new overview to the preserved detailed feature page at `/for-studios/features` and `/sv/for-studios/features`, so interested studios can read the exact feature breakdown.
- Keep the detailed feature pages intact.

## Verification and release
- Add focused tests for the interest-form validation and submission states where the current test structure supports them.
- Check the English and Swedish overview and interest pages on mobile and desktop, including the form, guide link, feature link, calculator, and language switching.
- Run the relevant tests and confirm the preview builds without errors.
- Publish the completed studio pages after verification.

## Technical details
- Reuse `sendStudioInterest`, which already validates submissions on the server and sends the existing branded studio-interest email.
- Keep all user input length-limited and validated in both the page and server handler; do not expose email credentials in the browser.
