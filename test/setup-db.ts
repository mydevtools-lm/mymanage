// repo.ts runs on whichever database is set; the tests use node:sqlite.
import "@/lib/node-db";
import { setLocale } from "@/lib/i18n";

// The tests were written against the Hebrew texts; English has its own.
setLocale("he");
