import { definePlugin } from 'sanity';
import { ImageIcon } from '@sanity/icons';
import { MediaBrowserTool } from './MediaBrowserTool';

export const mediaBrowser = definePlugin({
  name: 'media-browser',
  tools: [
    {
      name: 'media-browser',
      title: 'Media',
      icon: ImageIcon,
      component: MediaBrowserTool,
    },
  ],
});
