import { client } from './feishu-client.js';
import { logger } from '../utils/logger.js';

const FEISHU_DOC_PATTERN = /(?:feishu\.cn|larksuite\.com)\/(?:docx|wiki|docs)\/([a-zA-Z0-9]+)/;

export function extractDocId(url: string): string | null {
  const match = url.match(FEISHU_DOC_PATTERN);
  return match ? match[1] : null;
}

export async function fetchDocContent(documentId: string): Promise<string> {
  const blocks: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await client.docx.documentBlock.list({
      path: { document_id: documentId },
      params: { page_size: 500, page_token: pageToken },
    });

    const items = res.data?.items || [];
    for (const block of items) {
      const text = extractBlockText(block);
      if (text) blocks.push(text);
    }

    pageToken = res.data?.page_token || undefined;
  } while (pageToken);

  return blocks.join('\n');
}

function extractBlockText(block: any): string {
  const type = block.block_type;

  // Text, Heading, Bullet, Ordered, Quote, Code blocks all have `elements`
  if (block[getBlockKey(type)]?.elements) {
    return block[getBlockKey(type)].elements
      .map((el: any) => el.text_run?.content || el.mention_user?.name || '')
      .join('');
  }

  return '';
}

function getBlockKey(blockType: number): string {
  const map: Record<number, string> = {
    2: 'text',         // Text
    3: 'heading1',     // Heading1
    4: 'heading2',
    5: 'heading3',
    6: 'heading4',
    7: 'heading5',
    8: 'heading6',
    9: 'heading7',
    10: 'heading8',
    11: 'heading9',
    12: 'bullet',      // Bullet
    13: 'ordered',     // Ordered
    14: 'code',        // Code
    15: 'quote',       // Quote
  };
  return map[blockType] || 'text';
}

export async function fetchDocFromUrl(url: string): Promise<string | null> {
  const docId = extractDocId(url);
  if (!docId) {
    logger.warn('Could not extract doc ID from URL', { url });
    return null;
  }
  try {
    return await fetchDocContent(docId);
  } catch (err) {
    logger.error('Failed to fetch document', { docId, error: err });
    return null;
  }
}
