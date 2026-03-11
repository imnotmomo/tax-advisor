"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

const DEFAULT_TOP_K = 10;
const EMPTY_PROMPT_COUNT = 3;

const QUESTION_BANK = [
  "Can I deduct IRA contributions if I have a workplace retirement plan?",
  "What documents should I gather before filing my individual tax return?",
  "How are long-term and short-term capital gains taxed?",
  "What tax credits should I check if I have children?",
  "Can I deduct student loan interest on my return?",
  "How does filing jointly change common tax deductions?",
  "What counts as taxable income for freelance work?",
  "When should I take the standard deduction instead of itemizing?",
  "How are HSA contributions and withdrawals treated for taxes?",
  "What happens if I sold stock and also had dividend income?",
  "Can I claim a home office deduction if I work for myself?",
  "How are estimated quarterly taxes calculated for self-employed income?",
  "What is the difference between a tax deduction and a tax credit?",
  "Can I deduct medical expenses on my federal return?",
  "How does the child tax credit work?",
  "What filing status should I use if I am divorced with children?",
  "Are unemployment benefits taxable?",
  "How are Social Security benefits taxed?",
  "Can I deduct mortgage interest and property taxes?",
  "What happens if I file my tax return late?",
  "How do I report side gig income from apps or online platforms?",
  "What tax forms should I expect from a brokerage account?",
  "Can I contribute to both a 401(k) and an IRA in the same year?",
  "How are Roth IRA conversions taxed?",
  "What tax breaks are available for college tuition and education costs?",
  "Can I deduct charitable donations if I do not itemize?",
  "How are rental property income and expenses reported?",
  "What can small business owners deduct for vehicle expenses?",
  "How do wash sale rules affect stock losses?",
  "Can I use capital losses to offset ordinary income?",
  "How are crypto sales and swaps taxed?",
  "What taxes apply when I receive a bonus from my employer?",
  "How do dependent care expenses affect my tax return?",
  "Can I still file jointly if my spouse has no income?",
  "How do I report interest income from savings accounts and CDs?",
  "What is the tax treatment of alimony and child support?",
  "Can I deduct moving expenses on a federal return?",
  "How are inherited IRAs taxed?",
  "What should I know about taxes when selling a primary home?",
  "How do I correct a tax return after it has already been filed?",
];

type UserMessage = {
  id: string;
  role: "user";
  content: string;
};

type ParsedAdvisorAnswer = {
  answerLines: string[];
  sourceLines: string[];
  requestsMoreInfo: boolean;
};

type AssistantThinkingMessage = {
  id: string;
  role: "assistant";
  status: "thinking";
  question: string;
  forceProceed: boolean;
};

type AssistantReadyMessage = {
  id: string;
  role: "assistant";
  status: "ready";
  question: string;
  forceProceed: boolean;
  raw: string;
  parsed: ParsedAdvisorAnswer;
};

type AssistantErrorMessage = {
  id: string;
  role: "assistant";
  status: "error";
  question: string;
  forceProceed: boolean;
  error: string;
};

type AssistantMessage =
  | AssistantThinkingMessage
  | AssistantReadyMessage
  | AssistantErrorMessage;

type ChatMessage = UserMessage | AssistantMessage;

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

