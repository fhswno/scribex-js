import type { EditorThemeClasses } from 'lexical';

export const scribexTheme: EditorThemeClasses = {
  paragraph: 'scribex-paragraph',
  heading: {
    h1: 'scribex-h1',
    h2: 'scribex-h2',
    h3: 'scribex-h3',
    h4: 'scribex-h3',
    h5: 'scribex-h3',
    h6: 'scribex-h3',
  },
  quote: 'scribex-quote',
  list: {
    ul: 'scribex-ul',
    ol: 'scribex-ol',
    listitem: 'scribex-listitem',
    checklist: 'scribex-checklist',
    listitemChecked: 'scribex-listitem-checked',
    listitemUnchecked: 'scribex-listitem-unchecked',
    nested: {
      listitem: 'scribex-nested-listitem',
    },
  },
  text: {
    bold: 'scribex-bold',
    italic: 'scribex-italic',
    underline: 'scribex-underline',
    strikethrough: 'scribex-strikethrough',
    code: 'scribex-code',
  },
};
