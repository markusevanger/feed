import { type SchemaTypeDefinition } from 'sanity'

import { postType } from './postType'
import { selfHostedImageType, selfHostedVideoType, selfHostedMediaType } from '../plugins/selfHostedMedia'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    postType,
    selfHostedImageType,
    selfHostedVideoType,
    selfHostedMediaType,
  ],
}
