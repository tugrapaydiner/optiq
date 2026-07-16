export function AppShell() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="shell brand-row">
          <p className="brand">Optiq</p>
          <p className="brand-note">Accessible lessons from educational visuals</p>
        </div>
      </header>

      <main className="shell" id="main-content" tabIndex={-1}>
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">Teacher reviewed. Learner ready.</p>
          <h1 id="page-title">Turn educational visuals into accessible lessons</h1>
          <p className="lead">
            Optiq converts a bar or line chart, or a process diagram, into a
            structured lesson that can be explored with a keyboard and screen
            reader.
          </p>
          <p className="preview-notice">
            <strong>Bootstrap preview:</strong> image analysis is not connected
            yet, so this page does not upload or send files.
          </p>
        </section>

        <div className="workspace">
          <section className="card" aria-labelledby="mode-heading">
            <h2 id="mode-heading">1. Choose the visual type</h2>
            <p id="mode-help">
              Choose the option that matches the single visual you plan to
              analyze.
            </p>

            <fieldset aria-describedby="mode-help">
              <legend>Visual type</legend>
              <div className="mode-grid">
                <label className="mode-option">
                  <input defaultChecked name="mode" type="radio" value="chart" />
                  <span>
                    <span className="mode-title">Chart</span>
                    <span className="mode-description">
                      A bar or line chart with categories and numeric values.
                    </span>
                  </span>
                </label>

                <label className="mode-option">
                  <input name="mode" type="radio" value="process" />
                  <span>
                    <span className="mode-title">Process diagram</span>
                    <span className="mode-description">
                      Labeled steps connected in a meaningful order.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </section>

          <section className="card" aria-labelledby="upload-heading">
            <h2 id="upload-heading">2. Add an image</h2>
            <p id="upload-help">
              PNG, JPEG, or WebP; one visual per file; up to 10 MB. Uploads are
              unavailable in this bootstrap preview.
            </p>

            <label className="file-label" htmlFor="visual-file">
              Image file
            </label>
            <input
              accept="image/png,image/jpeg,image/webp"
              aria-describedby="upload-help upload-status"
              disabled
              id="visual-file"
              type="file"
            />
            <button className="primary-action" disabled type="button">
              Analyze image
            </button>
            <p className="note" id="upload-status">
              Analysis and teacher review controls will be added in later build
              tasks.
            </p>
          </section>
        </div>

        <div className="info-grid">
          <section className="info-card" aria-labelledby="output-heading">
            <h2 id="output-heading">What Optiq will create</h2>
            <ul>
              <li>Charts: an exact native data table and concise trend summary.</li>
              <li>
                Process diagrams: ordered steps with plain-text relationships.
              </li>
              <li>Keyboard exploration, with optional chart sonification.</li>
            </ul>
          </section>

          <section className="info-card" aria-labelledby="privacy-heading">
            <h2 id="privacy-heading">Privacy and support</h2>
            <p>
              When analysis is connected, the selected image will be sent to
              OpenAI for processing under the applicable API data controls. The
              core flow will not require an account or save the upload.
            </p>
            <p className="note">
              Extracted content stays provisional until a teacher reviews it.
              Unsupported or unclear visuals will be identified instead of
              filled in with plausible details.
            </p>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="shell">
          <p>Teacher review is required before standalone export.</p>
        </div>
      </footer>
    </>
  );
}
