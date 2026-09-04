import { auth, defineMcp } from "@lovable.dev/mcp-js";
import appendIdeaChat from "./tools/append-idea-chat";
import buildPrompt from "./tools/build-prompt";
import captureUrl from "./tools/capture-url";
import createCalendarEvent from "./tools/create-calendar-event";
import createFolder from "./tools/create-folder";
import createIdea from "./tools/create-idea";
import createTodo from "./tools/create-todo";
import deleteIdea from "./tools/delete-idea";
import getIdea from "./tools/get-idea";
import getIdeaChat from "./tools/get-idea-chat";
import getInstructions from "./tools/get-instructions";
import listCalendarEvents from "./tools/list-calendar-events";
import listFolders from "./tools/list-folders";
import listTags from "./tools/list-tags";
import listTodos from "./tools/list-todos";
import recallContext from "./tools/recall-context";
import searchIdeas from "./tools/search-ideas";
import setTodoDone from "./tools/set-todo-done";
import summarizeText from "./tools/summarize-text";
import updateIdea from "./tools/update-idea";
import whoami from "./tools/whoami";

// Vite inlines this literal at build time, so the entry stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fartbrains-app",
  title: "Fartbrains.app",
  version: "0.1.0",
  instructions: [
    "This is the signed-in user's personal second brain: saved ideas, notes, captured links and transcripts, folders, tags, todos and important dates.",
    "Start a session with `get_instructions` and follow the user's standing rules, then use `recall_context` before answering anything that depends on what they already captured or decided.",
    "Use `search_ideas` / `get_idea` to read, `create_idea` and `capture_url` to save new material, `update_idea` to refine, and `create_todo` for actions.",
    "When the user wants to build, spec or act on something they saved rather than just read it, call `build_prompt` — it turns a saved idea or transcript into a brief you can work from. You do the building; this vault supplies the material and the brief.",
    "Reuse the user's existing folders and tags (`list_folders`, `list_tags`) instead of inventing new vocabulary. Confirm before calling `delete_idea`.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    getInstructions,
    recallContext,
    searchIdeas,
    getIdea,
    createIdea,
    updateIdea,
    deleteIdea,
    captureUrl,
    summarizeText,
    buildPrompt,
    listFolders,
    createFolder,
    listTags,
    listTodos,
    createTodo,
    setTodoDone,
    listCalendarEvents,
    createCalendarEvent,
    getIdeaChat,
    appendIdeaChat,
  ],
});
