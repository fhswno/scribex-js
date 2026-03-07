// DOCS
import { docs } from '@/.source';

// FUMADOCS
import { loader } from 'fumadocs-core/source';

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/docs',
});
