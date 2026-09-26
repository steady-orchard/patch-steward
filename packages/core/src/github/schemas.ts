import { z } from 'zod';
import { SUBMISSION_TITLE_MAX_LENGTH } from '../policy/bounds.js';

const objectId = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
const positiveInt = z.number().int().positive();

export const githubUserSchema = z.object({
  login: z.string().min(1).max(100),
  id: positiveInt,
  type: z.string().max(64),
});

export const githubRepositoryResponseSchema = z.object({
  full_name: z.string().min(3).max(201),
  default_branch: z.string().min(1).max(255),
  private: z.boolean(),
});

export const githubIssueResponseSchema = z.object({
  number: positiveInt,
  title: z.string().max(SUBMISSION_TITLE_MAX_LENGTH),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  user: githubUserSchema.nullable(),
  author_association: z.string().max(64),
  pull_request: z.object({}).nullish(),
});

export const githubPullRequestResponseSchema = z.object({
  number: positiveInt,
  title: z.string().max(SUBMISSION_TITLE_MAX_LENGTH),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean(),
  head: z.object({ sha: objectId, ref: z.string().min(1).max(255) }),
  base: z.object({ sha: objectId, ref: z.string().min(1).max(255) }),
  user: githubUserSchema.nullable(),
  author_association: z.string().max(64),
  changed_files: z.number().int().min(0),
});

export const githubPullRequestFileSchema = z.object({
  filename: z.string().min(1),
  status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']),
  previous_filename: z.string().min(1).optional(),
});

export const githubCommitPullRequestSchema = z.object({
  number: positiveInt,
  state: z.enum(['open', 'closed']),
  head: z.object({ sha: objectId }),
});

export const githubIssueCommentResponseSchema = z.object({
  id: positiveInt,
  body: z.string(),
  user: githubUserSchema.nullable(),
  author_association: z.string().max(64),
  updated_at: z.string().min(1).max(64),
});

export const githubContentsEntrySchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().min(1),
  sha: objectId,
  type: z.enum(['file', 'dir', 'symlink', 'submodule']),
  size: z.number().int().min(0),
});

export const githubTreeResponseSchema = z.object({
  sha: objectId,
  truncated: z.boolean(),
  tree: z.array(
    z.object({
      path: z.string().min(1),
      mode: z.enum(['100644', '100755', '120000', '160000', '040000']),
      type: z.enum(['blob', 'tree', 'commit']),
      sha: objectId,
      size: z.number().int().min(0).optional(),
    }),
  ),
});

export const githubBlobResponseSchema = z.object({
  sha: objectId,
  size: z.number().int().min(0),
  encoding: z.literal('base64'),
  content: z.string(),
});

export const githubRefResponseSchema = z.object({
  ref: z.string().min(1),
  object: z.object({ sha: objectId, type: z.string().min(1).max(32) }),
});
