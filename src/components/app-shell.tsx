import Image from "next/image";

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

const homeIndexNotes: Record<(typeof navigationItems)[number]["href"], string> =
  {
    "/product": "What students receive from each visual.",
    "/how-it-works": "The four stages of a lesson.",
    "/accessibility": "The commitments behind the design.",
    "/examples": "The two supported lesson formats.",
  };

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

function PageClose({ href, label }: { href: string; label: string }) {
  return (
    <nav aria-label="Continue" className="page-close">
      <div className="section-shell page-close-inner">
        <TransitionLink className="page-close-link" href={href}>
          Next: {label}
        </TransitionLink>
      </div>
    </nav>
  );
}

function EditorialHero() {
  return (
    <>
      <div className="hero-media">
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
        <p className="quiet-note">
          Every draft is reviewed by a teacher before students see it.
        </p>
      </section>
    </>
  );
}

function HomeIndex() {
  return (
    <section aria-labelledby="home-index-heading" className="home-index">
      <div className="section-shell">
        <h2 className="visually-hidden" id="home-index-heading">
          More about Optiq
        </h2>
        <nav aria-label="Explore Optiq" className="page-directory">
          {navigationItems.map((item) => (
            <TransitionLink href={item.href} key={item.href}>
              <strong>{item.label}</strong>
              <span className="directory-note">{homeIndexNotes[item.href]}</span>
            </TransitionLink>
          ))}
        </nav>
      </div>
    </section>
  );
}

export function AppShell() {
  return (
    <main id="main-content" tabIndex={-1}>
      <EditorialHero />
      <HomeIndex />
    </main>
  );
}

export function ProductPageShell() {
  return (
    <main className="information-page" id="main-content" tabIndex={-1}>
      <div className="information-content">
        <section aria-labelledby="product-title" className="page-intro product-intro">
          <div className="section-shell page-intro-split">
            <h1 id="product-title">
              <span>Keep the visual.</span>{" "}
              <span className="muted-heading">Change the access.</span>
            </h1>
            <p className="body-large">
              Two visual types. Exact information, teacher review, and more ways
              to explore.
            </p>
          </div>
        </section>

        <section aria-labelledby="experiences-heading" className="product-overview">
          <div className="section-shell product-overview-grid">
            <div className="product-photo-frame">
              <Image
                alt="A learner wearing headphones explores chart information beside a laptop and printed graphs."
                className="product-photo"
                height={1086}
                quality={92}
                sizes="(max-width: 900px) calc(100vw - 32px), 54vw"
                src={chartExplorationImage}
                width={1448}
              />
            </div>
            <div className="product-capabilities">
              <h2 id="experiences-heading">Two experiences</h2>
              <article className="experience">
                <h3>Bar and line charts</h3>
                <p>
                  Exact values stay in a native table. Students move by keyboard
                  and can choose to hear the data as sound.
                </p>
              </article>
              <article className="experience">
                <h3>Process diagrams</h3>
                <p>
                  Steps keep their names, order, and connections. Students follow
                  the path by keyboard or screen reader.
                </p>
              </article>
              <p className="review-line">Teacher review is required before export.</p>
            </div>
          </div>
        </section>
      </div>
      <PageClose href="/how-it-works" label="How it works" />
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
    <main className="information-page" id="main-content" tabIndex={-1}>
      <div className="information-content">
        <section aria-labelledby="how-title" className="page-intro how-intro">
          <div className="section-shell">
            <h1 id="how-title">
              <span>Four deliberate stages.</span>{" "}
              <span className="muted-heading">One accountable path.</span>
            </h1>
            <p className="body-large">
              From one clear image to a lesson students can explore. An educator
              approves every step that matters.
            </p>
          </div>
        </section>

        <section aria-labelledby="workflow-detail-heading" className="workflow-detail">
          <div className="section-shell">
            <h2 className="visually-hidden" id="workflow-detail-heading">
              Lesson creation stages
            </h2>
            <ol className="workflow-rail">
              {workflowStages.map((stage) => (
                <li key={stage.title}>
                  <strong>{stage.title}</strong>
                  <p>{stage.body}</p>
                </li>
              ))}
            </ol>
            <div className="workflow-image-frame">
              <Image
                alt="A learner arranges connected process steps while working beside a laptop."
                className="workflow-image"
                height={1086}
                sizes="(max-width: 900px) calc(100vw - 32px), 1200px"
                src={diagramNavigationImage}
                width={1448}
              />
            </div>
          </div>
        </section>
      </div>

      <PageClose href="/accessibility" label="Accessibility" />
    </main>
  );
}

