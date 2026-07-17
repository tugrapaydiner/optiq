import type { ReviewItem, ReviewStatus } from "./common";

export type ProcessNode = {
  id: string;
  label: string;
  description: string;
  status: ReviewStatus;
};

export type ProcessEdge = {
  id: string;
  from: string;
  to: string;
  label: string | null;
  status: ReviewStatus;
};

export type ProcessLesson = {
  schemaVersion: "1.0";
  supported: boolean;
  unsupportedReason: string | null;
  title: string;
  summary: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  readingOrder: string[];
  reviewItems: ReviewItem[];
};
