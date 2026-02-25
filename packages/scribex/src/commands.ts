// LEXICAL
import { createCommand } from 'lexical';

export const OPEN_SLASH_MENU_COMMAND = createCommand<void>('OPEN_SLASH_MENU_COMMAND');
export const INSERT_IMAGE_COMMAND = createCommand<File>('INSERT_IMAGE_COMMAND');
export const OPEN_AI_PROMPT_COMMAND = createCommand<void>('OPEN_AI_PROMPT_COMMAND');
export const INSERT_AI_PREVIEW_COMMAND = createCommand<{ prompt: string }>('INSERT_AI_PREVIEW_COMMAND');
export const OPEN_EMOJI_PICKER_COMMAND = createCommand<void>('OPEN_EMOJI_PICKER_COMMAND');
export const OPEN_LINK_INPUT_COMMAND = createCommand<void>('OPEN_LINK_INPUT_COMMAND');
export const SET_TEXT_COLOR_COMMAND = createCommand<string>('SET_TEXT_COLOR_COMMAND');
export const SET_HIGHLIGHT_COLOR_COMMAND = createCommand<string>('SET_HIGHLIGHT_COLOR_COMMAND');
export const INSERT_TABLE_COMMAND_SCRIBEX = createCommand<{ rows: number; columns: number }>('INSERT_TABLE_COMMAND_SCRIBEX');
export const INSERT_CALLOUT_COMMAND = createCommand<{ emoji?: string; colorPreset?: string }>('INSERT_CALLOUT_COMMAND');
