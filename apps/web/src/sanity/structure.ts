import type {StructureResolver} from 'sanity/structure'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Feed')
    .items([
      S.listItem()
        .title('Frontpage')
        .id('frontpage')
        .child(
          S.document()
            .schemaType('frontpage')
            .documentId('frontpage')
            .title('Frontpage'),
        ),
      S.divider(),
      S.documentTypeListItem('post').title('Posts'),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => item.getId() && !['post', 'frontpage'].includes(item.getId()!),
      ),
    ])
