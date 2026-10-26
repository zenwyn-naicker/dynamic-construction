export type Project = {
  id: string;
  reference: string;
  name: string;
  status: string;
  reason: string;
  contractValue: number;
  version: string;
  progress: number;
  milestones: Milestone[];
  updates: {
    id: string;
    message: string;
    createdAt: string;
    published: boolean;
  }[];
};
export type Milestone = {
  id: string;
  title: string;
  dueAt: string;
  complete: boolean;
  published: boolean;
};
export type Quote = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  site: string;
  notes: string;
  type: string;
  length: number;
  width: number;
  finish: string;
  description: string;
  estimate: number | null;
  formalAmount: number | null;
  validUntil: string | null;
  status: string;
  reason: string;
  version: string;
  clientId: string | null;
  assumptions: string;
};
export type Client = { id: string; fullName: string; email: string };
export type Page<T> = {
  items: T[];
  number: number;
  pageSize: number;
  total: number;
};
export type Portfolio = {
  id: string;
  version: string;
  title: string;
  location: string;
  projectType: string;
  summary: string;
  details: string;
  completedAt: string;
  durationDays: number;
  published: boolean;
};
export type Change = {
  id: string;
  description: string;
  status: string;
  reason: string;
  decision: string;
  costImpact: number;
  daysImpact: number;
  version: string;
  createdAt: string;
  history: { id: string; status: string; reason: string; createdAt: string }[];
};
