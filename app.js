const listenButton = document.querySelector("#listenButton");
const briefButton = document.querySelector("#briefButton");
const muteButton = document.querySelector("#muteButton");
const assistantState = document.querySelector("#assistantState");
const clockLine = document.querySelector("#clockLine");
const statusDot = document.querySelector("#statusDot");
const quickActions = document.querySelector("#quickActions");
const todayLabel = document.querySelector("#todayLabel");
const sessionTime = document.querySelector("#sessionTime");
const commandCount = document.querySelector("#commandCount");
const noteCount = document.querySelector("#noteCount");
const briefingText = document.querySelector("#briefingText");
const conversation = document.querySelector("#conversation");
const commandForm = document.querySelector("#commandForm");
const commandInput = document.querySelector("#commandInput");
const noteForm = document.querySelector("#noteForm");
const noteInput = document.querySelector("#noteInput");
const noteList = document.querySelector("#noteList");
const clearMemory = document.querySelector("#clearMemory");
const speechSupport = document.querySelector("#speechSupport");
const coreMode = document.querySelector("#coreMode");
const canvas = document.querySelector("#reactorCanvas");
const ctx = canvas.getContext("2d");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let muted = false;
let commandTotal = Number(localStorage.getItem("farqisCommandTotal") || 0);
let notes = JSON.parse(localStorage.getItem("farqisNotes") || "[]");
let startedAt = Date.now();
let angle = 0;

const actions = [
  {
    label: "Open Finder",
    command: "open -a Finder",
    response: "Finder launch command copied."
  },
  {
    label: "Network details",
    command: "networksetup -listallhardwareports",
    response: "Network hardware command copied."
  },
  {
    label: "Mac storage",
    command: "df -h",
    response: "Storage command copied."
  },
  {
    label: "Active processes",
    command: "top -o cpu",
    response: "Process monitor command copied."
  },
  {
    label: "Wi-Fi scan",
    command: "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s",
    response: "Wi-Fi scan command copied."
  }
];

function setState(text, mode = "ready") {
  assistantState.textContent = text;
  statusDot.className = "status-dot";
  if (mode === "listening") statusDot.classList.add("listening");
  if (mode === "error") statusDot.classList.add("error");
  coreMode.textContent = mode === "listening" ? "LISTEN" : mode === "error" ? "CHECK" : "LOCAL";
}

function speak(text) {
  if (muted || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 0.95;
  window.speechSynthesis.speak(utterance);
}

function addMessage(role, text) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const who = document.createElement("strong");
  const body = document.createElement("div");
  const time = document.createElement("time");
  who.textContent = role === "user" ? "You" : "Farqis";
  body.textContent = text;
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  message.append(who, body, time);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function saveNotes() {
  localStorage.setItem("farqisNotes", JSON.stringify(notes));
  noteCount.textContent = notes.length;
}

function renderNotes() {
  noteList.innerHTML = "";
  if (!notes.length) {
    const empty = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = "No saved local notes.";
    empty.append(text);
    noteList.append(empty);
    noteCount.textContent = "0";
    return;
  }
  notes.forEach((note, index) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    const remove = document.createElement("button");
    text.textContent = note;
    remove.type = "button";
    remove.textContent = "Done";
    remove.title = "Remove note";
    remove.addEventListener("click", () => {
      notes.splice(index, 1);
      saveNotes();
      renderNotes();
      respond("Marked complete.");
    });
    item.append(text, remove);
    noteList.append(item);
  });
  noteCount.textContent = notes.length;
}

function renderActions() {
  quickActions.innerHTML = "";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-card";
    button.title = `Copy command: ${action.command}`;
    button.innerHTML = `<strong>${action.label}</strong><code>${action.command}</code>`;
    button.addEventListener("click", async () => {
      await copyText(action.command);
      respond(action.response);
    });
    quickActions.append(button);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
}

function buildBriefing() {
  const now = new Date();
  const hour = now.getHours();
  const phase = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const saved = notes.length ? `Local memory has ${notes.length} active ${notes.length === 1 ? "note" : "notes"}.` : "Local memory is clear.";
  return `Good ${phase}. Farqis is online on your Mac mini. Browser voice ${SpeechRecognition ? "input is available" : "input is unavailable in this browser"}, speech output is ${"speechSynthesis" in window ? "available" : "unavailable"}. ${saved} Quick actions are ready for macOS Terminal.`;
}

function updateBriefing() {
  briefingText.textContent = buildBriefing();
}

function respond(text) {
  addMessage("assistant", text);
  speak(text);
  setState("Standing by");
}

function remember(text) {
  const note = text.replace(/^remember\s*/i, "").trim();
  if (!note) {
    respond("Tell me what to remember.");
    return;
  }
  notes.unshift(note);
  notes = notes.slice(0, 24);
  saveNotes();
  renderNotes();
  updateBriefing();
  respond("Saved to local memory.");
}

