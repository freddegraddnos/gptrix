import React from "react";
import {
  Body,
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
  contactName?: string;
  contactEmail?: string;
  phone?: string;
}

const Email = ({ studioName, contactName, contactEmail, phone }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${studioName || "A studio"} is interested in InkSimulator`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={heading}>New studio interest</Heading>
        <Section style={details}>
          <Text style={text}>
            Studio: {studioName || "—"}
            <br />
            Contact: {contactName || "—"}
            <br />
            Email: {contactEmail || "—"}
            <br />
            Phone: {phone || "—"}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Studio interest: ${data?.studioName || "new studio"} · InkSimulator`,
  displayName: "Studio interest",
  to: "1891frs@gmail.com",
  previewData: {
    studioName: "Nordic Ink Studio",
    contactName: "Jane Doe",
    contactEmail: "jane@example.com",
    phone: "+46701234567",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: '"DM Mono", Consolas, monospace' };
const container = { borderTop: "6px solid #7c3aed", padding: "32px 28px", maxWidth: "520px" };
const brand = {
  color: "#7c3aed",
  fontSize: "12px",
  fontWeight: 700 as const,
  letterSpacing: "3px",
  margin: "0 0 18px",
};
const heading = {
  color: "#161616",
  fontFamily: 'Impact, "Arial Narrow", sans-serif',
  fontSize: "28px",
  lineHeight: "32px",
  margin: "0 0 18px",
  textTransform: "uppercase" as const,
};
const details = { backgroundColor: "#f6f2ea", border: "2px solid #161616", padding: "16px" };
const text = { color: "#161616", fontSize: "14px", lineHeight: "24px", margin: 0 };
