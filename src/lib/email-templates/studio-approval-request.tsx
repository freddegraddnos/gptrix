import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  studioName?: string;
  city?: string;
  contactEmail?: string;
  website?: string;
  instagram?: string;
  approveUrl?: string;
  rejectUrl?: string;
}

const Email = ({
  studioName,
  city,
  contactEmail,
  website,
  instagram,
  approveUrl,
  rejectUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${studioName || "A studio"} wants to join InkSimulator`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={h1}>New studio wants to join</Heading>
        <Section style={quote}>
          <Text style={quoteText}>
            Studio: {studioName || "—"}
            <br />
            City: {city || "—"}
            <br />
            Contact: {contactEmail || "—"}
            <br />
            Website: {website || "—"}
            <br />
            Instagram: {instagram || "—"}
          </Text>
        </Section>
        <Section>
          <Button href={approveUrl || "https://www.inksimulator.com"} style={approveButton}>
            Approve studio
          </Button>
          <Button href={rejectUrl || "https://www.inksimulator.com"} style={rejectButton}>
            Reject request
          </Button>
        </Section>
        <Text style={muted}>
          Each button works once. Approving publishes the studio in "Find your tattoo artist" right
          away; rejecting keeps it hidden.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Studio approval: ${data?.studioName || "new studio"} · InkSimulator`,
  displayName: "Studio approval request",
  to: "1891frs@gmail.com",
  previewData: {
    studioName: "Nordic Ink Studio",
    city: "Stockholm",
    contactEmail: "hello@nordicink.se",
    website: "https://nordicink.se",
    instagram: "@nordicink",
    approveUrl: "https://www.inksimulator.com/api/public/studio-approval?token=demo&action=approve",
    rejectUrl: "https://www.inksimulator.com/api/public/studio-approval?token=demo&action=reject",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "520px" };
const brand = {
  fontSize: "12px",
  letterSpacing: "4px",
  color: "#8a8a8a",
  margin: "0 0 16px",
  fontWeight: 700 as const,
};
const h1 = { fontSize: "24px", margin: "0 0 12px", color: "#111111" };

const quote = {
  borderLeft: "3px solid #8A5BF2",
  padding: "8px 14px",
  backgroundColor: "#f6f6f6",
  margin: "0 0 20px",
};
const quoteText = { fontSize: "15px", lineHeight: "24px", color: "#222222", margin: 0 };
const buttonBase = {
  borderRadius: "10px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700 as const,
  textDecoration: "none",
  display: "inline-block",
  marginRight: "10px",
};
const approveButton = { ...buttonBase, backgroundColor: "#0b7f5a", color: "#ffffff" };
const rejectButton = {
  ...buttonBase,
  backgroundColor: "#ffffff",
  color: "#b3261e",
  border: "1px solid #b3261e",
};
const muted = { fontSize: "12px", color: "#8a8a8a", margin: "24px 0 0" };