type WorkspaceState = {
  sessions: ChatSession[];
  activeSessionId: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizePromptSnippet(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function createChatSession(): ChatSession {
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

function getUserMessages(messages: ChatMessage[]) {
  return messages.filter((message): message is UserMessage => message.role === "user");
}

function deriveSessionTitle(messages: ChatMessage[]) {
  const firstUserMessage = getUserMessages(messages)[0];

  if (!firstUserMessage) {
    return "New chat";
  }

  const normalized = normalizePromptSnippet(firstUserMessage.content);

  if (normalized.length <= 34) {
    return normalized;
  }

  return `${normalized.slice(0, 31)}...`;
}

function buildAdvisorQuestion(messages: ChatMessage[]) {
  const userMessages = getUserMessages(messages)
    .map((message) => normalizePromptSnippet(message.content))
    .filter(Boolean);

  if (userMessages.length === 0) {
    return "";
  }

  if (userMessages.length === 1) {
    return userMessages[0];
  }

  const latest = userMessages[userMessages.length - 1];
  const earlier = userMessages.slice(0, -1);

  return [
    "Use the earlier user notes as context for the latest request.",
    "",
    "Earlier user notes:",
    ...earlier.map((message, index) => `${index + 1}. ${message}`),
    "",
    "Latest user message:",
    latest,
  ].join("\n");
}

function parseAdvisorAnswer(raw: string): ParsedAdvisorAnswer {
  const normalized = raw.trim();
  const sections = normalized.split(/\n\s*Sources:\s*\n/i);
  const answerSection = sections[0] ?? "";
  const sourceSection = sections.slice(1).join("\n").trim();

  const answerLines = answerSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase() !== "answer:");

  const sourceLines = sourceSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    answerLines: answerLines.length > 0 ? answerLines : ["No answer returned."],
    sourceLines,
    requestsMoreInfo:
      /\[MISSING_INFO\]/i.test(answerSection) ||
      /missing fields:/i.test(answerSection) ||
      /insufficient information to determine eligibility/i.test(answerSection),
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "The advisor request could not be completed.";
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseSourceLine(line: string) {
  const match = line.match(/^(\d+)\.\s+(.*)$/);

  if (!match) {
    return {
      index: null,
      value: line,
    };
  }

  return {
    index: match[1],
    value: match[2],
  };
}

function renderAnswerLine(line: string) {
  if (/^-\s+/.test(line)) {
    return <p className="advisor-answer-line advisor-answer-line-bullet">{line.slice(2)}</p>;
  }

  if (/^\d+\.\s+/.test(line)) {
    return <p className="advisor-answer-line advisor-answer-line-number">{line}</p>;
  }

  return <p className="advisor-answer-line">{line}</p>;
}

function sortSessionsByRecent(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function replaceSessionMessages(session: ChatSession, messages: ChatMessage[]) {
  return {
    ...session,
    messages,
    title: deriveSessionTitle(messages),
    updatedAt: Date.now(),
  };
}

function updateSessionById(
  state: WorkspaceState,
  sessionId: string,
  updater: (session: ChatSession) => ChatSession
) {
  let found = false;

  const sessions = state.sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    found = true;
    return updater(session);
  });

  if (!found) {
    return state;
  }

  return {
    ...state,
    sessions: sortSessionsByRecent(sessions),
  };
}

function getSessionMeta(session: ChatSession) {
  const hasPendingAnswer = session.messages.some(
    (message) => message.role === "assistant" && message.status === "thinking"
  );

  if (hasPendingAnswer) {
    return "Thinking";
  }

  const askCount = getUserMessages(session.messages).length;

  if (askCount === 0) {
    return "Empty chat";
  }

  return `${askCount} ask${askCount === 1 ? "" : "s"}`;
}

function pickRandomPrompts(count: number) {
  const shuffled = [...QUESTION_BANK];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled.slice(0, count);
}

export function TaxAdvisorWorkspace() {
  const [draft, setDraft] = useState("");
  const [emptyPrompts, setEmptyPrompts] = useState(() =>
    pickRandomPrompts(EMPTY_PROMPT_COUNT)
  );
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
    const initialSession = createChatSession();

    return {
      sessions: [initialSession],
      activeSessionId: initialSession.id,
    };
  });
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const activeSession =
    workspace.sessions.find((session) => session.id === workspace.activeSessionId) ??
    workspace.sessions[0];
  const visibleSessions = workspace.sessions.filter((session) => session.messages.length > 0);
  const messages = activeSession?.messages ?? [];
  const isBusy = workspace.sessions.some((session) =>
    session.messages.some(
      (message) => message.role === "assistant" && message.status === "thinking"
    )
  );
  const latestMessageId = messages[messages.length - 1]?.id ?? null;

  useEffect(() => {
    const thread = threadRef.current;

    if (!thread) {
      return;
    }

    const behavior = messages.length > 1 ? "smooth" : "auto";

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior,
    });
  }, [activeSession?.id, messages.length]);

  useEffect(() => {
    if (messages.length === 0) {
      setEmptyPrompts(pickRandomPrompts(EMPTY_PROMPT_COUNT));
    }
  }, [activeSession?.id, messages.length]);

  async function resolveAssistantMessage(
    sessionId: string,
    assistantMessageId: string,
    question: string,
    forceProceed: boolean
  ) {
    try {
      const response = await fetch("/api/tax-advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          topK: DEFAULT_TOP_K,
          forceProceed,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { answer?: unknown; error?: unknown }
        | null;

      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : "The advisor request failed.";

        throw new Error(message);
      }

      if (typeof data?.answer !== "string" || data.answer.trim().length === 0) {
        throw new Error("The advisor returned an empty response.");
      }

      const answer = data.answer.trim();

      setWorkspace((currentState) =>
        updateSessionById(currentState, sessionId, (session) =>
          replaceSessionMessages(
            session,
            session.messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    id: assistantMessageId,
                    role: "assistant",
                    status: "ready",
                    question,
                    forceProceed,
                    raw: answer,
                    parsed: parseAdvisorAnswer(answer),
                  }
                : message
            )
          )
        )
      );
    } catch (error) {
      setWorkspace((currentState) =>
        updateSessionById(currentState, sessionId, (session) =>
          replaceSessionMessages(
            session,
            session.messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    id: assistantMessageId,
                    role: "assistant",
                    status: "error",
                    question,
                    forceProceed,
                    error: toErrorMessage(error),
                  }
                : message
            )
          )
        )
      );
    }
  }

  async function submitUserMessage(content: string) {
    const trimmed = content.trim();

    if (!trimmed || isBusy || !activeSession) {
      return;
    }

    const userMessage: UserMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    const question = buildAdvisorQuestion([...messages, userMessage]);
    const assistantMessage: AssistantThinkingMessage = {
      id: createId(),
      role: "assistant",
      status: "thinking",
      question,
      forceProceed: false,
    };

    setDraft("");
    setWorkspace((currentState) =>
      updateSessionById(currentState, activeSession.id, (session) =>
        replaceSessionMessages(session, [...session.messages, userMessage, assistantMessage])
      )
    );

    await resolveAssistantMessage(activeSession.id, assistantMessage.id, question, false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitUserMessage(draft);
  }

  async function handleForceProceed(messageId: string) {
    if (isBusy || !activeSession) {
      return;
    }

    const targetMessage = messages.find(
      (message): message is AssistantReadyMessage =>
        message.role === "assistant" &&
        message.status === "ready" &&
        message.id === messageId &&
        !message.forceProceed
    );

    if (!targetMessage) {
      return;
    }

    const assistantMessage: AssistantThinkingMessage = {
      id: createId(),
      role: "assistant",
      status: "thinking",
      question: targetMessage.question,
      forceProceed: true,
    };

    setWorkspace((currentState) =>
      updateSessionById(currentState, activeSession.id, (session) =>
        replaceSessionMessages(session, [...session.messages, assistantMessage])
      )
    );

    await resolveAssistantMessage(
      activeSession.id,
      assistantMessage.id,
      targetMessage.question,
      true
    );
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const form = event.currentTarget.form;

      if (form) {
        form.requestSubmit();
      }
    }
  }

  function handleCreateNewChat() {
    if (activeSession && activeSession.messages.length === 0 && draft.trim().length === 0) {
      composerRef.current?.focus({ preventScroll: true });
      return;
    }

    const nextSession = createChatSession();

    setDraft("");
    setWorkspace((currentState) => ({
      activeSessionId: nextSession.id,
      sessions: [nextSession, ...currentState.sessions],
    }));
    composerRef.current?.focus({ preventScroll: true });
  }

  function handleSelectSession(sessionId: string) {
    setDraft("");
    setWorkspace((currentState) => ({
      ...currentState,
      activeSessionId: sessionId,
    }));
  }

  return (
    <section className="advisor-layout">
      <aside className="panel advisor-history-panel">
        <div className="advisor-history-head">
          <div className="stack-xs">
            <p className="kicker">Chat History</p>
            <p className="advisor-history-copy">Switch chats from the left rail.</p>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-compact-action advisor-history-create"
            onClick={handleCreateNewChat}
            disabled={isBusy}
          >
            New chat
          </button>
        </div>

        <div className="advisor-history-list">
          {visibleSessions.length === 0 ? (
            <p className="advisor-history-empty">No saved chats yet.</p>
          ) : (
            visibleSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`advisor-history-item${
                  session.id === activeSession?.id ? " advisor-history-item-active" : ""
                }`}
                onClick={() => handleSelectSession(session.id)}
              >
                <span className="advisor-history-title">{session.title}</span>
                <span className="advisor-history-meta">{getSessionMeta(session)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="panel advisor-stage" aria-busy={isBusy}>
        <div className="advisor-thread" aria-live="polite" ref={threadRef}>
          {messages.length === 0 ? (
            <div className="advisor-empty">
              <div className="stack-sm">
                <p className="kicker">Tax Advisor Agent</p>
                <h1 className="advisor-empty-title">
                  Ask a tax question and get an answer with sources.
                </h1>
                <p className="section-copy">
                  Choose one of the suggested questions below, or type your own to start a chat.
                </p>
              </div>

              <div className="advisor-empty-prompts">
                {emptyPrompts.map((prompt) => (
                  <button
                    key={`${activeSession?.id ?? "empty"}-${prompt}`}
                    type="button"
                    className="btn btn-ghost advisor-starter-button"
                    onClick={() => {
                      void submitUserMessage(prompt);
                    }}
                    disabled={isBusy}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              if (message.role === "user") {
                return (
                  <div
                    key={message.id}
                    className="advisor-message-row advisor-message-row-user"
                  >
                    <article className="advisor-message-card advisor-message-card-user">
                      <p className="kicker">Ask</p>
                      <p className="advisor-user-copy">{message.content}</p>
                    </article>
                  </div>
                );
              }

              const showForceProceed =
                message.status === "ready" &&
                message.parsed.requestsMoreInfo &&
                !message.forceProceed &&
                latestMessageId === message.id;

              return (
                <div
                  key={message.id}
                  className="advisor-message-row advisor-message-row-assistant"
                >
                  <article className="advisor-message-card advisor-message-card-assistant">
                    <div className="advisor-answer-grid">
                      <section className="advisor-response-pane stack-sm">
                        <p className="kicker">Answer</p>

                        {message.status === "thinking" ? (
                          <div className="advisor-thinking" aria-label="Thinking">
                            <span>Thinking</span>
                            <div className="advisor-thinking-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                        ) : null}

                        {message.status === "error" ? (
                          <p className="advisor-answer-line">{message.error}</p>
                        ) : null}

                        {message.status === "ready"
                          ? message.parsed.answerLines.map((line, index) => (
                              <div key={`${message.id}-answer-${index}`}>
                                {renderAnswerLine(line)}
                              </div>
                            ))
                          : null}
                      </section>

                      <section className="advisor-response-pane stack-sm">
                        <p className="kicker">Source</p>

                        {message.status === "thinking" ? (
                          <p className="advisor-source-line">Waiting for source retrieval.</p>
                        ) : null}

                        {message.status === "error" ? (
                          <p className="advisor-source-line">No source output was returned.</p>
                        ) : null}

                        {message.status === "ready" && message.parsed.sourceLines.length === 0 ? (
                          <p className="advisor-source-line">No source output was returned.</p>
                        ) : null}

                        {message.status === "ready"
                          ? message.parsed.sourceLines.map((line, index) => {
                              const source = parseSourceLine(line);

                              return (
                                <div
                                  key={`${message.id}-source-${index}`}
                                  className="advisor-source-line"
                                >
                                  {source.index ? (
                                    <span className="advisor-source-index">{source.index}.</span>
                                  ) : null}

                                  {isUrl(source.value) ? (
                                    <a
                                      className="advisor-source-link"
                                      href={source.value}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {source.value}
                                    </a>
                                  ) : (
                                    <span>{source.value}</span>
                                  )}
                                </div>
                              );
                            })
                          : null}
                      </section>
                    </div>

                    {showForceProceed ? (
                      <div className="advisor-force-proceed">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            void handleForceProceed(message.id);
                          }}
                          disabled={isBusy}
                        >
                          Force proceed
                        </button>
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })
          )}
        </div>

        <div className="advisor-composer">
          <form className="advisor-composer-form stack-sm" onSubmit={handleSubmit}>
            <label className="kicker" htmlFor="advisor-question">
              Ask
            </label>
            <textarea
              ref={composerRef}
              id="advisor-question"
              name="advisor-question"
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask about deductions, filing status, retirement plans, or any other tax question."
              disabled={isBusy}
            />

            <div className="advisor-composer-actions">
              <p className="advisor-composer-note">
                Shift + Enter adds a new line. Force proceed stays hidden unless the model asks
                for more information.
              </p>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isBusy || draft.trim().length === 0}
              >
                {isBusy ? "Thinking..." : "Send question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
