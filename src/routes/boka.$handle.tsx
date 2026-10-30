import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Swedish booking URL. Existing links stay valid and move permanently to the canonical studio URL. */
export const Route = createFileRoute("/boka/$handle")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$handle/book", params: { handle: params.handle }, statusCode: 301 });
  },
});