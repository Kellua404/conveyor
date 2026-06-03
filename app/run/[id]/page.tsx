import { ControlRoom } from "@/components/ControlRoom";

export default function RunPermalink({ params }: { params: { id: string } }) {
  return <ControlRoom runId={params.id} />;
}
