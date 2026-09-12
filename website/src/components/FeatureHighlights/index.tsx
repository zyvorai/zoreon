import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
  to: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Better Auth, invite-gated',
    description:
      'Email/password plus Google and X sign-in, with invite-gated join — multi-use links, SMTP send, or plain mailto.',
    to: '/docs/CUSTOMER',
  },
  {
    title: 'Mattermost tape (optional)',
    description:
      'Durable channel history when you already run Mattermost — Zoreon is the product surface, Mattermost stays the tape underneath.',
    to: '/docs/ARCHITECTURE',
  },
  {
    title: 'Realtime across replicas',
    description:
      'Server-sent events plus Postgres LISTEN/NOTIFY keep channels, threads, and presence live across multiple app replicas.',
    to: '/docs/ARCHITECTURE',
  },
  {
    title: 'In-channel huddles',
    description:
      'WebRTC audio/video huddles right inside a channel, for the moment a thread stops being enough.',
    to: '/docs/ARCHITECTURE',
  },
  {
    title: 'Cutover-specific extras',
    description:
      'Stars, pins, bookmarks, remind-in-1h, and war-room waves — plus a search palette with from:/in:/has:/before:/after: filters and saved searches.',
    to: 'https://github.com/zyvorai/zoreon#what-you-get',
  },
  {
    title: 'Self-host: Compose, Helm, or podman',
    description:
      'Docker Compose for the fastest path, a Helm chart for Kubernetes, or scripts/deploy-remote.sh for podman + systemd + HTTPS on a single host.',
    to: '/docs/DEPLOY',
  },
];

function Feature({title, description, to}: FeatureItem) {
  return (
    <div className="col col--4">
      <Link to={to} className={styles.card}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </Link>
    </div>
  );
}

export default function FeatureHighlights(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
