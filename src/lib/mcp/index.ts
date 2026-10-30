import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudios from "./tools/list-studios";
import myBookings from "./tools/my-bookings";
import bookStudio from "./tools/book-studio";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ink-vision-ar",
  title: "Ink Vision AR",
  version: "0.1.0",
  instructions:
    "InkSimulator tattoo try-on. Use `list_studios` to find approved studios and booking links, and `my_bookings` to see the user's booking requests, and `book_studio` to send a booking request to a studio (shows in the studio panel and notifies them).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStudios, myBookings, bookStudio],
});
