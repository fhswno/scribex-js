import type { Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { ImageNode } from './ImageNode';
import { LoadingImageNode } from './LoadingImageNode';
import { AIPreviewNode } from './AIPreviewNode';
import { MentionNode } from './MentionNode';
import { CodeBlockNode } from './CodeBlockNode';
import { CalloutNode } from './CalloutNode';
import { VideoNode } from './VideoNode';
import { LoadingVideoNode } from './LoadingVideoNode';
import { HorizontalRuleNode } from './HorizontalRuleNode';

export const ALL_NODES: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  ImageNode,
  LoadingImageNode,
  AIPreviewNode,
  MentionNode,
  CodeBlockNode,
  CalloutNode,
  VideoNode,
  LoadingVideoNode,
  HorizontalRuleNode,
];
