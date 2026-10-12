import { route } from "@/lib/api-next";

export const { GET, PATCH, DELETE } = route("/api/events/:id");
