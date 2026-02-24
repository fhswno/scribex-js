// LEXICAL
import { createCommand } from 'lexical';

export const OPEN_SLASH_MENU_COMMAND = createCommand<void>('OPEN_SLASH_MENU_COMMAND');
export const INSERT_IMAGE_COMMAND = createCommand<File>('INSERT_IMAGE_COMMAND');
export const OPEN_AI_PROMPT_COMMAND = createCommand<void>('OPEN_AI_PROMPT_COMMAND');
export const INSERT_AI_PREVIEW_COMMAND = createCommand<{ prompt: string }>('INSERT_AI_PREVIEW_COMMAND');