function handleCommand(raw) {
  const text = raw.trim();
  if (!text) return;

  commandTotal += 1;
  localStorage.setItem("farqisCommandTotal", String(commandTotal));
  commandCount.textContent = commandTotal;
  addMessage("user", text);

  const lower = text.toLowerCase();
  if (lower.startsWith("remember")) {
    remember(text);
    return;
  }
  if (lower.includes("brief") || lower.includes("status")) {
    updateBriefing();
    respond(buildBriefing());
    return;
  }
  if (lower.includes("time")) {
    respond(`It is ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
    return;
  }
  if (lower.includes("clear memory")) {
    notes = [];
    saveNotes();
    renderNotes();
    updateBriefing();
    respond("Local memory cleared.");
    return;
  }
  const matchedAction = actions.find((action) => lower.includes(action.label.toLowerCase().split(" ")[0]) || lower.includes(action.label.toLowerCase()));
  if (matchedAction) {
    copyText(matchedAction.command);
    respond(`${matchedAction.response} Paste it into Terminal when you want macOS to run it.`);
    return;
  }
  if (lower.includes("hello") || lower.includes("farqis")) {
    respond("Farqis online. Local systems ready.");
    return;
  }
  respond("Command logged. I can handle briefing, time, remember, clear memory, Finder, network, storage, processes, and Wi-Fi scan.");
}

function setupSpeech() {
  if (!SpeechRecognition) {
    speechSupport.textContent = "Voice input unavailable";
    listenButton.disabled = true;
    return;
  }
  speechSupport.textContent = "Voice input ready";
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  recognition.onstart = () => setState("Listening", "listening");
  recognition.onerror = () => {
    setState("Voice input stopped", "error");
    respond("Voice input could not start in this browser session.");
  };
  recognition.onend = () => {
    if (assistantState.textContent === "Listening") setState("Standing by");
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    commandInput.value = transcript;
    handleCommand(transcript);
    commandInput.value = "";
  };
}

function updateClock() {
  const now = new Date();
  clockLine.textContent = now.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  todayLabel.textContent = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  sessionTime.textContent = `${minutes}:${seconds}`;
}


function drawCore() {
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.22;
  angle += 0.014;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(3, 11, 14, 0.82)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(95, 224, 222, 0.12)";
  ctx.lineWidth = 1;
  for (let x = -height; x < width + height; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }

  for (let ring = 0; ring < 5; ring += 1) {
    ctx.beginPath();
    ctx.strokeStyle = ring % 2 ? "rgba(242, 184, 75, 0.35)" : "rgba(95, 224, 222, 0.46)";
    ctx.lineWidth = ring === 2 ? 3 : 1.4;
    ctx.arc(cx, cy, radius + ring * 29, angle * (ring % 2 ? -1 : 1), Math.PI * 1.55 + angle * (ring % 2 ? -1 : 1));
    ctx.stroke();
  }

  for (let i = 0; i < 32; i += 1) {
    const a = angle + (Math.PI * 2 * i) / 32;
    const inner = radius + 88;
    const outer = radius + 112 + Math.sin(angle * 4 + i) * 8;
    ctx.beginPath();
    ctx.strokeStyle = i % 4 === 0 ? "rgba(242, 184, 75, 0.7)" : "rgba(95, 224, 222, 0.42)";
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius * 1.25);
  glow.addColorStop(0, "rgba(235, 255, 255, 0.95)");
  glow.addColorStop(0.35, "rgba(95, 224, 222, 0.64)");
  glow.addColorStop(1, "rgba(95, 224, 222, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e9fbfb";
  ctx.font = "900 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FARQIS", cx, cy + 11);
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(233, 251, 251, 0.72)";
  ctx.fillText("MAC MINI LOCAL ASSIST", cx, cy + 38);

  requestAnimationFrame(drawCore);
}

listenButton.addEventListener("click", () => {
  if (!recognition) return;
  try {
    recognition.start();
  } catch {
    setState("Voice input busy", "error");
  }
});

briefButton.addEventListener("click", () => {
  updateBriefing();
  respond(buildBriefing());

});


muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.innerHTML = muted ? '<span aria-hidden="true">◎</span> Voice off' : '<span aria-hidden="true">◎</span> Voice on';
  if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
});

commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(commandInput.value);
  commandInput.value = "";
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const note = noteInput.value.trim();
  if (!note) return;
  notes.unshift(note);
  notes = notes.slice(0, 24);
  noteInput.value = "";
  saveNotes();
  renderNotes();
  updateBriefing();
  respond("Saved to local memory.");
});

clearMemory.addEventListener("click", () => {
  notes = [];
  saveNotes();
  renderNotes();
  updateBriefing();
  respond("Local memory cleared.");
});

setupSpeech();
renderActions();
renderNotes();
updateBriefing();
updateClock();
commandCount.textContent = commandTotal;
addMessage("assistant", "Farqis online. Local mode active on your Mac mini.");
drawCore();
setInterval(updateClock, 1000);
