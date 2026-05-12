const STORAGE_KEYS = {
  mode: "studySelectionMode",
  testIndex: "studySelectionTestIndex",
  allWordsIndex: "allWordsSavedIndex",
  testPositions: "testSavedPositions",
  randomOrder: "allWordsSortRandom",
};

const ASSET_VERSION = "20260512b";

const TOTAL_TESTS = 20;
const PALETTE = [
  { page: "#e6d7c8", card: "#f0e4d8" },
  { page: "#d7e4d1", card: "#e5efe1" },
  { page: "#d8e2ee", card: "#e6edf6" },
  { page: "#e7d7e4", card: "#f0e4ee" },
  { page: "#eadcb9", card: "#f2e7ca" },
  { page: "#d4e4df", card: "#e1eee9" },
];

const state = {
  allCards: [],
  tests: [],
  selection: null,
  selectedIndex: 0,
  isRandomOrder: false,
  revealedCards: new Set(),
};

const elements = {
  body: document.body,
  headerBadge: document.getElementById("header-badge"),
  headerSubtitle: document.getElementById("header-subtitle"),
  backButton: document.getElementById("back-button"),
  sortToggle: document.getElementById("sort-toggle"),
  pickerScreen: document.getElementById("picker-screen"),
  studyScreen: document.getElementById("study-screen"),
  allWordsCard: document.getElementById("all-words-card"),
  allWordsCount: document.getElementById("all-words-count"),
  allWordsStatus: document.getElementById("all-words-status"),
  testsGrid: document.getElementById("tests-grid"),
  testCardTemplate: document.getElementById("test-card-template"),
  flashcardShell: document.getElementById("flashcard-shell"),
  flashcard: document.getElementById("flashcard"),
  frontWord: document.getElementById("front-word"),
  backWord: document.getElementById("back-word"),
  backPos: document.getElementById("back-pos"),
  definition: document.getElementById("definition"),
  synonyms: document.getElementById("synonyms"),
  antonyms: document.getElementById("antonyms"),
  sentence: document.getElementById("sentence"),
  speakButton: document.getElementById("speak-button"),
  scrubberLabel: document.getElementById("scrubber-label"),
  scrubber: document.getElementById("scrubber"),
  previousButton: document.getElementById("previous-button"),
  nextButton: document.getElementById("next-button"),
};

function setLoadingState() {
  elements.allWordsCount.textContent = "Loading cards...";
  elements.allWordsStatus.textContent = "Please wait";
}

function setUnavailableState(message) {
  elements.allWordsCount.textContent = message;
  elements.allWordsStatus.textContent = "Try refresh";
}

function stableShuffleKey(word) {
  let hash = 1469598103934665603n;
  const lowercased = word.toLowerCase();

  for (let index = 0; index < lowercased.length; index += 1) {
    hash ^= BigInt(lowercased.charCodeAt(index));
    hash *= 1099511628211n;
  }

  return hash;
}

function stableRandomizedCards(cards) {
  const alphabeticalCards = [...cards].sort((left, right) =>
    left.word.localeCompare(right.word, undefined, { sensitivity: "base" })
  );

  return alphabeticalCards.sort((left, right) => {
    const leftKey = stableShuffleKey(left.word);
    const rightKey = stableShuffleKey(right.word);

    if (leftKey === rightKey) {
      return left.word.localeCompare(right.word, undefined, { sensitivity: "base" });
    }

    return leftKey < rightKey ? -1 : 1;
  });
}

function buildTests(cards) {
  const baseCount = Math.floor(cards.length / TOTAL_TESTS);
  const remainder = cards.length % TOTAL_TESTS;
  const slices = [];
  let startIndex = 0;

  for (let index = 0; index < TOTAL_TESTS; index += 1) {
    const extraCard = index < remainder ? 1 : 0;
    const endIndex = Math.min(startIndex + baseCount + extraCard, cards.length);
    slices.push({
      index,
      number: index + 1,
      cards: cards.slice(startIndex, endIndex),
    });
    startIndex = endIndex;
  }

  return slices;
}