export function AccessibilityPageShell() {
  return (
    <main className="information-page" id="main-content" tabIndex={-1}>
      <div className="information-content">
        <section
          aria-labelledby="accessibility-title"
          className="page-intro accessibility-intro"
        >
          <div className="section-shell accessibility-intro-inner">
            <h1 id="accessibility-title">
              <span>Access starts</span>{" "}
              <span className="muted-heading">in the structure.</span>
            </h1>
            <p className="body-large">
              Optiq keeps values, labels, relationships, and uncertainty
              available from the start.
            </p>
          </div>
        </section>

        <section aria-labelledby="principles-heading" className="principles-page">
          <div className="section-shell principles-layout">
            <div className="principles-image-frame">
              <Image
                alt="An educator reviews lesson materials, charts, and notes beside a laptop."
                className="principles-image"
                height={1086}
                quality={92}
                sizes="(max-width: 900px) calc(100vw - 32px), 58vw"
                src={teacherReviewImage}
                width={1448}
              />
            </div>
            <div className="principles-copy">
              <h2 id="principles-heading">Three commitments.</h2>
              <dl className="principle-list">
                <div>
                  <dt>Keep the facts</dt>
                  <dd>Values, labels, units, and relationships stay structured.</dd>
                </div>
                <div>
                  <dt>Keep people in control</dt>
                  <dd>Educators correct every draft before export.</dd>
                </div>
                <div>
                  <dt>Offer more than text</dt>
                  <dd>Students use tables, keys, reading order, and optional sound.</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>

      <PageClose href="/examples" label="Examples" />
    </main>
  );
}

function StudioProgress() {
  return (
    <ol aria-label="Lesson creation progress" className="studio-progress">
      {workflowStages.map((stage, index) => (
        <li aria-current={index === 0 ? "step" : undefined} key={stage.title}>
          {stage.title}
        </li>
      ))}
    </ol>
  );
}

function VisualTypeSelector() {
  return (
    <section aria-labelledby="visual-type-heading" className="source-kind">
      <div className="studio-step-heading">
        <h2 id="visual-type-heading">Visual type</h2>
        <p>Choose what students need to explore.</p>
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
            <span aria-hidden="true" className="source-choice-mark" />
            <span className="source-choice-copy">
              <span className="source-choice-title">Chart</span>
              <span className="source-choice-detail">
                Bar or line chart with labelled numeric values.
              </span>
            </span>
          </label>

          <label className="source-choice">
            <input
              className="visually-hidden"
              name="mode"
              type="radio"
              value="process"
            />
            <span aria-hidden="true" className="source-choice-mark" />
            <span className="source-choice-copy">
              <span className="source-choice-title">Process diagram</span>
              <span className="source-choice-detail">
                Labelled steps connected in a meaningful order.
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
    <section aria-labelledby="upload-heading" className="source-upload">
      <div className="studio-step-heading">
        <h2 id="upload-heading">Source image</h2>
        <p>One clear PNG, JPEG, or WebP.</p>
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
        <span aria-hidden="true" className="upload-symbol">
          +
        </span>
        <div className="upload-copy">
          <strong>Drop an image here</strong>
          <span id="upload-help">PNG, JPEG, or WebP · Up to 10 MB</span>
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
      <section aria-labelledby="studio-title" className="studio-header">
        <div className="section-shell studio-header-grid">
          <div className="studio-header-copy">
            <h1 id="studio-title">Create a lesson.</h1>
            <p>Start with one chart or process diagram.</p>
          </div>
          <StudioProgress />
        </div>
      </section>

      <section aria-label="Create an accessible lesson" className="studio-editor">
        <div className="section-shell studio-workspace">
          <div className="studio-source-grid">
            <VisualTypeSelector />
            <SourceUploader />
          </div>
          <div className="studio-notes">
            <p>
              <strong>Teacher review is required before export.</strong>
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

export function ExamplesPageShell() {
  return (
    <main className="information-page" id="main-content" tabIndex={-1}>
      <div className="information-content">
        <section aria-labelledby="examples-title" className="page-intro examples-intro">
          <div className="section-shell">
            <h1 id="examples-title">
              <span>See the visual.</span>{" "}
              <span className="muted-heading">Explore the structure.</span>
            </h1>
            <p className="body-large">
              Two lesson formats. No flattened descriptions.
            </p>
          </div>
        </section>

        <section aria-label="Optiq examples" className="examples-page">
          <div className="section-shell example-format-grid">
            <article className="lesson-example lesson-example-chart" id="charts">
              <div>
                <p className="example-type">Chart lesson</p>
                <h2>Exact data. Four ways in.</h2>
              </div>
              <ul aria-label="Chart lesson outputs">
                <li>Native table</li>
                <li>Trend summary</li>
                <li>Keyboard exploration</li>
                <li>Optional sound</li>
              </ul>
            </article>
            <article
              className="lesson-example lesson-example-process"
              id="process-diagrams"
            >
              <div>
                <p className="example-type">Process lesson</p>
                <h2>Every step stays connected.</h2>
              </div>
              <ul aria-label="Process lesson outputs">
                <li>Ordered nodes</li>
                <li>Named relationships</li>
                <li>Reading sequence</li>
                <li>Keyboard navigation</li>
              </ul>
            </article>
          </div>
        </section>
      </div>

      <PageClose href="/create" label="Create a lesson" />
    </main>
  );
}
