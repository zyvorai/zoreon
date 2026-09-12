import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import FeatureHighlights from '@site/src/components/FeatureHighlights';
import Reveal from '@site/src/components/Reveal';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className={clsx(styles.heroGridSingle, 'text--center')}>
          <Heading as="h1" className="hero__title">
            Ops chat for
            <br />
            infrastructure cutovers.
          </Heading>
          <p className="hero__subtitle">
            War rooms, threads, huddles, and runbooks — on your estate.
            Mattermost is the tape. Zoreon is the product: Better Auth,
            realtime SSE, in-channel WebRTC huddles, and a Postgres layer
            for invites, stars, pins, and search — self-hosted via Compose,
            Helm, or podman/systemd.
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary button--lg"
              to="https://github.com/zyvorai/zoreon#quick-start">
              Get Started
            </Link>
            <Link
              className="button button--outline button--lg button--secondary"
              to="https://github.com/zyvorai/zoreon">
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function ProblemStatement() {
  return (
    <section className={styles.problem}>
      <div className="container">
        <Reveal className="row">
          <div className="col col--8 col--offset-2 text--center">
            <Heading as="h2" className={styles.sectionHeading}>
              Why Zoreon
            </Heading>
            <p>
              Cutover programs need a war room that lives next to the
              tape — not another SaaS chat island disconnected from the
              runbooks and the infrastructure it's coordinating.
            </p>
            <p>
              Zoreon gives you channels, threads, and huddles built for
              that moment: stars, pins, remind-in-1h, and war-room waves on
              top of the usual chat basics, with Mattermost as an optional
              durable tape when you already run it. Self-host it on your
              network, with your secrets.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TrustBand() {
  return (
    <section className={styles.trust}>
      <div className="container">
        <Reveal className={styles.trustGrid}>
          <div>
            <Heading as="h3" className={styles.sectionHeading}>
              Self-hosted, MIT licensed
            </Heading>
            <p>
              MIT license — your network, your secrets. CI runs unit tests,
              HTTP smoke tests, and Playwright end-to-end tests (with a
              Postgres service) on every push and PR to main.
            </p>
            <Link to="/docs/ARCHITECTURE">Read the architecture →</Link>
          </div>
          <div className={styles.trustBadges}>
            <img
              src="https://github.com/zyvorai/zoreon/actions/workflows/ci.yml/badge.svg"
              alt="CI status"
            />
            <img
              src="https://img.shields.io/badge/License-MIT-0f1115.svg"
              alt="MIT license"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function EnterpriseCTA() {
  return (
    <section className={styles.enterprise}>
      <div className="container text--center">
        <Reveal>
          <Heading as="h2" className={styles.sectionHeading}>
            Deploying for your organization?
          </Heading>
          <p className={styles.enterpriseCopy}>
            The full lifecycle guide — bootstrap admin, TLS, SMTP, and
            optional Mattermost integration — is in the customer deploy
            doc. Kubernetes deployments use the included Helm chart.
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/docs/CUSTOMER">
              Read the deploy guide
            </Link>
            <Link
              className="button button--outline button--lg button--secondary"
              to="/docs/HELM">
              Kubernetes / Helm
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Zoreon — ops chat for infrastructure cutovers"
      description="War rooms, threads, huddles, and runbooks — on your estate. Self-hosted ops chat for infrastructure cutover programs.">
      <HomepageHeader />
      <main>
        <ProblemStatement />
        <Reveal>
          <FeatureHighlights />
        </Reveal>
        <TrustBand />
        <EnterpriseCTA />
      </main>
    </Layout>
  );
}
