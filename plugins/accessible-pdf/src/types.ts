/**
 * The wire shapes this plugin uses, mirroring the host's
 * src/lib/plugins/contract.ts (plugins build separately and can't import it).
 */
import type { PageDescription } from '../../../src/lib/pdf/page-description';

export interface ContextMessage {
  type: 'context';
  theme: 'light' | 'dark';
  locale: string;
  dir: 'ltr' | 'rtl';
  messages?: Record<string, string>;
}

export interface DescribeBookMessage {
  type: 'describe-book';
  requestId: string;
}

export interface DescribedBook {
  description: PageDescription;
  fonts: ArrayBuffer[];
  images: ArrayBuffer[];
  author?: string;
  missingFonts: string[];
  skippedChapterIds: string[];
}

export type BookDescribedMessage =
  | ({ type: 'book-described'; requestId: string } & DescribedBook)
  | { type: 'book-described'; requestId: string; error: string };
