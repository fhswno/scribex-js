import type { Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { ImageNode } from './ImageNode';
import { LoadingImageNode } from './LoadingImageNode';
import { AIPreviewNode } from './AIPreviewNode';
import { MentionNode } from './MentionNode';

export const ALL_NODES: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  ImageNode,
  LoadingImageNode,
  AIPreviewNode,
  MentionNode,
];
