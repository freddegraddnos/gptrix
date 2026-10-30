# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Analytics events (first-party, no personal data)

Sent via `src/lib/track.ts` to the built-in hosting analytics script (`/~flock.js`, `window.Tinybird.trackEvent`) and to the `analytics_events` table (anonymous device id only). See `/admin/funnel`.

### Main funnel

ar_opened → camera_granted → tryon_started → design_saved → share_clicked or studio_contact_clicked

- `ar_opened` — /ar page opened
- `camera_prompt_shown` / `camera_granted` / `camera_denied` — camera explainer (CameraPrimer)
- `design_selected` — design chosen for live AR or photo try-on
- `tryon_started` — live AR camera starts or a photo is loaded
- `photo_uploaded` — photo loaded on /photo-tryon
- `design_saved` — design saved to "My designs"
- `share_clicked` — native share sheet opened
- `studios_viewed` — /studios opened
- `studio_contact_clicked` — email/phone/Instagram/website click on a studio page
- `booking_started` / `booking_completed` — booking dialog opened / request sent
- `for_studios_cta_clicked` — link into /for-studios or a CTA on it
- `studio_request_submitted` — custom request sent to one or more studios
- `signup_started` / `signup_completed` — "Create account" chosen / account created
