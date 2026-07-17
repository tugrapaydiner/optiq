import Image, { type StaticImageData } from "next/image";

import chartExplorationImage from "../assets/images/optiq-chart-exploration.png";
import diagramNavigationImage from "../assets/images/optiq-diagram-navigation.png";
import heroImage from "../assets/images/optiq-hero-accessible-learning.png";
import teacherReviewImage from "../assets/images/optiq-teacher-review.png";
import optiqLogo from "../assets/logo.png";
import { TransitionLink } from "./transition-link";

const navigationItems = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/accessibility", label: "Accessibility" },
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
        loading={tone === "dark" ? "eager" : "lazy"}
        sizes={tone === "light" ? "240px" : "132px"}
        src={optiqLogo}
        width={1448}
      />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header" id="page-top">
      <div className="page-shell header-inner">
        <nav aria-label="Primary navigation" className="desktop-navigation">
          {navigationItems.map((item) => (
            <TransitionLink href={item.href} key={item.href}>
              {item.label}
            </TransitionLink>
          ))}
        </nav>

        <TransitionLink aria-label="Optiq home" className="wordmark" href="/">
          <BrandMark />
        </TransitionLink>

        <TransitionLink
          className="button button-primary header-action"
          href="/create"
        >
          Create a lesson
        </TransitionLink>

        <details className="mobile-navigation">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {navigationItems.map((item) => (
              <TransitionLink href={item.href} key={item.href}>
                {item.label}
              </TransitionLink>
            ))}
            <TransitionLink className="button button-primary" href="/create">
              Create a lesson
            </TransitionLink>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-inner">
        <div className="footer-mission">
          <TransitionLink aria-label="Optiq home" className="footer-brand" href="/">
            <BrandMark tone="light" />
          </TransitionLink>
          <p>Accessible learning from charts and process diagrams.</p>
        </div>

        <div className="footer-links">
          <nav aria-labelledby="footer-product-heading">
            <h2 id="footer-product-heading">Product</h2>
            <TransitionLink href="/product">Product</TransitionLink>
            <TransitionLink href="/how-it-works">How it works</TransitionLink>
            <TransitionLink href="/accessibility">Accessibility</TransitionLink>
            <TransitionLink href="/examples">Examples</TransitionLink>
          </nav>
          <nav aria-labelledby="footer-explore-heading">
            <h2 id="footer-explore-heading">Explore</h2>
            <TransitionLink href="/create">Create a lesson</TransitionLink>
            <TransitionLink href="/examples#charts">Charts</TransitionLink>
            <TransitionLink href="/examples#process-diagrams">
              Process diagrams
            </TransitionLink>
            <TransitionLink href="/create#privacy">Privacy approach</TransitionLink>
          </nav>
        </div>

        <p className="footer-bottom">Optiq · Tugrap Turker Aydiner</p>
      </div>
    </footer>
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
          <TransitionLink className="button button-primary" href="/create">
            Create a lesson
          </TransitionLink>
          <TransitionLink className="button button-secondary" href="/product">
            Explore the product
          </TransitionLink>
        </div>
        <p className="quiet-note">AI drafts. Educators decide.</p>
      </section>
    </>
  );
}

function HomeIndex() {
  return (
    <section aria-labelledby="home-index-heading" className="home-index">
      <div className="section-shell home-index-grid">
        <div>
          <h2 id="home-index-heading">
            <span>See Optiq</span>{" "}
            <span className="muted-heading">from every angle.</span>
          </h2>
          <p className="body-large">Each part now has room to breathe.</p>
        </div>
        <nav aria-label="Explore Optiq" className="page-directory">
          {navigationItems.map((item, index) => (
            <TransitionLink href={item.href} key={item.href}>
              <span aria-hidden="true">0{index + 1}</span>
              <strong>{item.label}</strong>
              <span aria-hidden="true">→</span>
            </TransitionLink>
          ))}
        </nav>
      </div>
    </section>
  );
}