function getSavedPositions() {
  const value = localStorage.getItem(STORAGE_KEYS.testPositions) || "";

  if (!value) {
    return {};
  }

  return value.split(",").reduce((positions, entry) => {
    const [key, rawValue] = entry.split(":");
    const parsedKey = Number.parseInt(key, 10);
    const parsedValue = Number.parseInt(rawValue, 10);

    if (!Number.isNaN(parsedKey) && !Number.isNaN(parsedValue)) {
      positions[parsedKey] = parsedValue;
    }

    return positions;
  }, {});
}

function saveTestPosition(testIndex, position) {
  const positions = getSavedPositions();
  positions[testIndex] = Math.max(position, 0);

  const serialized = Object.entries(positions)
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");

  localStorage.setItem(STORAGE_KEYS.testPositions, serialized);
}

function savedPositionForTest(testIndex) {
  const positions = getSavedPositions();
  return positions[testIndex] || 0;
}

function clampIndex(index, cards) {
  if (!cards.length) {
    return 0;
  }

  return Math.max(0, Math.min(cards.length - 1, index));
}

function statusLabel(position, totalCount) {
  if (totalCount <= 0) {
    return "Not started";
  }

  if (position <= 0) {
    return "Not started";
  }

  if (position >= totalCount - 1) {
    return "Done";
  }

  return "In progress";
}

function selectedTest() {
  if (!state.selection || state.selection.mode !== "test") {
    return null;
  }

  return state.tests.find((test) => test.index === state.selection.testIndex) || null;
}

function currentCards() {
  if (!state.selection) {
    return [];
  }

  if (state.selection.mode === "allWords") {
    return state.isRandomOrder
      ? stableRandomizedCards(state.allCards)
      : [...state.allCards].sort((left, right) => left.word.localeCompare(right.word, undefined, { sensitivity: "base" }));
  }

  return selectedTest()?.cards || [];
}

function resetRevealedCards() {
  state.revealedCards = new Set();
}

function persistSelection() {
  if (!state.selection) {
    localStorage.setItem(STORAGE_KEYS.mode, "picker");
    localStorage.setItem(STORAGE_KEYS.testIndex, "-1");
    return;
  }

  if (state.selection.mode === "allWords") {
    localStorage.setItem(STORAGE_KEYS.mode, "allWords");
    localStorage.setItem(STORAGE_KEYS.testIndex, "-1");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.mode, "test");
  localStorage.setItem(STORAGE_KEYS.testIndex, String(state.selection.testIndex));
}

function saveProgress() {
  if (!state.selection) {
    return;
  }

  if (state.selection.mode === "allWords") {
    localStorage.setItem(STORAGE_KEYS.allWordsIndex, String(Math.max(state.selectedIndex, 0)));
    return;
  }

  saveTestPosition(state.selection.testIndex, state.selectedIndex);
}

function updateTheme(cards) {
  if (!cards.length) {
    return;
  }

  const pair = PALETTE[state.selectedIndex % PALETTE.length];
  document.documentElement.style.setProperty("--page-bg", pair.page);
  document.documentElement.style.setProperty("--card-bg", pair.card);
}

function renderChips(container, values) {
  container.textContent = "";
  values.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = value;
    container.appendChild(chip);
  });
}

function renderPicker() {
  const positions = getSavedPositions();
  elements.testsGrid.textContent = "";
  elements.allWordsCount.textContent = `${state.allCards.length} cards`;
  elements.allWordsStatus.textContent = statusLabel(
    Number.parseInt(localStorage.getItem(STORAGE_KEYS.allWordsIndex) || "0", 10) || 0,
    state.allCards.length
  );

  state.tests.forEach((test) => {
    const card = elements.testCardTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".selection-title").textContent = `Test ${test.number}`;
    card.querySelector(".selection-meta").textContent = `${test.cards.length} cards`;
    card.querySelector(".selection-status").textContent = statusLabel(positions[test.index] || 0, test.cards.length);
    card.addEventListener("click", () => selectTest(test.index));
    elements.testsGrid.appendChild(card);
  });
}

