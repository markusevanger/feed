import { DocumentTextIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

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
      name: 'images',
      title: 'Images',
      type: 'array',
      validation: (Rule) => Rule.min(1).error('At least one image is required'),
      of: [
        defineArrayMember({
          type: 'image',
          options: {
            metadata: [
              'blurhash',
              'lqip',
              'palette',
              'image',
              'exif',
              'location',
            ]
          },
          validation: (Rule) => Rule.required().error('Each image is required') // Ensure individual images are required
        })
      ],
    }),

    defineField({
      name: 'videos',
      title: 'Videos',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'file',
          options: {
            accept: 'video/*'
          },
          validation: (Rule) => Rule.required().error('Each video is required')
        })
      ],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'images.0',
    },
    prepare(selection) {
      return { ...selection }
    },
  },
})