function PageHero({
  copy,
  headingId,
  muted,
  primary,
}: {
  copy: string;
  headingId: string;
  muted: string;
  primary: string;
}) {
  return (
    <section aria-labelledby={headingId} className="subpage-hero">
      <div className="section-shell">
        <h1 id={headingId}>
          <span>{primary}</span>{" "}
          <span className="muted-heading">{muted}</span>
        </h1>
        <p className="body-large">{copy}</p>
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
          <TransitionLink className="button button-primary" href="/create">
            Create a lesson
          </TransitionLink>
          <TransitionLink className="button button-secondary" href="/examples">
            View examples
          </TransitionLink>
        </div>
      </div>
    </section>
  );
}

export function AppShell() {
  return (
    <main id="main-content" tabIndex={-1}>
      <EditorialHero />
      <HomeIndex />
      <FinalCallToAction />
    </main>
  );
}

export function ProductPageShell() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        copy="Optiq keeps exact information and human judgment inside the accessible lesson."
        headingId="product-title"
        muted="Change the access."
        primary="Keep the visual."
      />

      <section aria-label="Optiq product capabilities" className="feature-spread">
        <div className="section-shell feature-spread-grid">
          <div className="feature-image-frame">
            <Image
              alt="A learner wearing headphones explores chart information beside a laptop and printed graphs."
              className="feature-image"
              height={1086}
              sizes="(max-width: 900px) calc(100vw - 32px), 62vw"
              src={chartExplorationImage}
              width={1448}
            />
          </div>
          <dl className="feature-list">
            <div>
              <dt>Exact values</dt>
              <dd>Chart data remains available in a native table.</dd>
            </div>
            <div>
              <dt>Clear relationships</dt>
              <dd>Process steps keep their direction and reading order.</dd>
            </div>
            <div>
              <dt>More ways to explore</dt>
              <dd>Students can use text, keyboard navigation, and optional sound.</dd>
            </div>
            <div>
              <dt>Teacher control</dt>
              <dd>Every draft is reviewed before standalone export.</dd>
            </div>
          </dl>
        </div>
      </section>

      <FinalCallToAction />
    </main>
  );
}

const workflowStages = [
  {
    body: "Choose chart or process diagram, then add one clear image.",
    title: "Source",
  },
  {
    body: "Optiq structures what is visible and surfaces uncertainty.",
    title: "Review",
  },
  {
    body: "Check the table, reading order, keyboard flow, and optional sound.",
    title: "Preview",
  },
  {
    body: "Create standalone HTML only after teacher review is complete.",
    title: "Export",
  },
] as const;

export function HowItWorksPageShell() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        copy="A short workflow keeps interpretation visible and educators in control."
        headingId="how-title"
        muted="One accountable path."
        primary="Four deliberate stages."
      />

      <section aria-labelledby="workflow-detail-heading" className="workflow-detail">
        <div className="section-shell">
          <div className="workflow-image-frame">
            <Image
              alt="A learner arranges connected process steps while working beside a laptop."
              className="workflow-image"
              height={1086}
              sizes="(max-width: 900px) calc(100vw - 32px), calc(100vw - 64px)"
              src={diagramNavigationImage}
              width={1448}
            />
          </div>
          <h2 className="visually-hidden" id="workflow-detail-heading">
            Lesson creation stages
          </h2>
          <ol className="workflow-rows">
            {workflowStages.map((stage, index) => (
              <li key={stage.title}>
                <span aria-hidden="true">0{index + 1}</span>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <FinalCallToAction />
    </main>
  );
}

export function AccessibilityPageShell() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        copy="Structured information, visible uncertainty, and teacher review shape the experience from the beginning."
        headingId="accessibility-title"
        muted="in the structure."
        primary="Access starts"
      />

      <section aria-labelledby="principles-heading" className="principles-page">
        <div className="section-shell principles-layout">
          <div className="principles-image-frame">
            <Image
              alt="An educator reviews lesson materials, charts, and notes beside a laptop."
              className="principles-image"
              height={1086}
              sizes="(max-width: 900px) calc(100vw - 32px), 58vw"
              src={teacherReviewImage}
              width={1448}
            />
          </div>
          <div>
            <h2 id="principles-heading">Built around three commitments.</h2>
            <dl className="principle-list principle-list-stacked">
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
        </div>
      </section>

      <FinalCallToAction />
    </main>
  );
}

