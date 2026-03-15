"use client";

import {
  AutoLinkPlugin as LexicalAutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from "@lexical/react/LexicalAutoLinkPlugin";

import type { LinkMatcher } from "@lexical/link";

const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const URL_MATCHER: LinkMatcher = createLinkMatcherWithRegExp(
  URL_REGEX,
  (text) => (text.startsWith("http") ? text : `https://${text}`),
);

const EMAIL_MATCHER: LinkMatcher = createLinkMatcherWithRegExp(
  EMAIL_REGEX,
  (text) => `mailto:${text}`,
);

const DEFAULT_MATCHERS: LinkMatcher[] = [URL_MATCHER, EMAIL_MATCHER];

export interface AutoLinkPluginProps {
  /** Custom matchers to use instead of the defaults. */
  matchers?: LinkMatcher[];
}

export function AutoLinkPlugin({ matchers }: AutoLinkPluginProps = {}) {
  return <LexicalAutoLinkPlugin matchers={matchers ?? DEFAULT_MATCHERS} />;
}
