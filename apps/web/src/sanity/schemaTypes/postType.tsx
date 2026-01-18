import React from 'react'
import { DocumentTextIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'
import BulkMediaUpload from '../plugins/selfHostedMedia/BulkMediaUpload'

export const postType = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('A title is required'),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      validation: (Rule) => Rule.required().error('A slug is required'),
      options: {
        source: 'title',
      },
    }),
    defineField({
      name: 'media',
      title: 'Media',
      type: 'array',
      validation: (Rule) => Rule.min(1).error('At least one media item is required'),
      of: [
        defineArrayMember({
          type: 'selfHostedMedia',
        })
      ],
      components: {
        input: BulkMediaUpload,
      },
    }),
  ],
  preview: {
    select: {
      title: 'title',
      firstMedia: 'media.0',
    },
    prepare({ title, firstMedia }) {
      const imageUrl = firstMedia?.mediaType === 'image' ? firstMedia?.url : undefined;
      return {
        title,
        media: imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : undefined,
      }
    },
  },
})
