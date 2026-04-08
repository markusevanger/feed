import { type SchemaTypeDefinition } from 'sanity'

import { frontpageType } from './frontpageType'
import { postType } from './postType'
import { selfHostedImageType, selfHostedVideoType, selfHostedMediaType } from '../plugins/selfHostedMedia'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    frontpageType,
    postType,
    selfHostedImageType,
    selfHostedVideoType,
    selfHostedMediaType,
  ],
}