function StudioProgress() {
  return (
    <ol aria-label="Lesson creation progress" className="studio-progress">
      {workflowStages.map((stage, index) => (
        <li aria-current={index === 0 ? "step" : undefined} key={stage.title}>
          <span aria-hidden="true">0{index + 1}</span>
          <strong>{stage.title}</strong>
        </li>
      ))}
    </ol>
  );
}

function VisualTypeSelector() {
  return (
    <section aria-labelledby="visual-type-heading" className="source-kind">
      <div className="studio-section-heading">
        <span aria-hidden="true">01</span>
        <div>
          <h2 id="visual-type-heading">What does the image show?</h2>
          <p>Choose the structure students need to explore.</p>
        </div>
      </div>

      <fieldset>
        <legend>Visual type</legend>
        <div className="source-choice-list">
          <label className="source-choice">
            <input
              className="visually-hidden"
              defaultChecked
              name="mode"
              type="radio"
              value="chart"
            />
            <span aria-hidden="true" className="source-choice-number">
              A
            </span>
            <span className="source-choice-copy">
              <span className="source-choice-title">Chart</span>
              <span>Bar or line chart with labelled numeric values.</span>
            </span>
            <span aria-hidden="true" className="source-choice-state">
              Selected
            </span>
          </label>

          <label className="source-choice">
            <input
              className="visually-hidden"
              name="mode"
              type="radio"
              value="process"
            />
            <span aria-hidden="true" className="source-choice-number">
              B
            </span>
            <span className="source-choice-copy">
              <span className="source-choice-title">Process diagram</span>
              <span>Labelled steps connected in a meaningful order.</span>
            </span>
            <span aria-hidden="true" className="source-choice-state">
              Choose
            </span>
          </label>
        </div>
      </fieldset>
    </section>
  );
}

function SourceUploader() {
  return (
    <section aria-labelledby="upload-heading" className="source-upload">
      <div className="studio-section-heading">
        <span aria-hidden="true">02</span>
        <div>
          <h2 id="upload-heading">Add one clear source.</h2>
          <p>Use a readable image without sensitive or student-identifying content.</p>
        </div>
      </div>

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

      <div className="upload-editorial">
        <div className="upload-copy">
          <span aria-hidden="true" className="upload-symbol">
            +
          </span>
          <div>
            <strong>Drop an image here</strong>
            <span id="upload-help">PNG, JPEG, or WebP · Up to 10 MB</span>
          </div>
        </div>
        <button className="upload-choice" disabled type="button">
          Choose a file
        </button>
      </div>

      <div className="studio-actionbar">
        <button className="button button-primary" disabled type="button">
          Analyze source
        </button>
        <p className="preview-status" id="preview-status">
          <span aria-hidden="true" />
          Analysis is unavailable in this static preview.
        </p>
      </div>
    </section>
  );
}

export function LessonStudioPage() {
  return (
    <main className="studio-main" id="main-content" tabIndex={-1}>
      <section aria-labelledby="studio-title" className="studio-editorial-hero">
        <div className="section-shell studio-title-grid">
          <h1 id="studio-title">
            <span>Build from</span>{" "}
            <span className="muted-heading">the source.</span>
          </h1>
          <p className="body-large">
            One visual. A structured draft. Teacher review before export.
          </p>
        </div>
      </section>

      <section aria-label="Create an accessible lesson" className="studio-editor">
        <div className="section-shell">
          <StudioProgress />
          <VisualTypeSelector />
          <SourceUploader />
          <div className="studio-notes">
            <p>
              <strong>Review is required.</strong> Uncertain details must be resolved
              before standalone export.
            </p>
            <p id="privacy">
              When connected, your image is sent to OpenAI. Optiq does not
              intentionally save uploaded images.
            </p>
          </div>
        </div>
      </section>
    </main>
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
    <main id="main-content" tabIndex={-1}>
      <PageHero
        copy="Three views of the same idea: preserve the information, then open more ways to explore it."
        headingId="examples-title"
        muted="Explore the structure."
        primary="See the visual."
      />

      <section aria-label="Optiq examples" className="examples-page">
        <div className="section-shell">
          {productStories.map((story) => (
            <ExampleStory key={story.id} {...story} />
          ))}
        </div>
      </section>

      <FinalCallToAction />
    </main>
  );
}
