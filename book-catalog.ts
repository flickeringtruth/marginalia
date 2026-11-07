type GutenbergBook = {
  id: number;
  title: string;
  authors: string[];
  language: string;
  downloadCount: number;
  epub: string;
};

const GUTENBERG_ORIGIN = "https://www.gutenberg.org";
const SEARCH_URL = `${GUTENBERG_ORIGIN}/ebooks/search.opds/`;
const ATOM_NS = "http://www.w3.org/2005/Atom";
const DCTERMS_NS = "http://purl.org/dc/terms/";
const MAX_RESULTS = 12;

export function safeEpubUrl(value: string): string | null {
  try {
    const url = new URL(value, GUTENBERG_ORIGIN);
    if (url.protocol !== "https:" || url.hostname !== "www.gutenberg.org" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function safeFeedUrl(value: string): string | null {
  const url = safeEpubUrl(value);
  return url && /^\/ebooks\/\d+\.opds$/.test(new URL(url).pathname) ? url : null;
}

function parseXml(source: string): Document {
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("Project Gutenberg returned an invalid catalog response.");
  return xml;
}

function atomText(parent: Element, name: string): string {
  return parent.getElementsByTagNameNS(ATOM_NS, name)[0]?.textContent?.trim() || "";
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, { headers: { Accept: "application/atom+xml" }, signal });
  if (!response.ok) throw new Error(`Project Gutenberg request failed (HTTP ${response.status}).`);
  return response.text();
}

async function getVerifiedBook(feedUrl: string, signal: AbortSignal): Promise<GutenbergBook | null> {
  const xml = parseXml(await fetchText(feedUrl, signal));
  const entry = xml.getElementsByTagNameNS(ATOM_NS, "entry")[0];
  if (!entry || !/^public domain in the usa\.?$/i.test(atomText(entry, "rights"))) return null;

  const id = Number(new URL(feedUrl).pathname.match(/\/ebooks\/(\d+)\.opds$/)?.[1]);
  const title = atomText(entry, "title");
  const authors = Array.from(entry.getElementsByTagNameNS(ATOM_NS, "author"))
    .map(author => atomText(author, "name")).filter(Boolean);
  const links = Array.from(entry.getElementsByTagNameNS(ATOM_NS, "link"));
  const epubLink = links.find(link =>
    link.getAttribute("type") === "application/epub+zip" &&
    link.getAttribute("rel") === "http://opds-spec.org/acquisition"
  );
  const epub = safeEpubUrl(epubLink?.getAttribute("href") || "");
  if (!Number.isInteger(id) || !title || !epub) return null;

  const content = atomText(entry, "content");
  const downloads = content.match(/Downloads:\s*([\d,]+)/i);
  return {
    id,
    title,
    authors,
    language: entry.getElementsByTagNameNS(DCTERMS_NS, "language")[0]?.textContent?.trim() || "",
    downloadCount: downloads ? Number(downloads[1].replace(/,/g, "")) : 0,
    epub
  };
}

class PublicDomainCatalog {
  private books = new Map<number, GutenbergBook>();
  private searchGeneration = 0;
  private searchController: AbortController | null = null;

  constructor() {
    document.addEventListener("click", event => this.handleClick(event));
    document.getElementById("catalogForm")?.addEventListener("submit", event => {
      event.preventDefault();
      void this.search();
    });
    document.addEventListener("catalog:open", () => {
      this.searchGeneration++;
      this.searchController?.abort();
      this.renderEmpty("Search Project Gutenberg's public-domain catalog.");
      window.setTimeout(() => document.getElementById("catalogSearch")?.focus(), 80);
    });
  }

  private handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-catalog-open]")) {
      document.dispatchEvent(new CustomEvent("catalog:open"));
      return;
    }
    if (target.closest("[data-catalog-download]")) {
      this.status("The EPUB download should start in a new tab. Use Import to add it to your library.");
    }
  }

  private status(message: string, isError = false): void {
    const node = document.getElementById("catalogStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", isError);
  }

  private renderEmpty(message: string): void {
    const results = document.getElementById("catalogResults");
    if (results) {
      const paragraph = document.createElement("p");
      paragraph.className = "hint catalog-empty";
      paragraph.textContent = message;
      results.replaceChildren(paragraph);
    }
    this.status("");
  }

  private async search(): Promise<void> {
    const input = document.getElementById("catalogSearch");
    if (!(input instanceof HTMLInputElement)) return;
    const query = input.value.trim().slice(0, 120);
    if (query.length < 2) {
      this.renderEmpty("Enter at least two characters to search.");
      return;
    }

    this.searchController?.abort();
    const controller = new AbortController();
    this.searchController = controller;
    const generation = ++this.searchGeneration;
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    const results = document.getElementById("catalogResults");
    if (results) results.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    this.status("Searching and verifying public-domain EPUBs…");
    try {
      const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}`;
      const xml = parseXml(await fetchText(url, controller.signal));
      const candidates = Array.from(xml.getElementsByTagNameNS(ATOM_NS, "entry"))
        .map(entry => {
          const link = Array.from(entry.getElementsByTagNameNS(ATOM_NS, "link"))
            .find(item => item.getAttribute("rel") === "subsection");
          return safeFeedUrl(link?.getAttribute("href") || "");
        })
        .filter((feed): feed is string => !!feed)
        .slice(0, MAX_RESULTS);
      const outcomes = await Promise.allSettled(candidates.map(feed => getVerifiedBook(feed, controller.signal)));
      if (generation !== this.searchGeneration) return;

      let failed = 0;
      const books = outcomes.flatMap(outcome => {
        if (outcome.status === "rejected") {
          if ((outcome.reason as Error)?.name !== "AbortError") failed++;
          return [];
        }
        return outcome.value ? [outcome.value] : [];
      });
      this.books = new Map(books.map(book => [book.id, book]));
      this.renderResults(books, failed);
      this.status(books.length
        ? `${books.length} verified EPUB${books.length === 1 ? "" : "s"}${failed ? `; ${failed} result${failed === 1 ? "" : "s"} could not be verified.` : "."}`
        : failed
          ? `No verified EPUBs found; ${failed} result${failed === 1 ? " could" : "s could"} not be verified. Try again later.`
          : "No matching public-domain EPUBs found.");
    } catch (error) {
      if (generation !== this.searchGeneration) return;
      const message = error instanceof Error && error.name === "AbortError"
        ? "The catalog search timed out. Please try again."
        : error instanceof Error ? error.message : "The catalog search failed.";
      this.renderEmpty(message);
      this.status(message, true);
    } finally {
      window.clearTimeout(timeout);
      if (this.searchController === controller) this.searchController = null;
    }
  }

  private renderResults(books: GutenbergBook[], failed: number): void {
    const results = document.getElementById("catalogResults");
    if (!results) return;
    if (!books.length) {
      const paragraph = document.createElement("p");
      paragraph.className = "hint catalog-empty";
      paragraph.textContent = "Try another title or author.";
      results.replaceChildren(paragraph);
      return;
    }
    results.innerHTML = books.map(book => `<article class="catalog-book">
      <div class="catalog-book-copy"><b>${escapeHtml(book.title)}</b>
      <span>${escapeHtml(book.authors.join(", ") || "Unknown author")}</span>
      <small>${book.language ? escapeHtml(book.language) + " · " : ""}${book.downloadCount.toLocaleString()} downloads · Public domain in the USA</small></div>
      <a class="small-btn" data-catalog-download="${book.id}" href="${escapeHtml(book.epub)}" target="_blank" rel="noopener noreferrer" aria-label="Download ${escapeHtml(book.title)} EPUB">Download EPUB</a>
    </article>`).join("") + (failed ? '<p class="hint catalog-limit">Some search results could not be verified and were omitted.</p>' : "");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char] || char);
}

// The v2 UI (localStorage "marginalia.ui" === "v2") has its own Discover screen (src/ui/discover.ts).
function v2On(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem("marginalia.ui") === "v2"; } catch { return false; }
}
if (typeof document !== "undefined" && !v2On()) new PublicDomainCatalog();
