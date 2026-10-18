import * as common from "./common";
import * as today from "./today";
import * as tasks from "./tasks";
import * as calendar from "./calendar";
import * as finance from "./finance";
import * as notes from "./notes";
import * as settings from "./settings";
import * as data from "./data";
import * as assist from "./assist";
import * as onboarding from "./onboarding";

/** Every message, by area (one file each) and language. */
const en = {
  common: common.en,
  today: today.en,
  tasks: tasks.en,
  calendar: calendar.en,
  finance: finance.en,
  notes: notes.en,
  settings: settings.en,
  data: data.en,
  assist: assist.en,
  onboarding: onboarding.en,
};

export type Messages = typeof en;

const he: Messages = {
  common: common.he,
  today: today.he,
  tasks: tasks.he,
  calendar: calendar.he,
  finance: finance.he,
  notes: notes.he,
  settings: settings.he,
  data: data.he,
  assist: assist.he,
  onboarding: onboarding.he,
};

export const MESSAGES = { en, he };
