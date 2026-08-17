import JurisBotChatClient from "./JurisBotChatClient";

export default async function JurisBotChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JurisBotChatClient caseId={id} />;
}
