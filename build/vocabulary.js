const STORAGE_KEY = "reader.vocabulary.v1";
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
export function nextSchedule(current, grade, now = Date.now()) {
    if (grade === "again") {
        return { dueAt: now + 10 * MINUTE, intervalDays: 0, repetitions: 0 };
    }
    const intervalDays = current.repetitions === 0
        ? 1
        : current.repetitions === 1
            ? 3
            : Math.max(3, Math.round(current.intervalDays * 2));
    return {
        dueAt: now + intervalDays * DAY,
        intervalDays,
        repetitions: current.repetitions + 1
    };
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char] || char);
}
function normalizeEntry(value) {
    if (!value || typeof value !== "object")
        return null;
    const candidate = value;
    const word = typeof candidate.word === "string" ? candidate.word.trim().slice(0, 200) : "";
    const definition = typeof candidate.definition === "string" ? candidate.definition.trim().slice(0, 4000) : "";
    const example = typeof candidate.example === "string" ? candidate.example.trim().slice(0, 1000) : "";
    return word && definition ? { word, definition, example } : null;
}
class VocabularyNotebook {
    constructor() {
        this.entries = [];
        this.currentEntry = null;
        this.reviewIds = null;
        this.reviewIndex = 0;
        this.showingAnswer = false;
        this.storageError = "";
        this.load();
        document.addEventListener("dictionary:entry", event => {
            const detail = event.detail;
            this.currentEntry = normalizeEntry(detail);
            this.updateDictionaryButton();
        });
        document.addEventListener("click", event => this.handleClick(event));
        this.render();
    }
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw)
                return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                throw new Error("Saved vocabulary has an invalid format.");
            this.entries = parsed.filter((item) => !!item && typeof item === "object" &&
                typeof item.word === "string" &&
                typeof item.definition === "string" &&
                Number.isFinite(item.savedAt) &&
                Number.isFinite(item.dueAt) &&
                Number.isFinite(item.intervalDays) &&
                Number.isInteger(item.repetitions));
        }
        catch (error) {
            this.storageError = error instanceof Error ? error.message : "Could not read saved vocabulary.";
        }
    }
    save(entries) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            this.entries = entries;
            this.storageError = "";
            return true;
        }
        catch (error) {
            this.storageError = error instanceof Error ? error.message : "Browser storage is unavailable.";
            return false;
        }
    }
    updateDictionaryButton() {
        const button = document.getElementById("dictSaveVocab");
        if (!button || !this.currentEntry)
            return;
        const saved = this.entries.some(entry => entry.word.toLocaleLowerCase() === this.currentEntry?.word.toLocaleLowerCase());
        button.textContent = saved ? "Remove from vocabulary" : "Save to vocabulary";
        button.setAttribute("aria-pressed", String(saved));
    }
    handleClick(event) {
        const target = event.target;
        if (!(target instanceof Element))
            return;
        const button = target.closest("[data-vocab-action]");
        if (!button)
            return;
        switch (button.dataset.vocabAction) {
            case "save-current":
                this.toggleCurrentEntry();
                break;
            case "open":
                this.open();
                break;
            case "start-review":
                this.startReview();
                break;
            case "show-answer":
                this.showingAnswer = true;
                this.renderReview();
                break;
            case "grade":
                this.grade(button.dataset.grade === "again" ? "again" : "good");
                break;
            case "list":
                this.reviewIds = null;
                this.render();
                break;
            case "study":
                this.startReview(button.dataset.word || "");
                break;
            case "remove":
                this.remove(button.dataset.word || "");
                break;
        }
    }
    toggleCurrentEntry() {
        if (!this.currentEntry)
            return;
        const key = this.currentEntry.word.toLocaleLowerCase();
        const existing = this.entries.find(entry => entry.word.toLocaleLowerCase() === key);
        if (existing)
            this.remove(existing.word);
        else {
            const now = Date.now();
            const entry = {
                ...this.currentEntry,
                savedAt: now,
                dueAt: now,
                intervalDays: 0,
                repetitions: 0
            };
            this.save([entry, ...this.entries]);
            this.render();
        }
        this.updateDictionaryButton();
    }
    remove(word) {
        const normalized = word.toLocaleLowerCase();
        if (this.save(this.entries.filter(entry => entry.word.toLocaleLowerCase() !== normalized))) {
            this.reviewIds = null;
            this.render();
        }
        else {
            this.render();
        }
    }
    open() {
        const sheet = document.getElementById("vocabSheet");
        if (!sheet)
            return;
        document.dispatchEvent(new CustomEvent("vocabulary:open"));
        this.render();
    }
    startReview(word = "") {
        const now = Date.now();
        const due = this.entries
            .filter(entry => word
            ? entry.word.toLocaleLowerCase() === word.toLocaleLowerCase()
            : entry.dueAt <= now)
            .sort((a, b) => a.dueAt - b.dueAt);
        this.reviewIds = due.map(entry => entry.word);
        this.reviewIndex = 0;
        this.showingAnswer = false;
        this.renderReview();
    }
    grade(grade) {
        const word = this.reviewIds?.[this.reviewIndex];
        const entry = this.entries.find(item => item.word === word);
        if (!entry) {
            this.reviewIds = null;
            this.render();
            return;
        }
        const schedule = nextSchedule(entry, grade);
        const updated = this.entries.map(item => item === entry
            ? { ...item, ...schedule, lastReviewedAt: Date.now() }
            : item);
        if (!this.save(updated)) {
            this.renderReview();
            return;
        }
        this.reviewIndex++;
        this.showingAnswer = false;
        this.renderReview();
    }
    dueCount() {
        const now = Date.now();
        return this.entries.filter(entry => entry.dueAt <= now).length;
    }
    render() {
        const body = document.getElementById("vocabBody");
        if (!body)
            return;
        const due = this.dueCount();
        const rows = [...this.entries]
            .sort((a, b) => a.dueAt - b.dueAt || b.savedAt - a.savedAt)
            .map(entry => `<article class="vocab-entry">
        <div class="vocab-entry-copy"><b>${escapeHtml(entry.word)}</b><p>${escapeHtml(entry.definition)}</p>
        ${entry.example ? `<small>“${escapeHtml(entry.example)}”</small>` : ""}
        <span>${entry.dueAt <= Date.now() ? "Due for review" : `Next review ${escapeHtml(this.formatDate(entry.dueAt))}`}</span></div>
        <div class="vocab-entry-actions"><button data-vocab-action="study" data-word="${escapeHtml(entry.word)}">Study</button><button data-vocab-action="remove" data-word="${escapeHtml(entry.word)}" aria-label="Remove ${escapeHtml(entry.word)}">×</button></div>
      </article>`).join("");
        body.innerHTML = `<div class="vocab-toolbar"><span>${this.entries.length} saved · ${due} due</span><button class="small-btn" data-vocab-action="start-review" ${due ? "" : "disabled"}>Review due</button></div>
      <p class="vocab-status" role="status" aria-live="polite">${escapeHtml(this.storageError)}</p>
      <div id="vocabContent">${rows || '<p class="hint">Your saved words will appear here. Save a word from its dictionary entry to build your vocabulary notebook.</p>'}</div>`;
    }
    renderReview() {
        const body = document.getElementById("vocabBody");
        if (!body)
            return;
        const currentWord = this.reviewIds?.[this.reviewIndex];
        const entry = this.entries.find(item => item.word === currentWord);
        if (!entry) {
            this.reviewIds = null;
            body.innerHTML = `<div class="vocab-toolbar"><button class="small-btn" data-vocab-action="list">Back to words</button></div><p class="vocab-status" role="status">${escapeHtml(this.storageError)}</p><p class="hint">${this.entries.length ? "Review complete. Come back when more words are due." : "Your vocabulary notebook is empty."}</p>`;
            return;
        }
        const answer = this.showingAnswer
            ? `<div class="vocab-answer"><p>${escapeHtml(entry.definition)}</p>${entry.example ? `<small>“${escapeHtml(entry.example)}”</small>` : ""}</div>
        <div class="vocab-grade"><button data-vocab-action="grade" data-grade="again">Again · 10 min</button><button data-vocab-action="grade" data-grade="good">Got it</button></div>`
            : `<button class="wide-btn primary" data-vocab-action="show-answer">Show definition</button>`;
        body.innerHTML = `<div class="vocab-toolbar"><button class="small-btn" data-vocab-action="list">Back to words</button><span>${this.reviewIndex + 1} / ${this.reviewIds?.length || 0}</span></div>
      <p class="vocab-status" role="status" aria-live="polite">${escapeHtml(this.storageError)}</p>
      <section class="vocab-card"><h3>${escapeHtml(entry.word)}</h3>${answer}</section>`;
    }
    formatDate(timestamp) {
        const remaining = timestamp - Date.now();
        if (remaining < MINUTE)
            return "in less than a minute";
        if (remaining < DAY)
            return `in ${Math.ceil(remaining / (60 * MINUTE))} hours`;
        return `in ${Math.ceil(remaining / DAY)} days`;
    }
}
if (typeof document !== "undefined")
    new VocabularyNotebook();
