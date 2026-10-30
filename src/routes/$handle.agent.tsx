import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { AgentChat } from "@/components/AgentChat";
import { getAgentStudio } from "@/lib/agentStudio.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/$handle/agent")({
  loader: async ({ params }) => {
    const r = await getAgentStudio({ data: { handle: params.handle } });
    if (!r) throw notFound();
    if (r.movedTo) throw redirect({ to: "/$handle/agent", params: { handle: r.movedTo }, statusCode: 301 });
    return r;
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? params.handle;
    return seo({
      path: `/${params.handle}/agent`,
      title: `Book a tattoo at ${name} | InkSimulator`,
      description: `Chat with ${name}'s booking assistant: get a price estimate, see free times and book your tattoo.`,
    });
  },
  errorComponent: () => <p className="p-8 text-center">Something went wrong. Try again.</p>,
  notFoundComponent: () => <p className="p-8 text-center">Studio not found.</p>,
  component: AgentPage,
});

function AgentPage() {
  const studio = Route.useLoaderData();
  const { handle } = Route.useParams();
  return <AgentChat studio={studio} handle={handle} />;
}
