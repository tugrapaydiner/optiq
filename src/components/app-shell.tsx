import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import chartExplorationImage from "../assets/images/optiq-chart-exploration.png";
import diagramNavigationImage from "../assets/images/optiq-diagram-navigation.png";
import heroImage from "../assets/images/optiq-hero-accessible-learning.png";
import teacherReviewImage from "../assets/images/optiq-teacher-review.png";
import optiqLogo from "../assets/logo.png";

const navigationItems = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#accessibility", label: "Accessibility" },
  { href: "/examples", label: "Examples" },
] as const;

const productStories = [
  {
    alt: "A learner wearing headphones explores chart information beside a laptop and printed graphs.",
    body: "Exact values in a native table, with keyboard exploration and optional sound.",
    headline: "Every value becomes explorable.",
    id: "charts",
    image: chartExplorationImage,
  },
  {
    alt: "An educator reviews lesson materials, charts, and notes beside a laptop.",
    body: "Review every label, value, relationship, and reading-order choice before export.",
    headline: "Educators keep the final say.",
    id: "teacher-review",
    image: teacherReviewImage,
  },
  {
    alt: "A learner arranges connected process steps while working beside a laptop.",
    body: "Turn connected steps into a clear order students can navigate by keyboard or screen reader.",
    headline: "Relationships stay connected.",
    id: "process-diagrams",
    image: diagramNavigationImage,
  },
] satisfies ReadonlyArray<{
  alt: string;
  body: string;
  headline: string;
  id: string;
  image: StaticImageData;
}>;

