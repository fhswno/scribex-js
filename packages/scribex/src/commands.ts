// LEXICAL
import { createCommand } from 'lexical';

export const OPEN_SLASH_MENU_COMMAND = createCommand<void>('OPEN_SLASH_MENU_COMMAND');
export const INSERT_IMAGE_COMMAND = createCommand<File>('INSERT_IMAGE_COMMAND');
