import { z, type ZodRawShape } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Catalog } from '../core/catalog.js';
import type { CatalogEntry } from '../core/types.js';
import type { CallOptions } from '../core/client.js';
import type { ToolCtx } from './gateway.js';
import { formatResult } from './format.js';

export interface NamedToolDef {
  name: string;
  description: string;
  endpointName: string;            // exact catalog `name` to resolve
  schema: ZodRawShape;
  build: (args: any) => CallOptions;
}

const q = (args: Record<string, unknown>, keys: string[]): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const k of keys) if (args[k] !== undefined) out[k] = args[k];
  return out;
};

export const NAMED_TOOLS: NamedToolDef[] = [
  // ---- Leads ----
  {
    name: 'edmingle_leads_list', description: 'List leads.',
    endpointName: 'Get Leads List',
    schema: { page: z.number().optional(), per_page: z.number().optional() },
    build: (a) => ({ query: q(a, ['page', 'per_page']) }),
  },
  {
    name: 'edmingle_enquiries_list', description: 'List enquiries.',
    endpointName: 'Get Enquiry List',
    schema: { page: z.number().optional(), per_page: z.number().optional() },
    build: (a) => ({ query: q(a, ['page', 'per_page']) }),
  },
  {
    name: 'edmingle_lead_capture', description: 'Capture a new lead from a form.',
    endpointName: 'Lead Capture',
    schema: { body: z.record(z.any()).describe('lead fields (name, email, phone, etc.)') },
    build: (a) => ({ body: a.body, confirm: true }),
  },
  // ---- Students ----
  {
    name: 'edmingle_students_list', description: 'List students (filter by search/archived/page).',
    endpointName: 'List all students',
    schema: {
      search: z.string().optional(), is_archived: z.number().optional(),
      page: z.number().optional(), per_page: z.number().optional(),
      organization_id: z.union([z.string(), z.number()]).optional(),
    },
    build: (a) => ({ query: q(a, ['search', 'is_archived', 'page', 'per_page', 'organization_id']) }),
  },
  {
    name: 'edmingle_student_search',
    description: 'Look up a student by EXACT email address. For name/partial search use edmingle_students_list (its `search` arg).',
    endpointName: 'Search Student',
    schema: { student_email: z.string().describe('the student\'s exact email address') },
    build: (a) => ({ query: { student_email: a.student_email } }),
  },
  {
    name: 'edmingle_student_get', description: 'Retrieve one student by id.',
    endpointName: 'Retrieve a student',
    schema: { user_id: z.union([z.string(), z.number()]) },
    build: (a) => ({ pathParams: { user_id: a.user_id } }),
  },
  {
    name: 'edmingle_student_create', description: 'Create a new student.',
    endpointName: 'Creating a new student',
    schema: { body: z.record(z.any()) },
    build: (a) => ({ body: a.body, confirm: true }),
  },
  {
    name: 'edmingle_student_enroll', description: 'Enroll a student in a course (admin).',
    endpointName: 'Student enrollment in course by admin',
    schema: { body: z.record(z.any()) },
    build: (a) => ({ body: a.body, confirm: true }),
  },
  {
    name: 'edmingle_student_archive', description: 'Archive (deactivate) a student. Destructive.',
    endpointName: 'Archive Student',
    schema: { body: z.record(z.any()), confirm: z.boolean().optional() },
    build: (a) => ({ body: a.body, confirm: a.confirm === true }),
  },
  // ---- Courses ----
  {
    name: 'edmingle_courses_list', description: 'List all courses.',
    endpointName: 'List All Courses',
    schema: { page: z.number().optional(), per_page: z.number().optional() },
    build: (a) => ({ query: q(a, ['page', 'per_page']) }),
  },
  {
    name: 'edmingle_course_create', description: 'Create a course.',
    endpointName: 'create a course',
    schema: { body: z.record(z.any()) },
    build: (a) => ({ body: a.body, confirm: true }),
  },
  {
    name: 'edmingle_course_publish', description: 'Publish a course by organization (make it live).',
    endpointName: 'Publish Course By Organization',
    schema: { body: z.record(z.any()).optional(), confirm: z.boolean().optional() },
    build: (a) => ({ body: a.body, confirm: a.confirm !== false }),
  },
  // ---- Batches ----
  {
    name: 'edmingle_batches_list', description: 'List all batches.',
    endpointName: 'List all batch',
    schema: { page: z.number().optional(), per_page: z.number().optional() },
    build: (a) => ({ query: q(a, ['page', 'per_page']) }),
  },
  {
    name: 'edmingle_batch_create', description: 'Create a batch.',
    endpointName: 'Create Batch',
    schema: { body: z.record(z.any()) },
    build: (a) => ({ body: a.body, confirm: true }),
  },
  {
    name: 'edmingle_batch_add_student', description: 'Add a student to a batch.',
    endpointName: 'Add student to batch',
    schema: { body: z.record(z.any()) },
    build: (a) => ({ body: a.body, confirm: true }),
  },
  // ---- Reports ----
  {
    name: 'edmingle_report_sales', description: 'Sales report (date range).',
    endpointName: 'Sales Report',
    schema: {
      startDate: z.string().optional(), endDate: z.string().optional(),
      page: z.number().optional(), per_page: z.number().optional(),
    },
    build: (a) => ({ query: q(a, ['startDate', 'endDate', 'page', 'per_page']) }),
  },
  {
    name: 'edmingle_report_payments', description: 'Payment report.',
    endpointName: 'Payment Report',
    schema: { startDate: z.string().optional(), endDate: z.string().optional() },
    build: (a) => ({ query: q(a, ['startDate', 'endDate']) }),
  },
  {
    name: 'edmingle_report_enrollments', description: 'Enrollment report.',
    endpointName: 'Enrollment Report',
    schema: { startDate: z.string().optional(), endDate: z.string().optional() },
    build: (a) => ({ query: q(a, ['startDate', 'endDate']) }),
  },
  // ---- Data extraction ----
  {
    name: 'edmingle_data_extract', description: 'Bulk-export data for an organization (type selects what).',
    endpointName: 'Organization Based Data Extract',
    schema: {
      type: z.number().describe('entity type id'),
      organization_id: z.union([z.string(), z.number()]).optional(),
      page: z.number().optional(), per_page: z.number().optional(),
      start_date: z.union([z.string(), z.number()]).optional(),
    },
    build: (a) => ({ query: q(a, ['type', 'organization_id', 'page', 'per_page', 'start_date']) }),
  },
];

export interface ResolvedNamedTool extends NamedToolDef {
  entry: CatalogEntry | undefined;
}

export function resolveNamedTools(catalog: Catalog): ResolvedNamedTool[] {
  const byName = new Map(catalog.all().map((e) => [e.name, e]));
  return NAMED_TOOLS.map((t) => ({ ...t, entry: byName.get(t.endpointName) }));
}

export function registerNamedTools(server: McpServer, ctx: ToolCtx): void {
  for (const t of resolveNamedTools(ctx.catalog)) {
    if (!t.entry) {
      // eslint-disable-next-line no-console
      console.error(`[edmingle-mcp] WARNING: named tool ${t.name} -> "${t.endpointName}" not in catalog; skipping`);
      continue;
    }
    const entry = t.entry;
    server.tool(t.name, t.description, t.schema, async (args: Record<string, unknown>) => {
      const result = await ctx.client.call(entry, t.build(args));
      return formatResult(result);
    });
  }
}
