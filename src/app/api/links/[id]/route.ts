import { deleteLink } from "@/lib/repo";
import { handle } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteLink(id);
    return { ok: true };
  });
}
