export function AppShell() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <a aria-label="Optiq home" className="brand-lockup" href="#page-top">
            <span className="brand-word">optiq</span>
            <span aria-hidden="true" className="brand-rule" />
            <span className="brand-context">Accessible lesson studio</span>
          </a>
          <p className="build-status">
            <span aria-hidden="true" />
            Preview build
          </p>
        </div>
      </header>

      <main className="shell" id="main-content" tabIndex={-1}>
        <section className="intro" id="page-top" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">AI-assisted accessibility</p>
            <h1 id="page-title">Make visual lessons accessible.</h1>
          </div>
          <div className="intro-copy">
            <p>
              Turn charts and process diagrams into structured experiences that
              students can read, navigate, and explore.
            </p>
            <p className="scope-line">
              Bar charts <span aria-hidden="true">·</span> Line charts{" "}
              <span aria-hidden="true">·</span> Process diagrams
            </p>
          </div>
        </section>

        <ol aria-label="How Optiq works" className="translation-line">
          <li>
            <span>01</span>
            Visual source
          </li>
          <li>
            <span>02</span>
            Structured understanding
          </li>
          <li>
            <span>03</span>
            Accessible lesson
          </li>
        </ol>

        <section className="preview-notice" aria-labelledby="preview-title">
          <span aria-hidden="true" className="notice-mark" />
          <div>
            <h2 id="preview-title">Analysis is not connected in this preview.</h2>
            <p>No file can be selected, uploaded, or sent from this page yet.</p>
          </div>
        </section>

        <section className="creation-section" aria-labelledby="start-heading">
          <div className="workspace-heading">
            <div>
              <p className="section-kicker">New accessible lesson</p>
              <h2 id="start-heading">Add the source material</h2>
            </div>
            <p>Step 1 of 5</p>
          </div>

          <ol aria-label="Lesson creation progress" className="creation-progress">
            <li aria-current="step">
              <span>1</span>
              Add material
            </li>
            <li>
              <span>2</span>
              Analyze
            </li>
            <li>
              <span>3</span>
              Review
            </li>
            <li>
              <span>4</span>
              Preview
            </li>
            <li>
              <span>5</span>
              Export
            </li>
          </ol>

          <div className="workspace-panel">
            <section className="mode-panel" aria-labelledby="mode-heading">
              <p className="panel-step">Choose a format</p>
              <h3 id="mode-heading">What kind of visual is it?</h3>
              <p id="mode-help">
                Select the option that matches one visual. Unclear images will be
                returned for review, not guessed.
              </p>

              <fieldset aria-describedby="mode-help">
                <legend>Visual type</legend>
                <div className="mode-grid">
                  <label className="mode-option">
                    <input
                      defaultChecked
                      name="mode"
                      type="radio"
                      value="chart"
                    />
                    <span>
                      <span className="mode-title">Chart</span>
                      <span className="mode-description">
                        Bar or line chart with labeled numeric values
                      </span>
                    </span>
                    <span className="mode-output">Table · keyboard · sound</span>
                  </label>

                  <label className="mode-option">
                    <input name="mode" type="radio" value="process" />
                    <span>
                      <span className="mode-title">Process diagram</span>
                      <span className="mode-description">
                        Labeled steps connected in a meaningful order
                      </span>
                    </span>
                    <span className="mode-output">Steps · relationships</span>
                  </label>
                </div>
              </fieldset>
            </section>

            <section className="upload-panel" aria-labelledby="upload-heading">
              <p className="panel-step">Add one image</p>
              <h3 id="upload-heading">Choose a clear source</h3>
              <p id="upload-help">PNG, JPEG, or WebP · up to 10 MB</p>

              <label className="visually-hidden" htmlFor="visual-file">
                Image file
              </label>
              <input
                accept="image/png,image/jpeg,image/webp"
                aria-describedby="upload-help upload-status"
                className="visually-hidden"
                disabled
                id="visual-file"
                type="file"
              />

              <div className="upload-surface">
                <span aria-hidden="true" className="upload-icon">
                  <svg viewBox="0 0 32 32">
                    <path d="M16 22V7" />
                    <path d="m10.5 12.5 5.5-5.5 5.5 5.5" />
                    <path d="M6 19v5.5A2.5 2.5 0 0 0 8.5 27h15a2.5 2.5 0 0 0 2.5-2.5V19" />
                  </svg>
                </span>
                <strong>Image upload will appear here</strong>
                <span>File selection is unavailable in this preview.</span>
                <span className="inactive-file-action">Choose image</span>
              </div>

              <div className="analysis-row">
                <button className="primary-action" disabled type="button">
                  Analyze image
                </button>
                <p id="upload-status">No file is sent in this preview.</p>
              </div>
            </section>
          </div>
        </section>

        <section className="product-notes" aria-labelledby="product-notes-heading">
          <h2 className="visually-hidden" id="product-notes-heading">
            What Optiq creates and how review works
          </h2>
          <dl>
            <div>
              <dt>Chart lesson</dt>
              <dd>Exact table, trend summary, keyboard exploration, and optional sonification.</dd>
            </div>
            <div>
              <dt>Process lesson</dt>
              <dd>Ordered steps, relationships, and a logical screen-reader reading order.</dd>
            </div>
            <div>
              <dt>Teacher review required</dt>
              <dd>Critical uncertainties must be resolved before standalone export.</dd>
            </div>
          </dl>
          <p className="privacy-note">
            When live analysis is connected, the selected image will be sent to
            OpenAI under the applicable API data controls. The core flow requires
            no account and does not save the upload.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p className="footer-brand">optiq</p>
          <p>AI-assisted accessibility, reviewed by educators.</p>
        </div>
      </footer>
    </>
  );
}
