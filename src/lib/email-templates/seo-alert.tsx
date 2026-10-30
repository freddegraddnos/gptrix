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

interface IssueItem {
  area?: string;
  target?: string;
  message?: string;
  severity?: string;
}

interface Props {
  siteUrl?: string;
  issues?: IssueItem[];
  totalCount?: number;
  dashboardUrl?: string;
}

const Email = ({ siteUrl, issues, totalCount, dashboardUrl }: Props) => {
  const list = issues ?? [];
  const site = siteUrl || "https://www.inksimulator.com";
  const url = dashboardUrl || "https://www.inksimulator.com/seo-health";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${list.length} new SEO issue(s) detected on ${site}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>INKSIMULATOR</Text>
          <Heading style={h1}>New SEO issues detected</Heading>
          <Text style={text}>
            The automated check of <strong>{site}</strong> found <strong>{list.length}</strong> new
            issue
            {list.length === 1 ? "" : "s"}
            {typeof totalCount === "number" && totalCount !== list.length
              ? ` (${totalCount} open in total)`
              : ""}
            .
          </Text>
          <Section style={quote}>
            {list.map((issue, i) => (
              <Text key={i} style={quoteText}>
                <strong>
                  {(issue.severity === "error" ? "Error" : "Warning") +
                    " · " +
                    (issue.area ?? "seo")}
                </strong>
                <br />
                {issue.target ? `${issue.target} — ` : ""}
                {issue.message}
              </Text>
            ))}
          </Section>
          <Button href={url} style={button}>
            Open SEO health
          </Button>
          <Text style={footer}>
            You receive this because email alerts are on in InkSimulator SEO health. You can turn
            them off on that page.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = { backgroundColor: "#050505", margin: 0, padding: "24px 0" };
const container = {
  backgroundColor: "#0d0d0d",
  border: "1px solid #1f1f1f",
  borderRadius: "16px",
  margin: "0 auto",
  maxWidth: "520px",
  padding: "28px",
};
const brand = {
  color: "#8A5BF2",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "3px",
  margin: "0 0 12px",
};
const h1 = {
  color: "#ffffff",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 12px",
};
const text = {
  color: "#c9c9c9",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 16px",
};
const quote = {
  backgroundColor: "#141414",
  border: "1px solid #232323",
  borderRadius: "12px",
  padding: "14px 16px",
  margin: "0 0 20px",
};
const quoteText = {
  color: "#e5e5e5",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 12px",
};
const button = {
  backgroundColor: "#8A5BF2",
  borderRadius: "10px",
  color: "#050505",
  display: "inline-block",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "14px",
  fontWeight: 700,
  padding: "12px 22px",
  textDecoration: "none",
};
const footer = {
  color: "#7a7a7a",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: "11px",
  lineHeight: "18px",
  margin: "20px 0 0",
};

export const template: TemplateEntry = {
  component: Email,
  subject: (data) =>
    `SEO alert: ${(data?.issues?.length ?? 0) || "new"} issue(s) on ${
      data?.siteUrl ?? "inksimulator.com"
    }`,
  displayName: "SEO monitoring alert",
  previewData: {
    siteUrl: "https://www.inksimulator.com",
    totalCount: 2,
    issues: [
      {
        severity: "error",
        area: "sitemap",
        target: "/sitemap.xml",
        message: "4 sitemap entries are not absolute https URLs.",
      },
    ],
  },
};