function renderHeader(cards) {
  const activeTest = selectedTest();
  const isAllWordsSelected = state.selection?.mode === "allWords";

  if (activeTest) {
    elements.headerBadge.textContent = cards.length
      ? `Test ${activeTest.number} • ${state.selectedIndex + 1} / ${cards.length}`
      : `Test ${activeTest.number}`;
    elements.headerSubtitle.textContent = "Swipe or use next and previous";
  } else if (isAllWordsSelected) {
    elements.headerBadge.textContent = cards.length
      ? `All words • ${state.selectedIndex + 1} / ${cards.length}`
      : "All words";
    elements.headerSubtitle.textContent = state.isRandomOrder
      ? "All words in random order"
      : "All words in alphabetical order";
  } else {
    elements.headerBadge.textContent = "20 tests • all words";
    elements.headerSubtitle.textContent = "Choose a test or all words";
  }

  elements.backButton.classList.toggle("hidden", !state.selection);
  elements.sortToggle.classList.toggle("hidden", !isAllWordsSelected);
  elements.sortToggle.textContent = state.isRandomOrder ? "Random order" : "Alphabetical order";
  elements.sortToggle.setAttribute("aria-pressed", String(state.isRandomOrder));
}

function renderStudy() {
  const cards = currentCards();
  const card = cards[state.selectedIndex];

  if (!card) {
    return;
  }

  updateTheme(cards);
  renderHeader(cards);

  elements.frontWord.textContent = card.word;
  elements.backWord.textContent = card.word;
  elements.backPos.textContent = capitalize(card.pos);
  elements.definition.textContent = card.definition;
  elements.sentence.textContent = card.sentence;
  renderChips(elements.synonyms, card.synonyms || []);
  renderChips(elements.antonyms, card.antonyms || []);

  const isFlipped = state.revealedCards.has(state.selectedIndex);
  elements.flashcard.classList.toggle("is-front", !isFlipped);
  elements.flashcard.classList.toggle("is-back", isFlipped);

  elements.scrubber.max = String(Math.max(cards.length - 1, 0));
  elements.scrubber.value = String(state.selectedIndex);
  elements.scrubber.disabled = cards.length <= 1;
  elements.scrubberLabel.textContent = `Card ${state.selectedIndex + 1} of ${Math.max(cards.length, 1)}`;
  elements.previousButton.disabled = state.selectedIndex === 0;
  elements.nextButton.disabled = state.selectedIndex >= cards.length - 1;
}

function renderScreen() {
  renderPicker();

  if (!state.selection) {
    elements.pickerScreen.classList.remove("hidden");
    elements.studyScreen.classList.add("hidden");
    renderHeader([]);
    return;
  }

  const cards = currentCards();

  if (!cards.length) {
    elements.pickerScreen.classList.remove("hidden");
    elements.studyScreen.classList.add("hidden");

    if (state.allCards.length) {
      setUnavailableState("Cards are not ready yet");
    } else {
      setLoadingState();
    }

    return;
  }

  state.selectedIndex = clampIndex(state.selectedIndex, cards);
  elements.pickerScreen.classList.add("hidden");
  elements.studyScreen.classList.remove("hidden");
  renderStudy();
}

function selectAllWords() {
  state.selection = { mode: "allWords" };
  state.selectedIndex = clampIndex(
    Number.parseInt(localStorage.getItem(STORAGE_KEYS.allWordsIndex) || "0", 10) || 0,
    currentCards()
  );
  resetRevealedCards();
  persistSelection();
  renderScreen();
}

function selectTest(testIndex) {
  state.selection = { mode: "test", testIndex };
  state.selectedIndex = clampIndex(savedPositionForTest(testIndex), selectedTest()?.cards || []);
  resetRevealedCards();
  persistSelection();
  renderScreen();
}

function returnToPicker() {
  state.selection = null;
  state.selectedIndex = 0;
  resetRevealedCards();
  persistSelection();
  renderScreen();
}

function toggleCard() {
  if (!state.selection) {
    return;
  }

  if (state.revealedCards.has(state.selectedIndex)) {
    state.revealedCards.delete(state.selectedIndex);
  } else {
    state.revealedCards.add(state.selectedIndex);
  }

  renderStudy();
}

