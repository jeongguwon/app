import { PostDetailView } from "@/components/posts/post-detail-view";

interface PostDetailPageProps {
  params: Promise<{
    postId: string;
  }>;
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { postId } = await params;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <PostDetailView postId={postId} />
    </main>
  );
}
