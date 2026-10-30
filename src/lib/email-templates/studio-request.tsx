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
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  placement?: string;
  sizeCm?: string;
  colorMode?: string;
  description?: string;
  comparing?: boolean;
  link?: string;
}

const Email = ({
  studioName,
  clientName,
  clientEmail,
  clientPhone,
  placement,
  sizeCm,
  colorMode,
  description,
  comparing,
  link,
}: Props) => {
  const url = link || "https://www.inksimulator.com/artists/requests";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`New tattoo request${clientName ? ` from ${clientName}` : ""}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>INKSIMULATOR</Text>
          <Heading style={h1}>New tattoo request</Heading>
          <Text style={text}>
            {clientName || "A client"} sent a request to {studioName || "your studio"}.
          </Text>
          <Section style={quote}>
            <Text style={quoteText}>
              Placement: {placement || "—"}
              {sizeCm ? ` · ${sizeCm} cm` : ""}
              <br />
              Ink: {colorMode === "color" ? "Color" : "Black & grey"}
              <br />
              Email: {clientEmail || "—"}
              <br />
              Phone: {clientPhone || "—"}
              {description ? (
                <>
                  <br />
                  <br />
                  {description}
                </>
              ) : null}
            </Text>
          </Section>
          {comparing ? (
            <Text style={muted}>
              The client is comparing a few artists for this idea, so a quick reply helps.
            </Text>
          ) : null}
          <Button href={url} style={button}>
            Open the request
          </Button>
          <Text style={muted}>InkSimulator · inksimulator.com</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data["clientName"] ? `New tattoo request from ${data["clientName"]}` : "New tattoo request",
  displayName: "Studio — new tattoo request",
  previewData: {
    studioName: "AFFE TATTOO",
    clientName: "Anna Berg",
    clientEmail: "anna@example.com",
    clientPhone: "+46 70 123 45 67",
    placement: "Forearm",
    sizeCm: "14",
    colorMode: "black-grey",
    description: "A fine-line snake wrapping the forearm, black and grey.",
    comparing: false,
    link: "https://www.inksimulator.com/artists/requests",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const brand = { fontSize: "12px", letterSpacing: "2px", color: "#8A5BF2", margin: "0 0 8px" };
const h1 = { fontSize: "24px", color: "#111111", margin: "0 0 12px" };
const text = { fontSize: "15px", color: "#333333", lineHeight: "22px" };
const quote = {
  backgroundColor: "#f5f5f5",
  borderLeft: "3px solid #8A5BF2",
  padding: "14px 16px",
  margin: "16px 0",
};
const quoteText = { fontSize: "14px", color: "#333333", lineHeight: "22px", margin: "0" };
const button = {
  backgroundColor: "#111111",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  padding: "12px 22px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 20px",
};
const muted = { fontSize: "12px", color: "#777777", lineHeight: "18px" };