function move(delta) {
  const cards = currentCards();
  const nextIndex = clampIndex(state.selectedIndex + delta, cards);

  if (nextIndex === state.selectedIndex) {
    return;
  }

  state.selectedIndex = nextIndex;
  saveProgress();
  renderStudy();
}

function setIndex(index) {
  const cards = currentCards();
  const nextIndex = clampIndex(index, cards);

  if (nextIndex === state.selectedIndex) {
    return;
  }

  state.selectedIndex = nextIndex;
  saveProgress();
  renderStudy();
}

function capitalize(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function speakCurrentWord() {
  const cards = currentCards();
  const card = cards[state.selectedIndex];

  if (!card || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(card.word);
  utterance.lang = "en-GB";
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function restoreLastSession() {
  const savedMode = localStorage.getItem(STORAGE_KEYS.mode) || "picker";
  const savedTestIndex = Number.parseInt(localStorage.getItem(STORAGE_KEYS.testIndex) || "-1", 10);

  if (savedMode === "allWords") {
    state.selection = { mode: "allWords" };
    state.selectedIndex = Number.parseInt(localStorage.getItem(STORAGE_KEYS.allWordsIndex) || "0", 10) || 0;
    return;
  }

  if (savedMode === "test" && state.tests[savedTestIndex]) {
    state.selection = { mode: "test", testIndex: savedTestIndex };
    state.selectedIndex = savedPositionForTest(savedTestIndex);
    return;
  }

  state.selection = null;
  state.selectedIndex = 0;
}

function setupEvents() {
  let pointerStartX = null;
  let pointerStartY = null;
  let pointerId = null;

  elements.allWordsCard.addEventListener("click", selectAllWords);
  elements.backButton.addEventListener("click", returnToPicker);
  elements.sortToggle.addEventListener("click", () => {
    state.isRandomOrder = !state.isRandomOrder;
    localStorage.setItem(STORAGE_KEYS.randomOrder, String(state.isRandomOrder));
    state.selectedIndex = 0;
    resetRevealedCards();
    saveProgress();
    renderScreen();
  });
  elements.flashcard.addEventListener("click", (event) => {
    if (event.target.closest("#speak-button")) {
      return;
    }
    toggleCard();
  });
  elements.speakButton.addEventListener("click", (event) => {
    event.stopPropagation();
    speakCurrentWord();
  });
  elements.previousButton.addEventListener("click", () => move(-1));
  elements.nextButton.addEventListener("click", () => move(1));
  elements.scrubber.addEventListener("input", () => {
    setIndex(Number.parseInt(elements.scrubber.value, 10) || 0);
  });
  elements.flashcardShell.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      move(-1);
    } else if (event.key === "ArrowRight") {
      move(1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggleCard();
    }
  });

  elements.flashcard.addEventListener("pointerdown", (event) => {
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerId = event.pointerId;
  });

  elements.flashcard.addEventListener("pointerup", (event) => {
    if (pointerId !== event.pointerId || pointerStartX === null || pointerStartY === null) {
      return;
    }

    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    pointerId = null;
    pointerStartX = null;
    pointerStartY = null;

    if (Math.abs(deltaX) < 36 || Math.abs(deltaY) > 28) {
      return;
    }

    if (deltaX < 0) {
      move(1);
    } else {
      move(-1);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!state.selection) {
      return;
    }

    if (event.key === "Escape") {
      returnToPicker();
    }
  });
}

async function bootstrap() {
  setLoadingState();

  const response = await fetch(`./assets/flashcards.json?v=${ASSET_VERSION}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load flashcards: ${response.status}`);
  }

  state.allCards = await response.json();
  state.tests = buildTests(stableRandomizedCards(state.allCards));
  state.isRandomOrder = localStorage.getItem(STORAGE_KEYS.randomOrder) === "true";
  restoreLastSession();
  setupEvents();
  renderScreen();
}

bootstrap().catch((error) => {
  elements.allWordsCount.textContent = "Could not load cards";
  elements.allWordsStatus.textContent = "Refresh and try again";
  elements.pickerScreen.innerHTML = `<div class="selection-card"><span class="selection-title">Could not load cards</span><span class="selection-meta">${error.message}</span></div>`;
  console.error(error);
});