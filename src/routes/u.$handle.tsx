import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy public profile URL. Profile pages now live at /@handle — we perform a
 * permanent redirect so old links and search engine signals carry over.
 */
export const Route = createFileRoute("/u/$handle")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/@{$username}",
      params: { username: params.handle },
      statusCode: 301,
    });
  },
  component: () => null,
});
