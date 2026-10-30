import { publicSiteUrl } from "@/lib/publicOrigin";
import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  studioName?: string;
  approved?: boolean;
  loginUrl?: string;
}

const Email = ({ studioName, approved, loginUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {approved ? "Your studio is live on InkSimulator" : "About your InkSimulator studio request"}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={h1}>
          {approved ? "Your studio is approved" : "Your studio request was not approved"}
        </Heading>
        <Text style={text}>
          {approved
            ? `${studioName || "Your studio"} is now visible to clients searching for a tattoo artist. You can start taking requests right away.`
            : `${studioName || "Your studio"} is not published on InkSimulator for now. Reply to this email if you would like us to take another look.`}
        </Text>
        {approved ? (
          <Button
            href={loginUrl || publicSiteUrl("/artists/dashboard")}
            style={button}
          >
            {loginUrl ? "Choose password and open your studio panel" : "Open your studio panel"}
          </Button>
        ) : null}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.approved
      ? "Your studio is live on InkSimulator"
      : "About your InkSimulator studio request",
  displayName: "Studio approval result",
  previewData: { studioName: "Nordic Ink Studio", approved: true },
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
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333", margin: "0 0 20px" };
const button = {
  backgroundColor: "#111111",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700 as const,
  textDecoration: "none",
};
