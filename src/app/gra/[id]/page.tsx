import Online from "./Online";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Online id={(await params).id} />;
}
