"use client";

import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Post {
  _id: string;
  title: string | null;
  slug: string | null;
}

interface PostFilterBadgesProps {
  posts: Post[];
}

export default function PostFilterBadges({ posts }: PostFilterBadgesProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("post");

  const handleFilter = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slug === null || slug === activeFilter) {
        params.delete("post");
      } else {
        params.set("post", slug);
      }
      const query = params.toString();
      router.push(query ? `?${query}` : "/", { scroll: false });
    },
    [router, searchParams, activeFilter]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant={activeFilter === null ? "default" : "outline"}
        className="cursor-pointer rounded-full px-4 py-1 text-sm"
        onClick={() => handleFilter(null)}
      >
        All
      </Badge>
      {posts.map((post) => (
        <Badge
          key={post._id}
          variant={activeFilter === post.slug ? "default" : "outline"}
          className="cursor-pointer rounded-full px-4 py-1 text-sm"
          onClick={() => handleFilter(post.slug)}
        >
          {post.title || "Untitled"}
        </Badge>
      ))}
    </div>
  );
}
