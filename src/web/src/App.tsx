import { lazy, Suspense, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import PublicHome from "./features/public/PublicHome";
import Privacy from "./features/public/Privacy";
import NhbrcMark from "./features/public/NhbrcMark";
import { useAuth, SignIn, Profile } from "./features/identity/Auth";
import { Loading, ErrorMessage } from "./shared/ui";
import { useQuery } from "./shared/api";
import {
  useQuoteLinkState,
  useStartQuote,
  type QuoteLocationState,
} from "./features/quotes/launch";
const loadQuoteBuilder = () => import("./features/quotes/QuoteBuilder");
const QuoteBuilder = lazy(loadQuoteBuilder);
const QuoteQueue = lazy(() => import("./features/operations/QuoteQueue"));
const PublicationManager = lazy(
  () => import("./features/public/PublicationManager"),
);
const ContentEditor = lazy(() => import("./features/public/ContentEditor"));
const ProjectList = lazy(() =>
  import("./features/client/ClientPortal").then((m) => ({
    default: m.ProjectList,
  })),
);
const PortalOverview = lazy(() => import("./features/client/PortalOverview"));
const ProjectPage = lazy(() =>
  import("./features/client/ClientPortal").then((m) => ({
    default: m.ProjectPage,
  })),
);
const Notifications = lazy(() =>
  import("./features/identity/Administration").then((m) => ({
    default: m.Notifications,
  })),
);
const Users = lazy(() =>
  import("./features/identity/Administration").then((m) => ({
    default: m.Users,
  })),
);
const Audit = lazy(() =>
  import("./features/identity/Administration").then((m) => ({
    default: m.Audit,
  })),
);
function Protected({
  staff = false,
  admin = false,
}: {
  staff?: boolean;
  admin?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/signin" replace />;
  if (
    (staff && !user.roles.some((r) => ["Staff", "Admin"].includes(r))) ||
    (admin && !user.roles.includes("Admin"))
  )
    return (
      <section className="states-page">
        <h1>Access restricted.</h1>
        <p>Your account does not have permission to view this area.</p>
        <Link to="/client">Return to your workspace</Link>
      </section>
    );
  return <Outlet />;
}
function PortalLayout({ staff = false }: { staff?: boolean }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const labels: Record<string, string> = {
    "/client": "Overview",
    "/client/projects": "My projects",
    "/staff": "Operations",
    quotes: "Quote queue",
    projects: "Project workspace",
    notifications: "Notifications",
    users: "Clients & users",
    content: "Content & records",
    publications: "Portfolio & pricing",
    audit: "Audit log",
  };
  const title =
    labels[location.pathname] ??
    labels[location.pathname.split("/")[2]] ??
    "Your workspace";
  const groups = staff
    ? [
        {
          title: "Work management",
          links: [
            ["/staff", "Operations"],
            ["/staff/quotes", "Quote queue"],
            ["/staff/projects", "Project workspace"],
            ...(user?.roles.includes("Admin")
              ? [["/staff/users", "Clients & users"]]
              : []),
          ],
        },
        {
          title: "Website management",
          links: [
            ["/staff/content", "Content & records"],
            ["/staff/publications", "Portfolio & pricing"],
          ],
        },
        {
          title: "Activity",
          links: [
            ["/staff/notifications", "Notifications"],
            ...(user?.roles.includes("Admin")
              ? [["/staff/audit", "Audit log"]]
              : []),
          ],
        },
        { title: "Account", links: [["/profile", "My account"]] },
      ]
    : [
        {
          title: "Your workspace",
          links: [
            ["/client", "Overview"],
            ["/client/projects", "My projects"],
            ["/client/notifications", "Notifications"],
            ["/profile", "My account"],
          ],
        },
      ];
  const descriptions: Record<string, string> = {
    Operations: "Review incoming work and keep projects moving.",
    Overview: "Your next steps and current project progress.",
    "Quote queue": "Review requests, prepare quotes and record decisions.",
    "Project workspace":
      "Track progress, documents, financials and change requests.",
    "My projects":
      "Follow your progress, documents and decisions in one place.",
    Notifications: "Keep track of project messages and updates.",
    "Clients & users": "Manage account access and client details.",
    "Content & records": "Maintain the information shown on your website.",
    "Portfolio & pricing": "Manage published projects and estimate rates.",
    "Audit log": "Review recorded activity and changes.",
  };
  return (
    <section className={staff ? "staff-portal-shell" : "portal-shell"}>
      <aside className={staff ? "staff-nav" : ""}>
        <div className="workspace-sidebar-inner">
          <div className="workspace-intro">
            <p className="eyebrow">
              {staff ? "STAFF / ADMIN" : "CLIENT PORTAL"}
            </p>
            <h2>
              {staff ? (
                user?.roles.includes("Admin") ? (
                  "Admin workspace"
                ) : (
                  "Staff workspace"
                )
              ) : (
                <>
                  Welcome back,
                  <br />
                  {user?.fullName.split(" ")[0]}.
                </>
              )}
            </h2>
            <span>
              {staff ? "Dynamic Construction" : "Your build, in focus."}
            </span>
          </div>
          <button
            className="workspace-menu-button"
            aria-expanded={navigationOpen}
            aria-controls="workspace-navigation"
            onClick={() => setNavigationOpen(!navigationOpen)}
          >
            Workspace navigation{" "}
            <span aria-hidden="true">{navigationOpen ? "−" : "+"}</span>
          </button>
          <nav
            id="workspace-navigation"
            className={navigationOpen ? "expanded" : ""}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a"))
                setNavigationOpen(false);
            }}
            aria-label={staff ? "Staff portal" : "Client portal"}
          >
            {groups.map((group) => (
              <div className="portal-nav-group" key={group.title}>
                <p>{group.title}</p>
                {group.links.map(([path, label]) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={["/staff", "/client"].includes(path)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          {staff && (
            <div className="staff-profile">
              <span>
                <strong>{user?.fullName}</strong>
                <small>{user?.roles.join(" / ")}</small>
              </span>
            </div>
          )}
        </div>
      </aside>
      <div className={staff ? "staff-shell" : "portal-main"}>
        <div className={staff ? "staff-heading" : "portal-heading"}>
          <div>
            <p className="eyebrow">
              {staff ? "STAFF / ADMIN PORTAL" : "DYNAMIC CONSTRUCTION"}
            </p>
            <h1>{title}</h1>
            <p>{descriptions[title]}</p>
          </div>
          {staff &&
            location.pathname === "/staff" &&
            !user?.requiresMfaSetup && (
              <Link className="primary-button" to="/staff/quotes">
                Review quotes
              </Link>
            )}
        </div>
        {staff && user?.requiresMfaSetup ? (
          <section className="detail-panel" role="status">
            <h2>Set up your authenticator to continue</h2>
            <p>
              Your staff workspace requires MFA. Records and actions will be
              available after you enable it.
            </p>
            <Link className="primary-button" to="/profile">
              Set up MFA
            </Link>
          </section>
        ) : (
          <Outlet />
        )}
      </div>
    </section>
  );
}
function Records() {
  return (
    <>
      <nav className="record-shortcuts" aria-label="Record shortcuts">
        {[
          [
            "Public content",
            "Update the words your clients see.",
            "#content-editor",
          ],
          [
            "Files & photographs",
            "Upload and publish project documents.",
            "/staff/projects",
          ],
          [
            "Finance records",
            "Manage budgets and invoices.",
            "/staff/projects",
          ],
          [
            "Client notifications",
            "Compose recipient-specific messages.",
            "/staff/notifications",
          ],
        ].map(([title, body, path]) => (
          <Link className="outline-button" key={title} to={path} title={body}>
            {title}
          </Link>
        ))}
      </nav>
      <p>
        Select a project in Files & photographs or Finance records to manage its
        documents and finances.
      </p>
      <div id="content-editor">
        <ContentEditor />
      </div>
    </>
  );
}

export default function App() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const startQuote = useStartQuote();
  const quoteLinkState = useQuoteLinkState();
  // The quote builder opens over the page it was started from.
  const pageLocation =
    (location.state as QuoteLocationState | null)?.backgroundLocation ??
    location;
  useEffect(() => {
    setMenu(false);
    if (pageLocation.hash) {
      setTimeout(
        () =>
          document
            .getElementById(pageLocation.hash.slice(1))
            ?.scrollIntoView(),
        100,
      );
    } else window.scrollTo(0, 0);
  }, [pageLocation.key]);
  useEffect(() => {
    const timer = setTimeout(loadQuoteBuilder, 2000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--header-height",
        header.getBoundingClientRect().height + "px",
      ),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const inPortal =
    !!user && /^\/(staff|client|profile)(\/|$)/.test(pageLocation.pathname);
  const portal = user?.roles.includes("Client") ? "/client" : "/staff";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className={"site-header" + (inPortal ? " portal-header" : "")}>
        <Link className="brand" to="/">
  <img
    className="brand-mark"
    src="/favicon.svg"
    alt=""
    width="42"
    height="42"
  />
  <span className="brand-text">
    <span className="trading-as">
      Synergy Investments 792 (Pty) Ltd trading as
    </span>
    <span>Dynamic Construction</span>
  </span>
</Link>
        {!inPortal && (
          <nav
            className={"main-nav " + (menu ? "open" : "")}
            aria-label="Main navigation"
          >
            <Link to="/#services">Services</Link>
            <Link to="/#projects">Portfolio</Link>
            <Link to="/#process">How it works</Link>
            <Link to="/#contact">Contact</Link>
          </nav>
        )}
        {inPortal ? (
          <div className="portal-header-actions">
            <Link to="/">View website</Link>
            <Link to={portal + "/notifications"}>Notifications</Link>
            <details
              className="account-menu"
              key={location.pathname}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary>Account</summary>
              <div>
                <strong>{user?.fullName}</strong>
                <small>{user?.roles.join(" / ")}</small>
                <Link to="/profile">My account</Link>
                <button
                  className="link-button"
                  onClick={async () => {
                    try {
                      await logout();
                      navigate("/signin", { replace: true });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Sign out
                </button>
              </div>
            </details>
          </div>
        ) : (
          <div className="header-actions">
            {user ? (
              <>
                <Link className="account-chip" to={portal}>
                  <span>
                    {user.fullName
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>{user.fullName}</strong>
                    <small>{user.roles.join(" / ")}</small>
                  </span>
                </Link>
                <button
                  className="link-button"
                  onClick={async () => {
                    try {
                      await logout();
                      navigate("/signin", { replace: true });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link className="text-button" to="/signin">
                Sign in
              </Link>
            )}
            <Link
              className="primary-button header-quote"
              to="/quote"
              state={quoteLinkState}
            >
              Start a quote
            </Link>
            <button
              className="menu-button"
              aria-label="Toggle menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              ☰
            </button>
          </div>
        )}
      </header>
      <ErrorMessage message={error} />
      <main id="main-content">
        <Suspense fallback={<Loading label="Loading page…" />}>
          <Routes location={pageLocation}>
            {["/", "/quote"].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <PublicHome
                    quoteOpen={location.pathname === "/quote"}
                    onStartQuote={startQuote}
                    onSignIn={() => navigate(user ? portal : "/signin")}
                  />
                }
              />
            ))}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route element={<Protected />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/client" element={<PortalLayout />}>
                <Route index element={<PortalOverview />} />
                <Route path="projects" element={<ProjectList />} />
                <Route path="projects/:id/:tab?" element={<ProjectPage />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>
            </Route>
            <Route element={<Protected staff />}>
              <Route path="/staff" element={<PortalLayout staff />}>
                <Route index element={<PortalOverview staff />} />
                <Route path="projects" element={<ProjectList staff />} />
                <Route
                  path="projects/:id/:tab?"
                  element={<ProjectPage staff />}
                />
                <Route path="quotes" element={<QuoteQueue />} />
                <Route path="content" element={<Records />} />
                <Route path="publications" element={<PublicationManager />} />
                <Route path="notifications" element={<Notifications staff />} />
                <Route element={<Protected admin />}>
                  <Route path="users" element={<Users />} />
                  <Route path="audit" element={<Audit />} />
                </Route>
              </Route>
            </Route>
            <Route
              path="*"
              element={
                <section className="states-page">
                  <h1>Page not found.</h1>
                  <p>Return to the public website or your project workspace.</p>
                  <Link className="primary-button" to="/">
                    Back to home
                  </Link>
                </section>
              }
            />
          </Routes>
        </Suspense>
        {location.pathname === "/quote" && (
          <Suspense fallback={null}>
            <QuoteBuilder />
          </Suspense>
        )}
      </main>
      <footer>
  <div className="footer-main">
    <Link className="brand" to="/">
      <img
        className="brand-mark"
        src="/favicon.svg"
        alt=""
        width="42"
        height="42"
      />
      <span className="brand-text">
        <span className="trading-as">
          Synergy Investments 792 (Pty) Ltd trading as
        </span>
        <span>Dynamic Construction</span>
      </span>
    </Link>
    <p>Plan with clarity. Build with confidence.</p>
    <div>
      <Link to="/privacy">Privacy</Link>
    </div>
  </div>
  <div className="nhbrc-strip">
    <p className="nhbrc-label">Registered with</p>
    <NhbrcMark height={62} />
    <p className="nhbrc-reg">Reg. 4000008693</p>
  </div>
  <div className="footer-bottom">
    <small>
      © {new Date().getFullYear()} Synergy Investments 792 (Pty)
      Ltd, trading as Dynamic Construction
    </small>
    <span className="footer-contact">
      General enquiries: Krishna Chetty ·{" "}
      <a href="mailto:krishna.dynacontr@outlook.com">
        krishna.dynacontr@outlook.com
      </a>
    </span>
  </div>
</footer>
    </>
  );
}
