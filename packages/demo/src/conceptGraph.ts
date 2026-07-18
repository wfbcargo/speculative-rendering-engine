import type {
  AuthoredEdge,
  Clock,
  GraphNode,
  GraphPredictorConfig,
  Intent,
  StrengtheningRule,
} from "@sre/core";

export const ACTION_HOVER = "hover";
export const ACTION_OPEN = "open";

const HOVER_GAIN = 0.7;
const OPEN_GAIN = 1.5;

const CONCEPT_BOND = 1;
const NEIGHBOR_BOND = 0.4;

export const perfClock: Clock = { now: () => performance.now() };

export interface SurfaceMeta {
  id: string;
  concept: string;
  title: string;
  kicker: string;
  lead: string;
  rows: string[];
  metric: { label: string; value: string };
}

export interface Cluster {
  concept: string;
  blurb: string;
  surfaces: SurfaceMeta[];
}

export const clusters: Cluster[] = [
  {
    concept: "Analyzing",
    blurb: "comparing, drilling in, interrogating data",
    surfaces: [
      {
        id: "insights",
        concept: "Analyzing",
        title: "Insights",
        kicker: "signal digest",
        lead: "Ranked anomalies across the last seven days of traffic.",
        rows: ["Retention dip in EU-West", "Spike: referral / partner", "New cohort forming"],
        metric: { label: "flagged", value: "12" },
      },
      {
        id: "query",
        concept: "Analyzing",
        title: "Query",
        kicker: "ad-hoc console",
        lead: "A saved expression ready to run against the warehouse.",
        rows: ["select cohort, ret_30", "where plan = 'team'", "order by ret_30 desc"],
        metric: { label: "rows", value: "3.1k" },
      },
      {
        id: "cohorts",
        concept: "Analyzing",
        title: "Cohorts",
        kicker: "retention matrix",
        lead: "Weekly retention triangle, warmest cells first.",
        rows: ["W0 100%", "W1 61%", "W4 38%"],
        metric: { label: "tracked", value: "18" },
      },
    ],
  },
  {
    concept: "Reporting",
    blurb: "assembling summaries, dashboards, exports",
    surfaces: [
      {
        id: "dashboard",
        concept: "Reporting",
        title: "Dashboard",
        kicker: "board view",
        lead: "The pinned KPI board leadership opens every Monday.",
        rows: ["MRR 128k", "Active 9.4k", "Churn 2.1%"],
        metric: { label: "tiles", value: "6" },
      },
      {
        id: "export",
        concept: "Reporting",
        title: "Export",
        kicker: "packaged output",
        lead: "A formatted CSV bundle staged for the finance handoff.",
        rows: ["revenue.csv", "cohorts.csv", "manifest.json"],
        metric: { label: "size", value: "2.4 MB" },
      },
      {
        id: "summary",
        concept: "Reporting",
        title: "Summary",
        kicker: "narrative recap",
        lead: "A generated prose recap of the week's movement.",
        rows: ["Growth held steady", "Expansion up 8%", "One at-risk account"],
        metric: { label: "words", value: "240" },
      },
    ],
  },
  {
    concept: "Creating",
    blurb: "bringing a new entity into existence",
    surfaces: [
      {
        id: "new-draft",
        concept: "Creating",
        title: "New Draft",
        kicker: "blank canvas",
        lead: "A fresh document seeded with your default frontmatter.",
        rows: ["title:", "audience:", "outline: 0 blocks"],
        metric: { label: "blocks", value: "0" },
      },
      {
        id: "compose",
        concept: "Creating",
        title: "Compose",
        kicker: "editor surface",
        lead: "The writing surface with the last template preloaded.",
        rows: ["## Opening", "Body paragraph", "Call to action"],
        metric: { label: "chars", value: "312" },
      },
    ],
  },
  {
    concept: "Designing",
    blurb: "arranging layout, style, visual structure",
    surfaces: [
      {
        id: "layout",
        concept: "Designing",
        title: "Layout",
        kicker: "grid frame",
        lead: "The responsive grid with breakpoints pinned.",
        rows: ["cols: 12", "gutter: 24", "safe area: on"],
        metric: { label: "regions", value: "5" },
      },
      {
        id: "theme",
        concept: "Designing",
        title: "Theme",
        kicker: "token set",
        lead: "The active palette and type ramp in one panel.",
        rows: ["accent: cobalt", "surface: obsidian", "type: mono / sans"],
        metric: { label: "tokens", value: "42" },
      },
    ],
  },
  {
    concept: "Exploring",
    blurb: "browsing, sampling, sandboxing without commitment",
    surfaces: [
      {
        id: "gallery",
        concept: "Exploring",
        title: "Gallery",
        kicker: "sample wall",
        lead: "A wall of starter compositions to riff on.",
        rows: ["Editorial dark", "Data console", "Minimal report"],
        metric: { label: "samples", value: "24" },
      },
      {
        id: "samples",
        concept: "Exploring",
        title: "Samples",
        kicker: "seed data",
        lead: "Prebuilt datasets for sandboxing a query.",
        rows: ["retail-90d", "saas-cohorts", "events-stream"],
        metric: { label: "sets", value: "9" },
      },
    ],
  },
];

export const surfaces: SurfaceMeta[] = clusters.flatMap(
  (cluster) => cluster.surfaces,
);

export const surfaceById: Map<string, SurfaceMeta> = new Map(
  surfaces.map((surface) => [surface.id, surface]),
);

const neighborBonds: Array<[string, string]> = [
  ["Analyzing", "Reporting"],
  ["Creating", "Designing"],
  ["Exploring", "Analyzing"],
];

export function intentFor(componentId: string): Intent {
  return { kind: "surface", key: `surface:${componentId}` };
}

const conceptNodes: GraphNode[] = clusters.map((cluster) => ({
  id: cluster.concept,
  kind: "concept",
}));

const componentNodes: GraphNode[] = surfaces.map((surface) => ({
  id: surface.id,
  kind: "component",
}));

export const nodes: GraphNode[] = [...conceptNodes, ...componentNodes];

const bondEdges: AuthoredEdge[] = clusters.flatMap((cluster) =>
  cluster.surfaces.map((surface) => ({
    from: cluster.concept,
    to: surface.id,
    weight: CONCEPT_BOND,
  })),
);

const neighborEdges: AuthoredEdge[] = neighborBonds.map(([from, to]) => ({
  from,
  to,
  weight: NEIGHBOR_BOND,
}));

export const edges: AuthoredEdge[] = [...bondEdges, ...neighborEdges];

export const rules: StrengtheningRule[] = surfaces.flatMap((surface) => [
  {
    action: ACTION_HOVER,
    target: surface.id,
    concept: surface.concept,
    gain: HOVER_GAIN,
  },
  {
    action: ACTION_OPEN,
    target: surface.id,
    concept: surface.concept,
    gain: OPEN_GAIN,
  },
]);

export const graphConfig: GraphPredictorConfig = {
  nodes,
  edges,
  rules,
  intentFor,
  clock: perfClock,
};
