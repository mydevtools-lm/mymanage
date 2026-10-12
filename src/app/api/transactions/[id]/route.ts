import { route } from "@/lib/api-next";

export const { GET, PATCH, DELETE } = route("/api/transactions/:id");
