import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old agent link: forwards to inksimulator.com/<handle>/agent. */
export const Route = createFileRoute("/agent/$handle")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$handle/agent", params: { handle: params.handle }, statusCode: 301 });
  },
  component: () => null,
});
