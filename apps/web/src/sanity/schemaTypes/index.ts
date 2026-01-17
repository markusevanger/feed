import { type SchemaTypeDefinition } from 'sanity'

import { postType } from './postType'
import { selfHostedImageType, selfHostedVideoType } from '../plugins/selfHostedMedia'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    postType,
    selfHostedImageType,
    selfHostedVideoType,
  ],
}