function BrandMark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-logo-window brand-logo-window-${tone}`}
    >
      <Image
        alt=""
        className={`brand-logo brand-logo-${tone}`}
        height={1086}
        preload
        sizes={tone === "light" ? "240px" : "132px"}
        src={optiqLogo}
        width={1448}
      />
    </span>
  );
}

function SiteHeader() {
  return (
    <header className="site-header" id="page-top">
      <div className="page-shell header-inner">
        <nav aria-label="Primary navigation" className="desktop-navigation">
          {navigationItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <Link aria-label="Optiq home" className="wordmark" href="/">
          <BrandMark />
        </Link>

        <Link className="button button-primary header-action" href="/create">
          Create a lesson
        </Link>

        <details className="mobile-navigation">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {navigationItems.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="button button-primary" href="/create">
              Create a lesson
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-inner">
        <div className="footer-mission">
          <Link aria-label="Optiq home" className="footer-brand" href="/">
            <BrandMark tone="light" />
          </Link>
          <p>Accessible learning from charts and process diagrams.</p>
        </div>

        <div className="footer-links">
          <nav aria-labelledby="footer-product-heading">
            <h2 id="footer-product-heading">Product</h2>
            <Link href="/#product">Product</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#accessibility">Accessibility</Link>
            <Link href="/examples">Examples</Link>
          </nav>
          <nav aria-labelledby="footer-explore-heading">
            <h2 id="footer-explore-heading">Explore</h2>
            <Link href="/create">Create a lesson</Link>
            <Link href="/examples#charts">Charts</Link>
            <Link href="/examples#process-diagrams">Process diagrams</Link>
            <Link href="/create#privacy">Privacy approach</Link>
          </nav>
        </div>

        <p className="footer-bottom">Optiq · Tugrap Turker Aydiner</p>
      </div>
    </footer>
  );
}

function SitePage({ children }: { children: ReactNode }) {
  return (
    <>
      <Link className="skip-link" href="#main-content">
        Skip to main content
      </Link>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}

function EditorialHero() {
  return (
    <>
      <div className="hero-media page-frame">
        <Image
          alt="Two learners work with laptops, headphones, and printed diagrams outdoors at sunset."
          className="hero-image"
          height={829}
          preload
          sizes="(max-width: 768px) calc(100vw - 32px), calc(100vw - 64px)"
          src={heroImage}
          width={1896}
        />
      </div>

      <section
        aria-labelledby="page-title"
        className="editorial-statement section-shell"
      >
        <h1 id="page-title">
          <span>Visual lessons,</span>{" "}
          <span className="muted-heading">made accessible.</span>
        </h1>
        <p className="body-large statement-copy">
          Turn charts and process diagrams into lessons students can read, hear,
          and explore.
        </p>
        <div className="button-row">
          <Link className="button button-primary" href="/create">
            Create a lesson
          </Link>
          <Link className="button button-secondary" href="/#how-it-works">
            See how it works
          </Link>
        </div>
        <p className="quiet-note">AI drafts. Educators decide.</p>
      </section>
    </>
  );
}

function ProductOverview() {
  return (
    <section
      aria-labelledby="product-heading"
      className="product-overview"
      id="product"
    >
      <div className="section-shell">
        <div className="section-introduction product-introduction">
          <h2 id="product-heading">
            <span>Keep the structure.</span>{" "}
            <span className="muted-heading">Open more ways in.</span>
          </h2>
          <p className="body-large">
            Exact data, ordered relationships, and teacher control stay part of
            the lesson.
          </p>
        </div>

        <div className="product-overview-grid">
          <div className="product-overview-image-frame">
            <Image
              alt="An educator reviews lesson materials, charts, and notes beside a laptop."
              className="product-overview-image"
              height={1086}
              sizes="(max-width: 900px) calc(100vw - 32px), 65vw"
              src={teacherReviewImage}
              width={1448}
            />
          </div>

          <dl className="product-capabilities">
            <div>
              <dt>Exact values</dt>
              <dd>Native tables preserve the information students need.</dd>
            </div>
            <div>
              <dt>Clear order</dt>
              <dd>Process steps remain connected and keyboard navigable.</dd>
            </div>
            <div>
              <dt>Human review</dt>
              <dd>Educators correct the draft before anything is exported.</dd>
            </div>
          </dl>
        </div>

        <Link className="text-link" href="/examples">
          Explore the examples <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="how-it-works"
      id="how-it-works"
    >
      <div className="section-shell">
        <div className="section-introduction how-introduction">
          <h2 id="how-heading">
            <span>One clear path,</span>{" "}
            <span className="muted-heading">from visual to lesson.</span>
          </h2>
          <Link className="button button-primary" href="/create">
            Open the studio
          </Link>
        </div>

        <ol className="journey-list">
          <li>
            <strong>Add one visual.</strong>
            <span>Chart or process diagram.</span>
          </li>
          <li>
            <strong>Review the draft.</strong>
            <span>Correct labels, values, and order.</span>
          </li>
          <li>
            <strong>Share with confidence.</strong>
            <span>Export only after teacher review.</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

function AccessibilityPrinciples() {
  return (
    <section
      aria-labelledby="accessibility-heading"
      className="accessibility-principles"
      id="accessibility"
    >
      <div className="section-shell">
        <div className="section-introduction principle-introduction">
          <h2 id="accessibility-heading">
            <span>Accessibility is not</span>{" "}
            <span className="muted-heading">a final checkbox.</span>
          </h2>
          <p className="body-large">
            Uncertainty stays visible. Educators stay in control. Students get
            more than a single description.
          </p>
        </div>

        <dl className="principle-list">
          <div>
            <dt>Exact information</dt>
            <dd>Values, labels, units, and relationships stay structured.</dd>
          </div>
          <div>
            <dt>Teacher control</dt>
            <dd>Educators correct the lesson before it is exported.</dd>
          </div>
          <div>
            <dt>Multiple ways to explore</dt>
            <dd>Use text, tables, keyboard navigation, and optional sound.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function FinalCallToAction() {
  return (
    <section aria-labelledby="final-cta-heading" className="final-cta">
      <div className="section-shell">
        <h2 id="final-cta-heading">
          <span>Make every visual</span>{" "}
          <span className="muted-heading">part of the lesson.</span>
        </h2>
        <p className="body-large">Start with one clear image.</p>
        <div className="button-row">
          <Link className="button button-primary" href="/create">
            Create a lesson
          </Link>
          <Link className="button button-secondary" href="/examples">
            View examples
          </Link>
        </div>
      </div>
    </section>
  );
}

function WorkflowProgress() {
  return (
    <ol aria-label="Lesson creation progress" className="workflow-progress">
      <li aria-current="step">
        <span className="visually-hidden">Current step: </span>
        Source
      </li>
      <li>Review</li>
      <li>Preview</li>
      <li>Export</li>
    </ol>
  );
}

function VisualTypeSelector() {
  return (
    <section aria-labelledby="visual-type-heading" className="visual-type-panel">
      <h2 id="visual-type-heading">Choose the visual</h2>
      <fieldset>
        <legend>Visual type</legend>
        <div className="mode-grid">
          <label className="mode-option">
            <input
              className="visually-hidden"
              defaultChecked
              name="mode"
              type="radio"
              value="chart"
            />
            <span aria-hidden="true" className="selector-check">
              ✓
            </span>
            <span className="mode-copy">
              <span className="mode-title">Chart</span>
              <span className="mode-description">
                Bar or line chart with numeric values.
              </span>
            </span>
          </label>

          <label className="mode-option">
            <input
              className="visually-hidden"
              name="mode"
              type="radio"
              value="process"
            />
            <span aria-hidden="true" className="selector-check">
              ✓
            </span>
            <span className="mode-copy">
              <span className="mode-title">Process diagram</span>
              <span className="mode-description">
                Labelled steps in a meaningful order.
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </section>
  );
}

function SourceUploader() {
  return (
    <section aria-labelledby="upload-heading" className="upload-panel">
      <h2 id="upload-heading">Add the image</h2>
      <p id="upload-help">PNG, JPEG, or WebP · Up to 10 MB</p>

      <label className="visually-hidden" htmlFor="visual-file">
        Image file
      </label>
      <input
        accept="image/png,image/jpeg,image/webp"
        aria-describedby="upload-help preview-status"
        className="visually-hidden"
        disabled
        id="visual-file"
        type="file"
      />

      <div className="upload-surface">
        <span aria-hidden="true" className="upload-mark">
          +
        </span>
        <strong>Drop it here</strong>
        <span>or choose from your device</span>
        <span className="inactive-file-action">Choose a file</span>
      </div>

      <div className="analysis-actions">
        <button className="button button-primary" disabled type="button">
          Analyze source
        </button>
        <p className="preview-status" id="preview-status">
          <span aria-hidden="true" />
          Analysis is not connected in this preview.
        </p>
      </div>
    </section>
  );
}

export function LessonStudioPage() {
  return (
    <SitePage>
      <main className="studio-main" id="main-content" tabIndex={-1}>
        <section aria-labelledby="studio-title" className="studio-hero">
          <div className="section-shell studio-introduction">
            <h1 id="studio-title">
              <span>Start with</span>{" "}
              <span className="muted-heading">one visual.</span>
            </h1>
            <p className="body-large">
              Choose a chart or process diagram, then add one clear image.
            </p>
          </div>
        </section>

        <section
          aria-label="Create an accessible lesson"
          className="studio-section"
          id="create"
        >
          <div className="section-shell">
            <WorkflowProgress />
            <div className="studio-workspace">
              <VisualTypeSelector />
              <SourceUploader />
            </div>
            <div className="studio-footnotes">
              <p>
                <strong>Review required before export.</strong> Resolve uncertain
                details first.
              </p>
              <p id="privacy">
                When connected, images are sent to OpenAI under applicable API
                data controls. Optiq does not save the upload.
              </p>
            </div>
          </div>
        </section>
      </main>
    </SitePage>
  );
}

function ExampleStory({
  alt,
  body,
  headline,
  id,
  image,
}: (typeof productStories)[number]) {
  return (
    <article className="example-story" id={id}>
      <div className="example-image-frame">
        <Image
          alt={alt}
          className="example-image"
          height={1086}
          sizes="(max-width: 900px) calc(100vw - 32px), 58vw"
          src={image}
          width={1448}
        />
      </div>
      <div className="example-copy">
        <h2>{headline}</h2>
        <p>{body}</p>
      </div>
    </article>
  );
}

export function ExamplesPageShell() {
  return (
    <SitePage>
      <main id="main-content" tabIndex={-1}>
        <section aria-labelledby="examples-title" className="subpage-hero">
          <div className="section-shell">
            <h1 id="examples-title">
              <span>See the visual.</span>{" "}
              <span className="muted-heading">Explore the structure.</span>
            </h1>
            <p className="body-large">
              Three ways Optiq turns visual information into an accessible
              learning experience.
            </p>
          </div>
        </section>

        <section aria-label="Optiq examples" className="examples-page">
          <div className="section-shell">
            {productStories.map((story) => (
              <ExampleStory key={story.id} {...story} />
            ))}
          </div>
        </section>

        <FinalCallToAction />
      </main>
    </SitePage>
  );
}

export function AppShell() {
  return (
    <SitePage>
      <main id="main-content" tabIndex={-1}>
        <EditorialHero />
        <ProductOverview />
        <HowItWorks />
        <AccessibilityPrinciples />
        <FinalCallToAction />
      </main>
    </SitePage>
  );
}
