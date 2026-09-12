import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Zoreon',
  tagline: 'Ops chat for infrastructure cutovers — war rooms, threads, huddles, and runbooks on your estate.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://zyvorai.github.io',
  baseUrl: '/zoreon/',

  organizationName: 'zyvorai',
  projectName: 'zoreon',

  onBrokenLinks: 'warn',

  markdown: {
    format: 'md',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/zyvorai/zoreon/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      hideOnScroll: false,
      title: 'Zoreon',
      logo: {
        alt: 'Zoreon',
        src: 'img/favicon.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'right',
          label: 'Docs',
        },
        {
          href: 'https://github.com/zyvorai/zoreon',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Deploy (Compose/Helm/podman)', to: '/docs/DEPLOY'},
            {label: 'For organizations', to: '/docs/CUSTOMER'},
            {label: 'Architecture', to: '/docs/ARCHITECTURE'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'GitHub', href: 'https://github.com/zyvorai/zoreon'},
            {
              label: 'License (MIT)',
              href: 'https://github.com/zyvorai/zoreon/blob/main/LICENSE',
            },
          ],
        },
        {
          title: 'Zyvor',
          items: [{label: 'zyvor.dev', href: 'https://zyvor.dev'}],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Zyvor AI Labs. Zoreon is MIT licensed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
