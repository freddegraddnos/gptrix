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
  code?: string;
  studioName?: string;
}

const Email = ({ code, studioName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your InkSimulator studio verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={h1}>Verify your studio</Heading>
        <Text style={text}>
          Enter this code in the artist panel to verify the contact email for{" "}
          <strong>{studioName || "your studio"}</strong>.
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code || "000000"}</Text>
        </Section>
        <Text style={muted}>
          The code expires in 15 minutes. If you didn&apos;t request it, you can ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your InkSimulator studio verification code",
  displayName: "Studio verification code",
  previewData: { code: "482913", studioName: "Nordic Ink Studio" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: '"DM Mono", Consolas, monospace' };
const container = {
  backgroundColor: "#F6F2EA",
  border: "2px solid #161616",
  padding: "32px 28px",
  maxWidth: "520px",
};
const brand = {
  fontSize: "12px",
  letterSpacing: "4px",
  color: "#8A5BF2",
  margin: "0 0 16px",
  fontWeight: 700 as const,
};
const h1 = {
  fontFamily: 'Impact, "Arial Narrow", sans-serif',
  fontSize: "28px",
  margin: "0 0 12px",
  color: "#161616",
  textTransform: "uppercase" as const,
};
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333", margin: "0 0 16px" };
const codeBox = {
  backgroundColor: "#f6f6f6",
  border: "2px solid #161616",
  borderRadius: "4px",
  padding: "18px",
  textAlign: "center" as const,
  margin: "0 0 20px",
};
const codeText = {
  fontSize: "32px",
  letterSpacing: "10px",
  fontWeight: 700 as const,
  color: "#111111",
  margin: 0,
};
const muted = { fontSize: "12px", color: "#8a8a8a", margin: "24px 0 0" };
