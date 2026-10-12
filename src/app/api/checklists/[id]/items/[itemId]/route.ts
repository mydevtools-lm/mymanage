import { route } from "@/lib/api-next";

export const { PATCH, DELETE } = route("/api/checklists/:id/items/:itemId");
